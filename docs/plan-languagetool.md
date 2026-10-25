# Plan: sprawdzanie polszczyzny przez LanguageTool

Status: plan, nic niezaimplementowane. Stan na 2026-10-25.

## Cel

Dodać korektę ortografii i gramatyki opartą na otwartych danych, działającą offline,
jako uzupełnienie obecnej interpunkcji regułowej (`web/js/core/punctuation/`)
i przeglądu semantycznego przez AI (`web/js/ui/semantic-view.js`).

## Co ustaliliśmy (do potwierdzenia w spike)

- **Wtyczka w PhpStorm.** Grazie używała LanguageTool i wspierała polski, ale starsze repozytorium
  jest zarchiwizowane, a od wydań 2025.3 Grazie jest częścią IDE (wtyczka Natural Languages).
  JetBrains wymienia „instant proofreading" tylko dla angielskiego, niemieckiego, rosyjskiego
  i ukraińskiego, więc polski może być słabo obsłużony. To jest narzędzie dla IDE, nie biblioteka
  do użycia w sp9ak, więc źródłem danych jest sam LanguageTool.
- **LanguageTool** jest na licencji LGPL 2.1+. Ma serwer HTTP z endpointem `/v2/check`
  (pola `language`, `text`) i oficjalne obrazy/pakiety do uruchomienia lokalnie.
- **Słownik polski.** PoliMorf jest na 2-clause BSD. LanguageTool dla polskiego korzysta ze
  słowników morfologicznych w formacie Morfologik. Dokładna licencja plików słownika w repozytorium
  LanguageTool nie została potwierdzona i może różnić się od licencji kodu.

## Do rozstrzygnięcia przed kodem

1. **Licencje.** Sprawdzić pliki licencji i metadane w `languagetool-language-modules/pl`
   (reguły XML i słownik). Ustalić, czy wolno nam coś kopiować, czy tylko wywoływać serwer.
2. **Jakość.** Spike: 30–50 realnych dyktowanych tekstów, porównanie z Gemini Nano i Claude.
   Interesuje nas liczba trafień i fałszywych alarmów. Dyktowanie z Web Speech zwykle nie ma literówek,
   za to ma błędy słuchowe (homofony, brak polskich znaków w nazwach własnych), więc mogło się okazać,
   że reguły ortograficzne mało dają, a przydają się reguły gramatyczne.
3. **Zasób.** LanguageTool to JVM; sprawdzić zużycie pamięci przy starcie i czas odpowiedzi.
4. **CORS.** Nie potwierdzone, czy serwer wystawia nagłówki CORS. Rozwiązanie niezależne od tego:
   proxy w `server/app.py`, jak dla Claude/OpenAI w `server/ai_providers.py`.

## Warianty integracji

| Wariant | Zalety | Wady |
|---|---|---|
| A. Opcjonalny lokalny serwer LanguageTool + proxy w `server/` | pełne reguły, offline, mały kod po naszej stronie | wymaga Javy i osobnej instalacji; musi być opcjonalny (zasada: działa po `./sp9ak.sh`) |
| B. Publiczne API LanguageTool | zero instalacji | tekst wychodzi do chmury, sprzeczne z „offline"; limity |
| C. Przepisanie wybranych reguł do `core/punctuation/pl.js` | brak zależności, szybkie | trzeba utrzymywać; zależne od licencji (pkt 1) |
| D. Hunspell `pl_PL` (tylko ortografia) | lekki | bez gramatyki |

Rekomendacja robocza: A jako dodatek, C dla kilku najpewniejszych reguł, jeśli licencje pozwolą.

## Szkic wdrożenia (wariant A)

1. `server/languagetool.py`: klient `POST /v2/check`, adres z konfiguracji (domyślnie `http://localhost:8081`),
   krótki timeout, błędy jako `ProviderError`. Endpoint `/api/grammar` w `server/app.py`.
2. `web/js/core/grammar.js` (bez DOM): zamiana odpowiedzi (`matches[]` z `offset`, `length`, `replacements`)
   na segmenty w formacie, który już zna `parseSemanticResponse`/`buildSemanticText`, żeby panel przeglądu
   mógł pokazać sugestie bez nowego widoku.
3. `web/js/services/grammar.js`: wywołanie proxy, wykrycie dostępności (jak `ai.canReview()`).
4. Ujęcie w `semantic-view.js`: sugestie LanguageTool obok sugestii AI, bez duplikatów po nakładających się zakresach.
5. Ustawienia: włącznik i adres serwera; brak serwera = funkcja niewidoczna, bez błędów.
6. `packaging/`: tylko wzmianka w opisie pakietu (zależność `Suggests`, nie `Depends`).
7. README: sekcja o instalacji i uruchomieniu LanguageTool.

## Testy

- Jednostkowe (vitest): parser odpowiedzi, łączenie z sugestiami AI, brak serwera.
- Python: klient i endpoint z podstawionym serwerem (bez sieci).
- Bez testów zależnych od prawdziwego LanguageTool, mikrofonu ani kluczy.

## Kolejność

1. Gałąź `docs/` (ten plan) → PR do `dev`.
2. Spike jakości i licencji (wynik do tego pliku).
3. Decyzja o wariancie.
4. `feature/languagetool-grammar` z commitami wg szkicu powyżej.

## Źródła

- [LanguageTool (Wikipedia)](https://en.wikipedia.org/wiki/LanguageTool)
- [PoliMorf](https://zil.ipipan.waw.pl/PoliMorf)
- [Grazi (archiwum)](https://github.com/tanvd/grazi)
- [JetBrains: Grazie w IDE od 2025.3](https://blog.jetbrains.com/grazie/2025/10/grazie-s-next-step-built-in-language-intelligence-for-your-ide/)
