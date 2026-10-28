#!/usr/bin/env bash
set -euo pipefail

# Całość siedzi w funkcji, bo bash czyta skrypt na bieżąco: edycja pliku lub zmiana gałęzi
# w trakcie działania appki psułaby parsowanie końcówki (sprzątanie po zamknięciu Chrome).
main() {
    local DIR DATA PORT PIDFILE PROFILE CHROME PAGE WIN_W WIN_H WIN_POS TRAY_PID
    DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
    PORT="${SP9AK_PORT:-17823}"
    PIDFILE="${SP9AK_PIDFILE:-/tmp/sp9ak.pid}"
    # Dane użytkownika (profil Chrome, historia sesji): domyślnie w katalogu projektu,
    # w pakiecie .deb ustawiane na ~/.local/share/sp9ak (SP9AK_DATA), bo /usr jest tylko do odczytu.
    DATA="${SP9AK_DATA:-$DIR}"
    mkdir -p "$DATA"
    PROFILE="$DATA/chrome-profile"
    export SP9AK_SESSIONS="${SP9AK_SESSIONS:-$DATA/sessions.json}"

    # Sprawdź zależności
    if ! command -v python3 &>/dev/null; then
        echo "Błąd: python3 nie jest zainstalowany." >&2
        exit 1
    fi

    if ! command -v google-chrome-beta &>/dev/null; then
        echo "Błąd: google-chrome-beta nie jest zainstalowany." >&2
        echo "Pobierz: https://www.google.com/chrome/beta/" >&2
        exit 1
    fi
    CHROME="google-chrome-beta"
    PAGE="index.html"
    [[ "${1:-}" == "--test" ]] && PAGE="nano-check/index.html"

    # Aplikacja już działa (np. drugie kliknięcie skrótu): tylko pokaż okno. Ponowny start zabiłby
    # serwer, a Chrome z tym samym profilem przekazałby okno działającemu procesowi i od razu wyszedł.
    if [[ -f "$PIDFILE" ]] && kill -0 "$(<"$PIDFILE")" 2>/dev/null; then
        wmctrl -a sp9ak 2>/dev/null || true
        exit 0
    fi

    # Serwer z obsługą GET (pliki statyczne) i POST /api/sessions (zapis JSON)
    (cd "$DIR" && exec python3 -m server "$PORT") >/dev/null 2>&1 &
    echo $! > "$PIDFILE"
    sleep 0.5

    # Sprawdź czy serwer wystartował
    if ! kill -0 "$(<"$PIDFILE")" 2>/dev/null; then
        echo "Błąd: serwer nie wystartował (port $PORT może być zajęty)." >&2
        exit 1
    fi

    # Pozycja startowa: prawy dolny róg głównego monitora, nad panelem (bez przeskoku)
    WIN_W=540; WIN_H=640
    WIN_POS="$( (cd "$DIR" && python3 -m desktop.x11 --position $WIN_W $WIN_H) 2>/dev/null || echo 50,50)"

    # Ikona w trayu + ustawienie okna w prawym dolnym rogu (X11)
    if command -v wmctrl &>/dev/null && command -v xdotool &>/dev/null; then
        (cd "$DIR" && SP9AK_PORT="$PORT" exec python3 -m desktop.tray) >/dev/null 2>&1 &
        TRAY_PID=$!
    else
        echo "Uwaga: brak wmctrl/xdotool – bez ikony w trayu." >&2
        TRAY_PID=""
    fi

    "$CHROME" \
        --app="http://localhost:$PORT/$PAGE" \
        --user-data-dir="$PROFILE" \
        --no-default-browser-check \
        --no-first-run \
        --window-size=$WIN_W,$WIN_H \
        --window-position=$WIN_POS \
        --enable-features=PromptAPIForGeminiNano,OptimizationGuideOnDeviceModel:bypass_perf_requirement/true \
        >/dev/null 2>&1

    # Chrome zamknięty – zatrzymaj tray i serwer
    [[ -n "$TRAY_PID" ]] && kill "$TRAY_PID" 2>/dev/null || true
    kill "$(<"$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
}

main "$@"
exit
