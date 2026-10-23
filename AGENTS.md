# AGENTS.md

Zasady pracy nad projektem sp9ak (dla ludzi i agentów AI). `CLAUDE.md` tylko importuje ten plik (`@AGENTS.md`), więc wszystkie zasady dopisuj tutaj.

## Workflow git

- `main` – stabilne wydania. Nie commitujemy do niego bezpośrednio.
- `dev` – gałąź integracyjna. Tu trafia cała praca, **wyłącznie przez pull requesty** z feature branchy.
- Każda zmiana ma własną gałąź odgałęzioną od `dev`:
  - `feature/<opis>` – nowa funkcja,
  - `fix/<opis>` – poprawka błędu,
  - `docs/<opis>` – sama dokumentacja.
- Jedna gałąź = jeden temat. Niepowiązane zmiany idą do osobnych branchy i osobnych commitów.
- Pull request kierujemy do `dev` (nie do `main`). Przed PR-em muszą przechodzić `npm run lint` i `npm test`
  (a przy zmianach Pythona `npm run test:py`).
- Nie wypychamy ani nie scalamy bez wyraźnej zgody właściciela repozytorium.
- Wyjątek: początkowe utworzenie `dev` i tego pliku.

Pełny opis procesu dla współautorów: [CONTRIBUTING.md](CONTRIBUTING.md).

## Wydania

Najpierw cała praca trafia do `dev`, dopiero z `dev` powstaje stabilne wydanie.

1. Gotowe zmiany scalamy do `dev` pull requestami (jak wyżej). Wszystkie otwarte PR-y wchodzą do `dev`, zanim ruszy wydanie.
2. Wydanie wycinamy z `dev` jako `release/YYYY-MM-DD` (data wycięcia; drugie tego samego dnia: `release/YYYY-MM-DD.2`).
3. Na gałęzi release nie dodajemy nowych funkcji, tylko poprawki stabilizujące, przez PR-y do niej. Poprawkę z release wracamy też do `dev`.
4. Kandydata sprawdzamy pełnym zestawem: `npm run lint`, `npm test`, `npm run test:py`, `npm run test:e2e`, `npm run test:monkey` oraz `packaging/build-deb.sh`. Wersje próbne oznaczamy tagiem `vYYYY.MM.DD-rc.N` (pakiet `.deb`: `YYYY.MM.DD~rcN`).
5. Gdy wszystko przechodzi: tag `vYYYY.MM.DD`, scalenie `release/YYYY-MM-DD` do `main` (`--no-ff`) i z powrotem do `dev`. `main` zawsze wskazuje ostatnie stabilne wydanie.
6. Tak jak przy PR-ach: nie wypychamy, nie tagujemy i nie scalamy bez wyraźnej zgody właściciela.

## Commity

- Wiadomości po angielsku, tryb rozkazujący, krótki wiersz tytułowy (np. `Add .deb package ...`).
- W treści wyjaśniamy *dlaczego*, nie *co* (to widać w diffie).

## Struktura i polecenia

Opis struktury katalogów jest w [README.md](README.md#struktura-projektu).

```bash
npm install
npm test            # testy jednostkowe JS (vitest)
npm run test:py     # testy Pythona
npm run test:e2e    # scenariusze w prawdziwym Chrome
npm run lint        # eslint + ruff
```

## Zasady dla kodu

- Aplikacja musi nadal działać po zwykłym sklonowaniu repo i `./sp9ak.sh`. Integracja z systemem
  (np. pakiet `.deb`) jest wyłącznie dodatkiem, nigdy wymogiem.
- Frontend bez bundlera, moduły ES; logika bez DOM w `web/js/core/`, cienkie widoki w `web/js/ui/`.
- Nowy kod pisz w stylu otoczenia (nazewnictwo, gęstość komentarzy) i dodawaj do niego testy.

## Dodatkowo dla agentów AI

- Przed pracą: `git switch dev && git pull`, potem własna gałąź (`feature/`, `fix/`, `docs/`). Nigdy nie pracuj na `dev` ani `main`.
- Commituj tylko na prośbę użytkownika. Nie rób `push`, nie otwieraj ani nie scalaj PR-ów bez jego wyraźnej zgody.
- Nie używaj `--force`, `--no-verify`, `reset --hard` ani nie kasuj gałęzi bez wyraźnej zgody.
- Zmieniaj tylko to, o co poproszono. Zauważone niepowiązane problemy zgłoś, nie naprawiaj ich przy okazji.
- Uruchom `npm run lint` i `npm test` (oraz `npm run test:py`, gdy ruszasz Pythona) i zgłaszaj wyniki zgodnie z prawdą, także nieudane.
- Testy E2E uruchamiaj, gdy zmiana dotyka interfejsu; nie twórz testów zależnych od mikrofonu, sieci ani kluczy API.
- Nie dotykaj ani nie commituj `sessions.json`, `chrome-profile/`, `dist/`, `coverage/`, sekretów.
- Gdy zmiana zmienia zachowanie opisane w README, zaktualizuj README w tym samym PR-ze.
