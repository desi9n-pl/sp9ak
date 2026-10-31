/** English rules: comma, semicolon, dash and list punctuation for dictated text. */

// Coordinating and relative links that take a comma. "that" and "because" are left out on purpose:
// English normally writes them without one.
export const CONJUNCTIONS = [
    'but', 'yet', 'whereas', 'although', 'though', 'even though', 'which', 'unless',
    'while', 'whenever', 'if only', 'so that',
];

export const INTRO_PHRASES = [
    'however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'meanwhile',
    'for example', 'for instance', 'in addition', 'in fact', 'in short', 'in other words',
    'on the other hand', 'of course', 'by the way', 'as a result', 'in conclusion',
    'unfortunately', 'fortunately', 'actually', 'basically', 'honestly', 'frankly',
    'first', 'second', 'third', 'finally',
];

const QUESTION_START = /^(do|does|did|is|are|was|were|am|can|could|will|would|should|shall|may|might|have|has|who|whom|whose|what|where|when|why|how|which)\b/i;

// After a long enough clause these take a semicolon before and a comma after: "…; however, …".
export const SEMICOLON_LINKS = ['however', 'moreover', 'furthermore', 'therefore', 'nevertheless', 'meanwhile', 'consequently'];

// Phrases that restate what was just said; an unspaced em dash sets the explanation apart.
export const DASH_PHRASES = ['that is', 'in other words', 'namely'];

export const ENUMERATION = {
    cues: ['such as', 'including', 'for example', 'for instance', 'like', 'the following'],
    joiners: ['and', 'or'],
};

export const EN = {
    questionLeads: [],
    spelling: [],
    stutterWords: [],
    conjunctions: CONJUNCTIONS,
    introPhrases: INTRO_PHRASES,
    correlatives: [],
    enumeration: ENUMERATION,
    semicolons: { links: SEMICOLON_LINKS, minWords: 6, commaAfter: true },
    dashes: { phrases: DASH_PHRASES, dash: '—' },
    questionStart: QUESTION_START,
};
