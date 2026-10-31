import { describe, expect, it } from 'vitest';
import { punctuate } from '../../../../web/js/core/punctuation/index.js';
import { SPELLING, STUTTER_WORDS } from '../../../../web/js/core/punctuation/pl.js';
import { dropStutter, fixSpelling } from '../../../../web/js/core/punctuation/shared.js';

describe('fixSpelling', () => {
    it.each([
        ['to wogóle nie działa', 'to w ogóle nie działa'],
        ['zrobię to poprostu', 'zrobię to po prostu'],
        ['narazie nie wiem', 'na razie nie wiem'],
        ['z resztą tak było', 'zresztą tak było'],
    ])('splits or joins the words: %s', (input, expected) => {
        expect(fixSpelling(input, SPELLING)).toBe(expected);
    });

    it('keeps a leading capital', () => {
        expect(fixSpelling('Wogóle tego nie ma', SPELLING)).toBe('W ogóle tego nie ma');
    });

    it('touches only whole words', () => {
        expect(fixSpelling('poprostuj zapozatym', SPELLING)).toBe('poprostuj zapozatym');
        expect(fixSpelling('wogólem', SPELLING)).toBe('wogólem');
    });

    it('does nothing without pairs', () => {
        expect(fixSpelling('wogóle', [])).toBe('wogóle');
    });
});

describe('dropStutter', () => {
    it.each([
        ['kupiłem chleb i i masło', 'kupiłem chleb i masło'],
        ['byłem w w sklepie', 'byłem w sklepie'],
        ['On powiedział że że przyjdzie', 'On powiedział że przyjdzie'],
    ])('keeps a doubled function word once: %s', (input, expected) => {
        expect(dropStutter(input, STUTTER_WORDS)).toBe(expected);
    });

    it('leaves repeats that may be intended', () => {
        expect(dropStutter('nie nie wiem', STUTTER_WORDS)).toBe('nie nie wiem');
        expect(dropStutter('to to jest to', STUTTER_WORDS)).toBe('to to jest to');
    });

    it('does not join parts of longer words', () => {
        expect(dropStutter('ona na nana', STUTTER_WORDS)).toBe('ona na nana');
    });
});

describe('punctuate with spelling rules', () => {
    it('fixes Polish slips before punctuating', () => {
        expect(punctuate('poprostu nie wiem i i nie chcę')).toBe('Po prostu nie wiem i nie chcę');
    });

    it('does not apply Polish fixes to English', () => {
        expect(punctuate('poprostu i i', 'en-US')).toBe('Poprostu i i');
    });
});
