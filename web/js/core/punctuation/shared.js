/** Language-independent building blocks of the rule-based punctuation: each pass takes text and the rules of one language. */

const WORD = '[\\p{L}\\d-]+';
// a character that already ends a clause, so nothing is inserted behind it
const MARK = ',;:.!?–—';

export const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest alternatives first so "dlatego że" wins over "dlatego" in a single pass.
const alternatives = phrases => [...phrases].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');

const wordCount = text => text.split(/\s+/).filter(Boolean).length;

/** "word1 word2" -> "word1, word2" before every listed conjunction. */
export function addConjunctionCommas(text, conjunctions) {
    const re = new RegExp(`([^\\s${MARK}])\\s+(${alternatives(conjunctions)})(?=\\s|$)`, 'giu');
    return text.replace(re, (_, before, word) => `${before}, ${word}`);
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
    return text.split(/(?<=[.!?])\s+/).map(sentence => {
        const match = re.exec(sentence);
        re.lastIndex = 0;
        if (!match || sentence.slice(0, match.index).includes(';')) return sentence;
        const before = sentence.slice(0, match.index);
        if (wordCount(before) < minWords || /[,;:–—]$/.test(before)) return sentence;
        const after = sentence.slice(match.index + match[0].length);
        const link = match[1];
        return `${before}; ${link}${commaAfter && !after.startsWith(',') ? ',' : ''}${after}`;
    }).join(' ');
}

/** A dash before phrases that restate or explain what was just said ("czyli", "that is"). */
export function addDashes(text, { phrases, dash }) {
    const re = new RegExp(`([^\\s${MARK}])\\s+(${alternatives(phrases)})(?=\\s|$)`, 'giu');
    return text.replace(re, (_, before, phrase) => `${before}${dash}${phrase}`);
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
    return capitalized.replace(/([.!?][ \u00a0]+)(\p{Ll})/gu, (_, end, letter) => end + letter.toUpperCase());
}

/**
 * Closing mark for a sentence that has none: a question mark when it opens like a question.
 * A lone statement gets no full stop: it is usually a title or a sentence fragment.
 */
export function closeSentence(text, questionStart) {
    if (/[.!?,;:]$/.test(text)) return text;
    if (questionStart.test(text)) return `${text}?`;
    return /[.!?]/.test(text) ? `${text}.` : text;
}
