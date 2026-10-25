# Współpraca nad projektem

Dziękujemy za zainteresowanie sp9ak. Ten dokument opisuje, jak przygotować środowisko i jak
przeprowadzić zmianę od pomysłu do pull requesta. Agenci AI stosują te same zasady
(dodatkowe wskazówki dla nich są w [AGENTS.md](AGENTS.md)).

## Środowisko

Wymagania: Linux, Node.js 20+, Python 3.12+ (`ruff`), Chrome do testów E2E.

### Node.js

```bash
npm install
```

### Python (tylko `ruff` do lintu)

Aplikacja działa na samej bibliotece standardowej Pythona, więc nic z Pythona nie jest potrzebne do jej uruchomienia.
Do `npm run lint` potrzebny jest tylko `ruff`. Zainstaluj go w **środowisku wirtualnym** (`venv`), czyli w osobnym
katalogu `.venv/` w projekcie. Nie instaluj go globalnie: nowe Ubuntu/Debian odrzuci `pip install` w systemowym
Pythonie z błędem `externally-managed-environment`, a venv i tak nie zaśmieca systemu.

1. Utwórz venv (jednorazowo, w katalogu głównym repo):

   ```bash
   python3 -m venv --system-site-packages .venv
   ```

   Przełącznik `--system-site-packages` jest potrzebny, żeby venv widział pakiety systemowe (`python-xlib`, `gi`),
   z których korzystają testy Pythona. Bez niego `npm run test:py` przy aktywnym venv zgłosi
   `No module named 'Xlib'`.

   Gdy komenda zgłasza brak `ensurepip` lub `python3-venv`: `sudo apt install python3-venv` i powtórz.

2. Aktywuj venv. **Robisz to w każdym nowym terminalu**, bo aktywacja dotyczy tylko jednego okna terminala:

   ```bash
   source .venv/bin/activate
   ```

   Na początku linii pojawi się `(.venv)`. Sprawdź: `which python` ma wskazywać na `.venv/bin/python` w projekcie.
   Dla basha i zsh komenda jest ta sama.

3. Zainstaluj `ruff` (jednorazowo, przy aktywnym venv):

   ```bash
   pip install ruff
   ruff --version
   ```

4. Uruchamiaj lint przy aktywnym venv:

   ```bash
   npm run lint        # eslint + ruff
   ```

   `npm run lint` woła `ruff` po samej nazwie, więc bez aktywnego venv kończy się błędem `ruff: not found`.
   Bez aktywacji zadziała `./.venv/bin/ruff check .`.

5. Wyłączenie venv w danym terminalu: `deactivate`.

W PhpStormie wskaż interpreter `.venv/bin/python` w ustawieniach projektu (Python Interpreter) albo aktywuj venv
w jego terminalu. Katalog `.venv/` jest w `.gitignore` i nigdy nie trafia do repozytorium.

Aplikacja ma działać po zwykłym `git clone` i `./sp9ak.sh`. Nic, co wymaga instalacji w systemie
(np. pakiet `.deb`), nie może stać się warunkiem uruchomienia.

## Gałęzie

| Gałąź | Rola |
|---|---|
| `main` | ostatnie stabilne wydanie; nie commitujemy do niej bezpośrednio |
| `dev` | gałąź integracyjna; trafia tu cała praca, wyłącznie przez pull requesty |
| `release/YYYY-MM-DD` | wydanie wycięte z `dev`; tylko poprawki stabilizujące |
| `feature/<opis>` | nowa funkcja |
| `fix/<opis>` | poprawka błędu |
| `docs/<opis>` | sama dokumentacja |

Każda zmiana ma własną gałąź odgałęzioną od aktualnego `dev`. Jedna gałąź = jeden temat;
niepowiązane zmiany idą do osobnych gałęzi i osobnych commitów.

```bash
git switch dev && git pull
git switch -c fix/empty-dictation-space
```

## Wydania

Najpierw cała praca trafia do `dev`, dopiero z `dev` powstaje stabilne wydanie:

```
feature/*, fix/*, docs/*  →  dev  →  release/YYYY-MM-DD  →  main (tag vYYYY.MM.DD)
```

1. Wszystkie gotowe PR-y są scalone do `dev`.
2. Wycinamy `release/YYYY-MM-DD` z `dev` (drugie tego samego dnia: `release/YYYY-MM-DD.2`).
3. Na gałęzi release tylko poprawki stabilizujące, przez PR-y do niej; poprawki wracają też do `dev`.
4. Kandydata sprawdzamy: `npm run lint`, `npm test`, `npm run test:py`, `npm run test:e2e`,
   `npm run test:monkey` i `packaging/build-deb.sh`. Wersje próbne: tag `vYYYY.MM.DD-rc.N`
   (pakiet `.deb`: `YYYY.MM.DD~rcN`).
