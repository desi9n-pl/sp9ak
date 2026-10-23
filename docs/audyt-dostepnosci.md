# Audyt dostępności cyfrowej sp9ak

Stan na 2026-10-23, gałąź `dev` (`57d0a3b`). Odniesienie: WCAG 2.2 poziom AA oraz PN-EN 301 549.

Audyt jest **statyczny**: przejrzano `web/index.html`, `web/css/*`, `web/js/ui/*`, a kontrasty policzono ze zmiennych w `web/css/theme.css`. Nie testowano z czytnikiem ekranu (NVDA, Orca) ani z dyktowaniem głosowym systemu. Pozycje oznaczone „do sprawdzenia" wymagają takiego testu na żywo.

Aplikacja jest narzędziem dla osób, które nie mogą lub nie chcą pisać na klawiaturze (dyktowanie głosem). Dla części osób z niepełnosprawnościami ruchu jest więc z założenia pomocna. Obecnie jednak sama jest trudna lub niemożliwa do obsłużenia przez osoby niewidome, słabowidzące i niekorzystające z myszy.

## Podsumowanie

| Priorytet | Liczba | Znaczenie |
|-----------|--------|-----------|
| P1 – blokuje | 6 | użytkownik czytnika ekranu lub samej klawiatury nie wykona zadania |
| P2 – utrudnia | 6 | zadanie wykonalne, ale z trudem lub bez informacji zwrotnej |
| P3 – dopracowanie | 4 | zgodność i komfort |

Co jest dobrze: `lang="pl"`, `role="status"` z `aria-live` na toaście, `aria-pressed` na przycisku PIN, atrybut `[hidden]` poprawnie wymuszony w CSS, skróty klawiszowe z blokadą powtarzania, wszystkie główne akcje na prawdziwych `<button>`, kontrast tekstu podstawowego 11,6 do 17:1 we wszystkich motywach.

## P1 – blokuje

### 1. Brak widocznego fokusu klawiatury
`css/editor.css:44` i `css/panels.css:85` zdejmują `outline: none` (zostaje tylko zmiana koloru ramki), a dla przycisków, chipów i wierszy historii nie ma żadnego stylu `:focus-visible`. Przy nawigacji Tab nie widać, gdzie jest fokus (WCAG 2.4.7, 2.4.11).
**Poprawka:** globalna reguła `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`, bez zdejmowania obrysu na polach.

### 2. Chipy ✦, Aa i PL to `<span>` – nieosiągalne z klawiatury
`index.html:259-261` (`punctToggle`, `loudToggle`, `langToggle`): zwykłe `<span>` z `click`, bez `tabindex`, roli i stanu. Przełączenia interpunkcji, głośności i języka dyktowania nie da się wykonać bez myszy ani czytnikiem (WCAG 2.1.1, 4.1.2). Język rozpoznawania to rdzeń aplikacji.
**Poprawka:** zmienić na `<button type="button">` z `aria-pressed` (✦, Aa) oraz `aria-label` w rodzaju „Język rozpoznawania: polski" dla przełącznika PL/EN. Klasa `.lang-chip` zostaje, trzeba tylko zniwelować domyślne style przycisku.

### 3. Przyciski tylko z ikoną bez nazwy dostępnej
Przyciski `historyBtn`, `settingsBtn`, `logsBtn`, `semanticBtn`, `pinBtn` mają tylko `title` i SVG. `title` nie jest wiarygodną nazwą dostępną (nie działa na dotyku ani z klawiatury, część czytników go pomija). `modal-close` i `sess-del` mają znaki „✕" i „×", które czytnik odczyta jako „znak mnożenia".
**Poprawka:** `aria-label` na każdym przycisku z ikoną, `aria-hidden="true"` na dekoracyjnych SVG.

### 4. Lista historii obsługiwana tylko myszą
`js/ui/history-view.js:#item` tworzy `<div class="sess-item">` z `click`. Wczytanie dawnej sesji jest niedostępne z klawiatury i czytnika.
**Poprawka:** element główny jako `<button>` (lub `<li>` z przyciskiem w środku), przycisk usuwania jako rodzeństwo, nie potomek. Dodać `aria-label` z datą i początkiem tekstu.

### 5. Korekta semantyczna tylko myszą
`js/ui/semantic-view.js:#onContentClick`: akceptacja sugestii to kliknięcie w `<span>` z zielonym tłem. Poza klawiaturą kłopotem jest też kolor jako jedyny nośnik znaczenia (czerwony/zielony, WCAG 1.4.1).
**Poprawka:** sugestie jako przyciski przełączające (`aria-pressed`), z dodatkowym znacznikiem tekstowym lub ikoną, nie tylko kolorem. Zdanie „kliknij zieloną sugestię" w `panel-title` zamienić na neutralne („wybierz sugestię").

