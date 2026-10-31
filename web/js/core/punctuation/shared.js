/** Language-independent building blocks of the rule-based punctuation: each pass takes text and the rules of one language. */

const WORD = '[\\p{L}\\d-]+';
// a character that already ends a clause, so nothing is inserted behind it
const MARK = ',;:.!?–—';

export const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest alternatives first so "dlatego że" wins over "dlatego" in a single pass.
const alternatives = phrases => [...phrases].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');

const wordCount = text => text.split(/\s+/).filter(Boolean).length;

/** "word1 word2" -> "word1, word2" before every listed conjunction. */
export function addConjunctionCommas(text, conjunctions, except) {
    const re = new RegExp(`([^\\s${MARK}])\\s+(${alternatives(conjunctions)})(?=\\s|$)`, 'giu');
    return text.replace(re, (match, before, word, offset) =>
        (except?.test(text.slice(offset + match.length - word.length)) ? match : `${before}, ${word}`));
}

/** "nie wiem czy" -> "nie wiem, czy": an embedded question after a verb or noun that asks or doubts. */
export function addQuestionCommas(text, leads) {
    if (!leads.length) return text;
    const re = new RegExp(`${LEFT}(${alternatives(leads)})\\s+(czy)${RIGHT}`, 'giu');
    return text.replace(re, '$1, $2');
}

/** Introductory phrases get a comma when they open a sentence. */
export function addIntroCommas(text, phrases) {
    return phrases.reduce((t, phrase) => t.replace(
        new RegExp(`(^|[.!?][ \\t]+)(${escapeRegExp(phrase)})([ \\t])`, 'giu'),
        (_, before, found, space) => `${before}${found},${space}`,
    ), text);
}

/** Paired conjunctions ("zarówno … jak i", "ani … ani") get a comma before the second half. */
export function addCorrelativeCommas(text, pairs) {
    return pairs.reduce((t, [first, second, span]) => t.replace(
        new RegExp(`\\b${escapeRegExp(first)}([^,!?.;\\n]{1,${span}}?)\\s+(${escapeRegExp(second)})\\b`, 'giu'),
        `${first}$1, $2`,
    ), text);
}

/**
 * Enumerations: after a cue ("takie jak", "such as") a run of single words closed by "i" / "and"
 * becomes a comma list. Only runs of three or more items are touched, since two words may be one name.
 */
export function addEnumerationCommas(text, { cues, joiners }) {
    const re = new RegExp(
        `(${alternatives(cues)})\\s+((?:${WORD}\\s+){2,}?)(${alternatives(joiners)})\\s+(${WORD})`,
        'giu',
    );
    return text.replace(re, (_, cue, run, joiner, last) => {
        const items = run.trim().split(/\s+/).join(', ');
        return `${cue} ${items} ${joiner} ${last}`;
    });
}

/**
 * Semicolon before a contrasting or additive link ("jednak", "however") that opens a second, long
 * enough clause. Short clauses keep the plain comma of the conjunction pass.
 */
export function addSemicolons(text, { links, minWords, commaAfter }) {
    const re = new RegExp(`\\s+(${alternatives(links)})(?=\\s|$)`, 'giu');
    // the capture group keeps the separators, so a line break after a full stop survives
    return text.split(/(?<=[.!?])(\s+)/).map((sentence, i) => {
        if (i % 2) return sentence;
        const match = re.exec(sentence);
        re.lastIndex = 0;
        if (!match || sentence.slice(0, match.index).includes(';')) return sentence;
        const before = sentence.slice(0, match.index);
        if (wordCount(before) < minWords || /[,;:–—]$/.test(before)) return sentence;
        const after = sentence.slice(match.index + match[0].length);
        const link = match[1];
        return `${before}; ${link}${commaAfter && !after.startsWith(',') ? ',' : ''}${after}`;
    }).join('');
}

/** A dash before phrases that restate or explain what was just said ("czyli", "that is"). */
export function addDashes(text, { phrases, dash }) {
    const re = new RegExp(`([^\\s${MARK}])\\s+(${alternatives(phrases)})(?=\\s|$)`, 'giu');
    return text.replace(re, (_, before, phrase) => `${before}${dash}${phrase}`);
}

// a word boundary that also holds for letters with diacritics, which \b does not
const LEFT = '(?<![\\p{L}\\d])';
const RIGHT = '(?![\\p{L}\\d])';

const keepCase = (found, fixed) => (found[0] !== found[0].toLowerCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed);

/** Words the recognizer glues together or splits wrongly: [wrong, right] pairs, matched whole-word and case-insensitively. */
export function fixSpelling(text, pairs) {
    if (!pairs.length) return text;
    const re = new RegExp(`${LEFT}(${alternatives(pairs.map(([wrong]) => wrong))})${RIGHT}`, 'giu');
    const fixes = new Map(pairs.map(([wrong, right]) => [wrong, right]));
    return text.replace(re, found => keepCase(found, fixes.get(found.toLowerCase())));
}

/** A function word the recognizer stuttered ("i i", "w w") is kept once. Content words may repeat on purpose. */
export function dropStutter(text, words) {
    if (!words.length) return text;
    const re = new RegExp(`${LEFT}(${alternatives(words)})\\s+\\1${RIGHT}`, 'giu');
    return text.replace(re, '$1');
}

export function tidySpacing(text) {
    return text
        .replace(/,{2,}/g, ',')
        .replace(/[ \t]+([,;:.!?])/g, '$1')
        .replace(/,\s*([.!?])/g, '$1');
}

export function capitalizeSentences(text) {
    if (!text) return text;
    const capitalized = text[0].toUpperCase() + text.slice(1);
    // a line break opens a new sentence just like a full stop does
    return capitalized.replace(/([.!?][ \u00a0]+|\n[ \t\u00a0]*)(\p{Ll})/gu, (_, end, letter) => end + letter.toUpperCase());
}

/**
 * Closing mark for a sentence that has none: a question mark when it opens like a question.
 * A lone statement gets no full stop: it is usually a title or a sentence fragment.
 */
export function closeSentence(text, questionStart) {
    if (/[.!?,;:]$/.test(text)) return text;
    // only the last sentence decides: "mam pytanie. czy możemy się spotkać" ends in a question mark
    if (questionStart.test(text.split(/[.!?]\s+/).pop())) return `${text}?`;
    return /[.!?]/.test(text) ? `${text}.` : text;
}