5. Gdy wszystko przechodzi: tag `vYYYY.MM.DD`, scalenie do `main` (`--no-ff`) i z powrotem do `dev`.

### Porządek w gałęziach

Po scaleniu PR-a kasujemy jego gałąź (na GitHubie i lokalnie). Gałąź śledzi własną gałąź na `origin`,
nie `origin/dev` (sprawdź `git branch -vv`). Zbędne `git worktree` usuwamy. Pełna lista zasad i
komendy do przeglądu: [AGENTS.md](AGENTS.md#porządek-w-gałęziach).

## Zanim otworzysz pull request

1. `npm run lint` (eslint + ruff) bez błędów.
2. `npm test` bez błędów; przy zmianach Pythona także `npm run test:py`.
3. Przy zmianach interfejsu lub zachowania w przeglądarce `npm run test:e2e`
   (wymaga Chrome: `/usr/bin/google-chrome` lub zmienna `CHROME_PATH`).
4. Nowy kod ma testy; poprawka błędu zaczyna się od testu, który błąd odtwarza.
5. README i inne dokumenty są zaktualizowane, jeśli zmiana zmienia ich treść.

CI uruchamia lint, testy jednostkowe z pokryciem, testy Pythona i E2E. Pull request z czerwonym CI
nie jest scalany.

## Pull requesty

- Cel PR-a to zawsze `dev`, nigdy `main`.
- Tytuł po angielsku, opis wyjaśnia *dlaczego* i jak sprawdzić zmianę.
- Mały, skupiony PR jest przeglądany szybciej niż duży.
- Scala właściciel repozytorium. Nikt inny nie wypycha do `dev` ani `main` i nie scala bez jego zgody.

## Commity

- Wiadomości po angielsku, tryb rozkazujący, krótki tytuł (np. `Add .deb package ...`).
- W treści piszemy *dlaczego*, nie *co* (to widać w diffie).
- Jeden commit = jedna logiczna zmiana.

## Styl kodu

- Frontend bez bundlera, moduły ES.
- Logika bez DOM w `web/js/core/`, usługi w `web/js/services/`, cienkie widoki w `web/js/ui/`.
- Python: serwer w `server/`, integracja z pulpitem w `desktop/`.
- Formatowanie z `.editorconfig` (UTF-8, LF, 4 spacje; 2 dla yml/json). Reguły lintera są w
  `eslint.config.js` i `pyproject.toml`.
- Pisz w stylu otoczenia: to samo nazewnictwo i podobna gęstość komentarzy.

## Testy

| Co | Gdzie | Polecenie |
|---|---|---|
| JS (vitest + jsdom) | `tests/unit/{core,services,ui}` | `npm test` |
| Python (unittest) | `tests/python` | `npm run test:py` |
| E2E (Playwright + Chrome) | `tests/e2e` | `npm run test:e2e` |
| Losowe klikanie | `tests/e2e/monkey.e2e.mjs` | `npm run test:monkey` |
| Układ okna (gremlins) | `tests/e2e/layout.e2e.mjs` | `npm run test:layout` |
| Dostępność (pa11y) | `tests/quality/a11y.mjs` | `npm run test:a11y` |
| Wydajność i jakość frontu (Lighthouse) | `tests/quality/lighthouse.mjs` | `npm run test:lighthouse` |

Testy E2E używają atrapy `SpeechRecognition` i atrapy `/api/ai`, więc nie potrzebują mikrofonu,
internetu ani kluczy API. Testy nigdy nie mogą zapisywać do prawdziwego `sessions.json`
(serwer czyta ścieżkę ze zmiennej `SP9AK_SESSIONS`).

## Czego nie commitować

- `sessions.json` (prywatne treści dyktowania), `chrome-profile/`, `dist/`, `coverage/`, `node_modules/`, `.venv/`.
- Kluczy API, tokenów i innych sekretów. Aplikacja ma działać lokalnie, bez wysyłania danych do chmury
  poza jawnie włączonym zewnętrznym AI.

## Zgłaszanie błędów

Opisz kroki odtworzenia, oczekiwane i faktyczne zachowanie oraz wersję Chrome Beta i systemu.
Nie dołączaj prywatnych fragmentów z `sessions.json`.