### 6. Okno instalacji (modal) nie jest oknem dialogowym
`index.html:99`: brak `role="dialog"`, `aria-modal`, `aria-labelledby`, przeniesienia fokusu do środka, pułapki fokusu i zamknięcia klawiszem Esc, a po zamknięciu fokus nie wraca na przycisk. Użytkownik czytnika nie dowie się, że okno się otworzyło (WCAG 2.1.2, 4.1.2, 2.4.3).
**Poprawka:** użyć natywnego `<dialog>` z `showModal()` (pułapka fokusu i Esc za darmo) albo dopisać to ręcznie. `shortcuts.js` obsługuje już Esc przez `dismiss`, więc trzeba tam uwzględnić modal.

## P2 – utrudnia

### 7. Zmiany stanu nie są ogłaszane
Pasek stanu (`#msg`: „Gotowy", „Nasłuchuję…", „Sprawdzam…", błędy) nie ma `role="status"`. Użytkownik czytnika nie dowie się, że dyktowanie ruszyło lub padło (WCAG 4.1.3). Podobnie: wyniki korekty AI w `#corrected`, treść paneli, pojawienie się „Brak podejrzanych słów ✓".
**Poprawka:** `role="status"` (grzecznie) na `#msg`; `role="alert"` tylko dla błędów. Przycisk Dyktuj dostaje `aria-pressed` zamiast samej zmiany etykiety i koloru.

### 8. Pola formularza bez etykiet
W panelu ustawień (`index.html`, wiersze `themes-row`): `<select>`, pola modelu i klucza API mają tylko `placeholder`; teksty „Zewn. AI:" i „Motyw:" to `<span>`, niepowiązane z kontrolkami. Placeholder znika po wpisaniu i nie zastępuje etykiety (WCAG 1.3.1, 3.3.2). Pole klucza warto też opatrzyć `autocomplete="off"`.
**Poprawka:** `<label for=…>` lub `aria-label`, grupy w `<fieldset>/<legend>` lub `role="group"` z `aria-labelledby`. Przyciski motywów: `aria-pressed` zamiast samej klasy `.active`.

### 9. Kontrast tekstu pomocniczego i elementów interfejsu
Obliczone ze zmiennych motywów (próg AA: 4,5:1 dla tekstu, 3:1 dla elementów graficznych):

| Motyw | `--muted` na tle | `--faint` na tle | `--accent` na tle |
|-------|------------------|------------------|-------------------|
| ciemny | 4,0 ✗ | 2,5 ✗ | 3,0 (tekst ✗, element ✓) |
| jasny | 4,6 ✓ | 2,4 ✗ | 6,0 ✓ |
| sepia (domyślny) | 4,1 ✗ | 2,2 ✗ | 5,4 ✓ |

`--muted` jest użyty do nagłówków paneli i etykiet, `--faint` do czasu sesji, pustych stanów i przycisku zamknięcia – wszędzie przy małych krojach (9–11 px). Po stronie dobrej: białe na `--accent` ma 6,1 do 6,3:1 we wszystkich motywach.
**Poprawka:** przyciemnić `--muted` i `--faint` tak, by dawały co najmniej 4,5:1 na `--bg` i `--surface` w każdym motywie. Dodać wyższy kontrast jako czwarty motyw lub obsłużyć `prefers-contrast: more`.

### 10. Bardzo małe czcionki i stałe jednostki
Rozmiary 9–13 px w `px` (`css/controls.css:51,76`, `css/editor.css:19`, `css/panels.css:124`, `css/base.css:73`). Etykiety „Oryginał" i „Tekst po korekcie AI" mają 10 px. `body` ma `height: 100vh` i `overflow: hidden`, więc przy powiększeniu tekstu lub 200% zoomu treść zostaje przycięta bez przewijania (WCAG 1.4.4, 1.4.10).
**Poprawka:** jednostki `rem`, minimum około 12 px dla tekstu pomocniczego, `overflow: auto` lub `min-height` zamiast sztywnego `100vh`; test przy zoomie 200% i szerokości 320 px. Pomocny będzie test układu z gremlins.js (w przygotowaniu na osobnej gałęzi), który wykrywa przewijanie poziome.

### 11. Cele dotykowe i kliknięcia
Przyciski `btn-tiny` (PIN) mają 22 px, `btn-bare` (zamknięcie, usuwanie) około 20 px, `btn-ghost` około 22 px. WCAG 2.2 (2.5.8) wymaga minimum 24×24 px, zalecane 44×44 px, co dla osób z drżeniem rąk lub sterowaniem głową jest istotne.
**Poprawka:** zwiększyć pole klikalne do 24 px (docelowo 32–44) bez powiększania ikony.

### 12. Skróty klawiszowe bez możliwości wyłączenia
Ctrl+D, Ctrl+N, Ctrl+C (bez zaznaczenia), Ctrl+S są przechwytywane globalnie. Ctrl+C bez zaznaczenia kopiuje całość, co zaskakuje. Skróty ze znakiem + modyfikatorem są dopuszczalne (WCAG 2.1.4 dotyczy skrótów jednoznakowych), ale kolidują ze skrótami czytników i programów do dyktowania głosowego (np. Dragon, Voice Access).
**Poprawka:** opisać skróty w pomocy, dodać `aria-keyshortcuts` na przyciskach, rozważyć opcję wyłączenia lub zmiany skrótów.

## P3 – dopracowanie

13. **Ruch i animacje:** `typing-dots` oraz `waveform` animują się bez względu na ustawienie systemu. Dodać `@media (prefers-reduced-motion: reduce)` (WCAG 2.3.3) i wyłączyć przejścia.
14. **Pasek fali dźwięku (`<canvas id="waveform">`)** jest całkowicie niewidoczny dla czytnika. Oznaczyć `aria-hidden="true"` (informację o nasłuchiwaniu niesie już status).
15. **Układ semantyczny:** brak `<main>`, nagłówków `<h1>`, landmarków (`<header>`, `<nav>` dla paska). Panele (`.panel`) bez `role="region"` i `aria-label`. Przycisk otwierający panel bez `aria-expanded` i `aria-controls`.
16. **Skłonność do `confirm()`:** „Wyczyść wszystkie" używa natywnego okna `confirm`, które jest dostępne, ale blokuje i nie da się go ostylować. Do rozważenia zastąpienie własnym dialogiem po wdrożeniu punktu 6.

## Funkcje wspierające osoby z niepełnosprawnościami (propozycje)

To nie błędy, lecz możliwości, które wynikają z natury aplikacji.

1. **Sterowanie głosem poza dyktowaniem tekstu.** Komendy typu „nowa linia", „kropka", „kasuj ostatnie zdanie", „kopiuj", „nowa notatka" pozwalają w całości obsłużyć aplikację bez rąk. Obecnie w kodzie nie ma komend głosowych (✦ tylko dodaje interpunkcję automatycznie), więc to nowa funkcja.
2. **Odczyt na głos (TTS).** Przycisk „Przeczytaj" przez `speechSynthesis` dla tekstu po korekcie; pomaga osobom niewidomym i z dysleksją sprawdzić efekt.
3. **Ustawienia czytelności:** rozmiar czcionki edytora, odstęp wierszy, czcionka przyjazna dysleksji, motyw wysokiego kontrastu (patrz punkt 9).
4. **Informacja zwrotna nie tylko wzrokowa:** opcjonalny dźwięk lub wibracja przy starcie i końcu dyktowania, dla osób niedowidzących; z kolei dla niesłyszących pełne napisy stanu (już są w pasku).
5. **Tryb jednego przełącznika / duże cele:** powiększony układ z dużymi przyciskami dla osób z ograniczoną sprawnością rąk.
6. **Dla osób niesłyszących i niedosłyszących:** aplikacja już zamienia mowę na tekst; warto opisać w README ten scenariusz użycia (np. zapis rozmowy).

## Proponowana kolejność prac

Każdy punkt to osobny branch `feature/` lub `fix/` i osobny PR do `dev`, zgodnie z `AGENTS.md`.

1. `fix/a11y-focus-and-names`: pkt 1, 3, 14 (CSS i atrybuty, bez zmian logiki).
2. `fix/a11y-chips-and-history`: pkt 2, 4, 5 (zmiana elementów na przyciski, testy jednostkowe i E2E klawiaturą).
3. `fix/a11y-dialog`: pkt 6, 16.
4. `fix/a11y-announcements-labels`: pkt 7, 8, 15.
5. `fix/a11y-contrast-and-sizes`: pkt 9, 10, 11, 13.
6. `feature/a11y-voice-commands-tts`: propozycje 1 i 2 po ustaleniu zakresu.

## Jak to weryfikować na stałe

- Dodać do `tests/e2e/` scenariusz „tylko klawiatura": Tab przechodzi przez wszystkie kontrolki w sensownej kolejności, każda ma nazwę dostępną i widoczny fokus.
- Dodać `@axe-core/playwright` jako zależność deweloperską i sprawdzać stronę w trzech motywach (wykrywa m.in. kontrast i brakujące etykiety). To nowa zależność, więc wymaga zgody właściciela repozytorium.
- Ręczny test z Orca (Linux) i NVDA (Windows) przed każdym wydaniem.
