#!/usr/bin/env bash
# Instaluje skrót sp9ak w menu aplikacji (i opcjonalnie na pulpicie) dla repo uruchamianego z katalogu projektu.
# Bez sudo, bez pakietu .deb: wszystko ląduje w katalogu użytkownika.
# Użycie: scripts/install-shortcut.sh [--desktop] [--uninstall]
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
NAME="sp9ak.desktop"
WANT_DESKTOP=0
UNINSTALL=0

for arg in "$@"; do
    case "$arg" in
        --desktop) WANT_DESKTOP=1 ;;
        --uninstall) UNINSTALL=1 ;;
        -h|--help) sed -n '2,4p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
        *) echo "Nieznana opcja: $arg" >&2; exit 2 ;;
    esac
done

# Katalog pulpitu zależy od języka systemu (Desktop, Pulpit, ...)
desktop_dir() {
    xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop"
}

refresh_menu() {
    command -v update-desktop-database &>/dev/null && update-desktop-database "$APPS" 2>/dev/null || true
}

if (( UNINSTALL )); then
    rm -f "$APPS/$NAME" "$(desktop_dir)/$NAME"
    refresh_menu
    echo "Usunięto skrót sp9ak."
    exit 0
fi

# Ścieżki ze spacjami wymagają cudzysłowu w Exec
mkdir -p "$APPS"
cat > "$APPS/$NAME" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=sp9ak
GenericName=Dyktowanie głosowe
Comment=Dyktowanie po polsku z korektą AI
Exec="$ROOT/sp9ak.sh"
Path=$ROOT
Icon=$ROOT/desktop/icon.svg
Terminal=false
Categories=Office;Utility;
Keywords=dyktowanie;mowa;głos;dictation;speech;
StartupNotify=false
DESKTOP
chmod 755 "$APPS/$NAME"
refresh_menu
echo "Zainstalowano skrót w menu aplikacji: $APPS/$NAME"

if (( WANT_DESKTOP )); then
    DDIR="$(desktop_dir)"
    mkdir -p "$DDIR"
    cp "$APPS/$NAME" "$DDIR/$NAME"
    chmod 755 "$DDIR/$NAME"
    # GNOME wymaga oznaczenia pliku jako zaufanego, inaczej pokazuje go jako zwykły plik
    command -v gio &>/dev/null && gio set "$DDIR/$NAME" metadata::trusted true 2>/dev/null || true
    echo "Dodano ikonę na pulpicie: $DDIR/$NAME"
fi
