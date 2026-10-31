/** Polish rules: comma, semicolon, dash and list punctuation for dictated text. */

// Subordinating and coordinating conjunctions that are preceded by a comma.
export const CONJUNCTIONS = [
    'ale', 'jednak', 'lecz', 'natomiast', 'tymczasem', 'niemniej', 'wszelako',
    'ponieważ', 'bo', 'gdyż', 'bowiem', 'albowiem', 'dlatego że', 'przez to że',
    'żeby', 'aby', 'ażeby', 'że', 'iż', 'żeby nie',
    'który', 'która', 'które', 'którzy', 'których', 'któremu', 'którym', 'którą',
    'jeżeli', 'jeśli', 'skoro', 'gdyby', 'o ile',
    'gdy', 'kiedy', 'odkąd', 'dopóki', 'zanim', 'zaledwie', 'nim',
    'po tym jak', 'w chwili gdy', 'wtedy gdy',
    'choć', 'chociaż', 'aczkolwiek', 'jakkolwiek', 'mimo że', 'mimo iż', 'pomimo że',
    'więc', 'zatem', 'przeto', 'toteż', 'dlatego', 'stąd że',
    'gdzie', 'skąd', 'dokąd', 'jak', 'jakby', 'jakoby',
    'podczas gdy', 'jak tylko', 'chyba że', 'tak że', 'tak żeby',
    'takie jak', 'takich jak', 'taki jak', 'taka jak',
    'mimo to', 'pomimo to', 'pod warunkiem że', 'w miarę jak', 'skoro tylko',
];

// Introductory phrases followed by a comma when they open a sentence.
export const INTRO_PHRASES = [
    'ogólnie rzecz biorąc', 'nawiasem mówiąc', 'prawdę mówiąc',
    'szczerze mówiąc', 'mówiąc wprost', 'krótko mówiąc', 'jednym słowem',
    'innymi słowy', 'między innymi', 'na przykład', 'nota bene',
    'przede wszystkim', 'po pierwsze', 'po drugie', 'po trzecie',
    'po czwarte', 'po piąte',
    'co więcej', 'co ważne', 'co ciekawe', 'co gorsza', 'co gorsze',
    'oczywiście', 'niestety', 'owszem', 'otóż', 'mianowicie',
];

const QUESTION_START = /^(czy|kto|co|gdzie|kiedy|jak|dlaczego|ile|który|która|które|czemu|skąd|dokąd|po co|na ile)\b/i;

// Contrasting or additive links: after a long enough clause they take a semicolon instead of a comma.
export const SEMICOLON_LINKS = ['jednak', 'natomiast', 'tymczasem', 'niemniej', 'ponadto', 'zatem'];

// Phrases that restate what was just said; a dash sets the explanation apart.
export const DASH_PHRASES = ['czyli', 'to znaczy', 'inaczej mówiąc'];

export const ENUMERATION = {
    cues: ['takie jak', 'takich jak', 'taki jak', 'na przykład', 'między innymi', 'mianowicie', 'następujące', 'następujących'],
    joiners: ['i', 'oraz', 'lub', 'albo', 'czy'],
};

// Typical recognizer slips: words written together or apart against the spelling rules.
export const SPELLING = [
    ['wogóle', 'w ogóle'], ['poprostu', 'po prostu'], ['narazie', 'na razie'], ['napewno', 'na pewno'],
    ['conajmniej', 'co najmniej'], ['conajwyżej', 'co najwyżej'], ['wkońcu', 'w końcu'],
    ['przedewszystkim', 'przede wszystkim'], ['naprzykład', 'na przykład'], ['pozatym', 'poza tym'],
    ['z resztą', 'zresztą'], ['po za', 'poza'],
];

// Function words that dictation tends to double; "to to" or "nie nie" can be intended, so they stay out.
export const STUTTER_WORDS = ['i', 'w', 'z', 'na', 'do', 'że', 'się', 'o', 'po', 'za', 'od', 'ale'];

// Words that open an embedded question: "nie wiem, czy", "pytanie, czy".
export const QUESTION_LEADS = [
    'nie wiem', 'nie wiesz', 'nie wie', 'nie wiemy', 'nie wiecie', 'wiem', 'wiesz', 'wie', 'pytam', 'pytał', 'pytałem',
    'pytanie', 'sprawdź', 'sprawdzę', 'sprawdzić', 'zobacz', 'zobaczę', 'zobaczyć', 'zapytaj', 'zapytam', 'powiedz',
    'zastanawiam się', 'zastanawiasz się', 'zastanawiamy się', 'ciekawe', 'ciekawy jestem', 'nie jestem pewien',
    'nie jestem pewna', 'wątpię', 'nie pamiętam', 'pamiętasz',
];

// "jak najszybciej" is one adverb phrase, not a clause: no comma before the "jak".
export const NO_COMMA_BEFORE = /^jak\s+naj/iu;

export const PL = {
    questionLeads: QUESTION_LEADS,
    noCommaBefore: NO_COMMA_BEFORE,
    spelling: SPELLING,
    stutterWords: STUTTER_WORDS,
    conjunctions: CONJUNCTIONS,
    introPhrases: INTRO_PHRASES,
    // [first half, second half, longest gap between them]
    correlatives: [['zarówno', 'jak i', 80], ['ani', 'ani', 60]],
    enumeration: ENUMERATION,
    semicolons: { links: SEMICOLON_LINKS, minWords: 6, commaAfter: false },
    dashes: { phrases: DASH_PHRASES, dash: ' – ' },
    questionStart: QUESTION_START,
};
