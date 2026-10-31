import { EN } from './en.js';
import { PL } from './pl.js';
import {
    addConjunctionCommas, addCorrelativeCommas, addDashes, addEnumerationCommas, addIntroCommas, addQuestionCommas, addSemicolons,
    capitalizeSentences, closeSentence, dropStutter, fixSpelling, tidySpacing,
} from './shared.js';

const RULES = { pl: PL, en: EN };

/** Rules for a recognition language tag such as "pl-PL" or "en-US"; Polish when the language is unknown. */
export function rulesFor(language) {
    return RULES[String(language ?? '').slice(0, 2).toLowerCase()] ?? PL;
}

/** Fixes common recognizer slips, adds commas, semicolons, dashes, a closing mark and sentence capitals according to the language's rules. */
export function punctuate(text, language = 'pl-PL') {
    const rules = rulesFor(language);
    let t = text.trim();
    if (!t) return t;
    t = t.replace(/[ \t]{2,}/g, ' ');
    t = dropStutter(fixSpelling(t, rules.spelling), rules.stutterWords);
    t = addIntroCommas(t, rules.introPhrases);
    t = addCorrelativeCommas(t, rules.correlatives);
    t = addEnumerationCommas(t, rules.enumeration);
    t = addSemicolons(t, rules.semicolons);
    t = addDashes(t, rules.dashes);
    t = addConjunctionCommas(addQuestionCommas(t, rules.questionLeads), rules.conjunctions, rules.noCommaBefore);
    t = tidySpacing(t);
    return capitalizeSentences(closeSentence(t, rules.questionStart));
}

export { capitalizeSentences };
