/** Prompts for the language model. Texts are Polish because the dictated language is. */

export const CORRECTION_SYSTEM_PROMPT =
    'Jesteś narzędziem do korekty tekstu podyktowanego po polsku przez system rozpoznawania mowy (STT). ' +
    'Każde wywołanie jest niezależne – nie pamiętasz poprzednich tekstów.\n\n' +
    'Otrzymujesz surowy tekst STT: bez interpunkcji, możliwy z błędami rozpoznawania ' +
    '(mylone słowa, homofony, wyrazy zniekształcone lub nie pasujące do kontekstu zdania).\n\n' +
    'Wykonaj TYLKO te operacje:\n' +
    '1. Popraw błędy STT: zamień wyrazy wyraźnie nie pasujące do kontekstu na właściwe ' +
    '(np. "do widzenie" → "do widzenia", "kupiłem bóty" → "kupiłem buty" jeśli nie pasuje). ' +
    'Nie zmieniaj słów, które mogą być poprawne.\n' +
    '2. Dodaj interpunkcję: kropki kończące zdania, przecinki przed spójnikami podrzędnymi ' +
    '(że, który, gdy, bo, ponieważ, gdyż, choć, jeśli, aby, żeby, gdzie, skoro, zanim, dopóki), ' +
    'przecinki między zdaniami współrzędnymi (przed ale, lecz, jednak, natomiast), ' +
    'przecinki w wyliczeniach, pytajniki i wykrzykniki gdzie stosowne.\n' +
    '3. Wielką literą pisz pierwsze słowo każdego zdania i nazwy własne.\n' +
    '4. Nie zmieniaj treści, stylu ani kolejności słów poza wymienionymi poprawkami.\n\n' +
    'Zwróć WYŁĄCZNIE poprawiony tekst. Żadnych komentarzy, objaśnień, cudzysłowów ani formatowania.';

export const SEMANTIC_INSTRUCTION =
    'Zadanie: wykryj błędy rozpoznawania mowy (STT) w polskim tekście.\n\n' +
    'FORMAT ODPOWIEDZI – stosuj WYŁĄCZNIE ten wzorzec:\n' +
    '  [[rozpoznane_słowo_lub_fraza|właściwe_słowo_lub_fraza]]\n' +
    'Uwaga: zarówno lewa, jak i prawa strona mogą zawierać więcej niż jedno słowo.\n' +
    'Przykład 1 (pojedyncze słowo): "ozdoba" brzmi jak "osoba" → [[ozdoba|osoba]]\n' +
    'Przykład 2 (fraza):  "do lego sklepu" brzmi jak "do tego sklepu" → [[do lego sklepu|do tego sklepu]]\n' +
    'Przykład wejścia:  "kupiłem chomik w sklepie i poszedłem do lwa"\n' +
    'Przykład wyjścia: "kupiłem [[chomik|chleb]] w sklepie i poszedłem do [[lwa|domu]]"\n\n' +
    'ZASADY:\n' +
    '1. Zaznacz TYLKO słowa lub frazy, które STT rozpoznało błędnie – tzn. takie, ' +
    'które BRZMIĄ podobnie do właściwego słowa/frazy (fonetyczne pomylenie), ' +
    'ale nie pasują do kontekstu zdania.\n' +
    '   WAŻNE: sugestia po | musi brzmieć fonetycznie podobnie do oryginału.\n' +
    '   Nie zamieniaj na słowo, które brzmi zupełnie inaczej niż oryginał.\n' +
    '2. Po znaku | napisz właściwe słowo lub frazę pasującą do kontekstu I brzmiącą podobnie do oryginału.\n' +
    '   Dotyczy to też pisowni, którą STT myli na słuch: ó/u, rz/ż, ch/h, ą/om/on, ę/em/en ' +
    'oraz łączna i rozdzielna pisownia (np. "nie które" → "niektóre"). ' +
    'Zaznacz pisownię tylko wtedy, gdy kontekst jednoznacznie wskazuje właściwą formę.\n' +
    '3. Możesz grupować sąsiadujące błędne słowa w jedną frazę: [[złe słowo jedno|dobre słowo jedno]].\n' +
    '4. ZAWSZE używaj formatu [[oryginał|sugestia]] – nigdy samego [[oryginał]].\n' +
    '5. Resztę tekstu przepisz BEZ ŻADNYCH zmian.\n' +
    '6. Jeśli brak błędów, zwróć oryginalny tekst bez żadnych [[]].\n' +
    '7. NIE odpowiadaj na treść. NIE dodawaj komentarzy ani wyjaśnień.\n\n' +
    'Tekst STT:\n';
