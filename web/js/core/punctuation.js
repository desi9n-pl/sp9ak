/** Rule-based Polish punctuation for dictated text (no model needed). */

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

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest alternatives first so "dlatego że" wins over "dlatego" in a single pass.
const CONJUNCTION_RE = new RegExp(
    `([^\\s,;:.!?])\\s+(${[...CONJUNCTIONS].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?=\\s|$)`,
    'gi',
);

const INTRO_RES = INTRO_PHRASES.map(
    phrase => new RegExp(`(^|[.!?][ \\t]+)(${escapeRegExp(phrase)})([ \\t])`, 'gi'),
);

function addIntroCommas(text) {
    return INTRO_RES.reduce((t, re) => t.replace(re, (_, before, phrase, space) => `${before}${phrase},${space}`), text);
}

function addCorrelativeCommas(text) {
    return text
        .replace(/\bzarówno([^,!?.;\n]{1,80}?)\s+(jak i)\b/gi, 'zarówno$1, $2')
        .replace(/\bani([^,!?.;\n]{1,60}?)\s+(ani)\b/gi, 'ani$1, $2');
}

function tidySpacing(text) {
    return text
        .replace(/,{2,}/g, ',')
        .replace(/[ \t]+([,;:.!?])/g, '$1')
        .replace(/,\s*([.!?])/g, '$1');
}

export function capitalizeSentences(text) {
    if (!text) return text;
    const capitalized = text[0].toUpperCase() + text.slice(1);
    return capitalized.replace(/([.!?][ \u00a0]+)([a-ząćęłńóśźż])/g, (_, end, letter) => end + letter.toUpperCase());
}

/** Adds commas before conjunctions, a closing mark, and sentence capitals. */
export function punctuate(text) {
    let t = text.trim();
    if (!t) return t;
    t = t.replace(/[ \t]{2,}/g, ' ');
    t = addIntroCommas(t);
    t = addCorrelativeCommas(t);
    t = t.replace(CONJUNCTION_RE, (_, before, word) => `${before}, ${word}`);
    t = tidySpacing(t);
    if (!/[.!?,;:]$/.test(t)) t += QUESTION_START.test(t) ? '?' : '.';
    return capitalizeSentences(t);
}
