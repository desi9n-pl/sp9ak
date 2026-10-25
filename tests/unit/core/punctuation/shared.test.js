import { describe, expect, it } from 'vitest';
import { punctuate, rulesFor } from '../../../../web/js/core/punctuation/index.js';
import { EN } from '../../../../web/js/core/punctuation/en.js';
import { PL } from '../../../../web/js/core/punctuation/pl.js';

describe('rulesFor', () => {
    it('picks the rules by the language prefix', () => {
        expect(rulesFor('pl-PL')).toBe(PL);
        expect(rulesFor('en-US')).toBe(EN);
        expect(rulesFor('EN-gb')).toBe(EN);
    });

    it('falls back to Polish for unknown or missing languages', () => {
        expect(rulesFor('de-DE')).toBe(PL);
        expect(rulesFor(undefined)).toBe(PL);
    });
});

describe('punctuate', () => {
    it('applies the rules of the given language to the same words', () => {
        expect(punctuate('ale tak', 'pl-PL')).toBe('Ale tak.');
        expect(punctuate('we tried but failed', 'en-US')).toBe('We tried, but failed.');
        expect(punctuate('we tried but failed', 'pl-PL')).toBe('We tried but failed.');
    });

    it('is Polish by default', () => {
        expect(punctuate('czy idziesz')).toBe('Czy idziesz?');
    });

    it('capitalizes non-ASCII letters after a sentence end', () => {
        expect(punctuate('koniec. ścieżka jest zamknięta')).toBe('Koniec. Ścieżka jest zamknięta.');
    });
});
