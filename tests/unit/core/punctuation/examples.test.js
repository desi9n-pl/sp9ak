import { describe, expect, it } from 'vitest';
import { punctuate } from '../../../../web/js/core/punctuation/index.js';

/** Input -> expected output pairs, as the user sees them after dictating. Add a row for every reported bug. */
describe('punctuate: Polish examples', () => {
    it.each([
        // text with a full stop inside also gets one at the end
        // [what was dictated, what the corrected pane must show]
        ['dzień dobry chciałbym zapytać o ofertę', 'Dzień dobry chciałbym zapytać o ofertę'],
        ['chcę kawę ale nie mam czasu', 'Chcę kawę, ale nie mam czasu'],
        ['czy możesz mi pomóc', 'Czy możesz mi pomóc?'],
        ['to jest ważne czyli musimy to zrobić', 'To jest ważne – czyli musimy to zrobić'],
        ['  ala   ma kota  ', 'Ala ma kota'],
        ['lubię owoce takie jak jabłka gruszki śliwki i wiśnie', 'Lubię owoce, takie jak jabłka, gruszki, śliwki i wiśnie'],
        ['Ala ma kota. a kot ma psa', 'Ala ma kota. A kot ma psa.'],
        ['', ''],
    ])('%j -> %j', (input, expected) => {
        expect(punctuate(input, 'pl-PL')).toBe(expected);
    });
});

describe('punctuate: line breaks (Enter while dictating)', () => {
    it.each([
        // regression: the line after Enter starts with a capital
        ['dzień dobry\nchciałbym zapytać o ofertę', 'Dzień dobry\nChciałbym zapytać o ofertę'],
        ['kupić mleko\nkupić chleb\nkupić masło', 'Kupić mleko\nKupić chleb\nKupić masło'],
        ['jutro jadę do warszawy\n\nnastępnie wracam', 'Jutro jadę do warszawy\n\nNastępnie wracam'],
        ['pierwsza linia,\ndruga linia', 'Pierwsza linia,\nDruga linia'],
        // regression: a break after a full stop is not turned into a space
        ['pierwsza linia.\ndruga linia', 'Pierwsza linia.\nDruga linia.'],
        ['to działa. a to nie\ndruga linia', 'To działa. A to nie\nDruga linia.'],
        // regression (screenshot): a phrase finished before Enter stays in one line
        ['przygotować się porządnie na TC marketingowe\nnastępna linia', 'Przygotować się porządnie na TC marketingowe\nNastępna linia'],
        ['przygotować się porządnie na TC marketingowe\n', 'Przygotować się porządnie na TC marketingowe'],
    ])('%j -> %j', (input, expected) => {
        expect(punctuate(input, 'pl-PL')).toBe(expected);
    });

    it('is stable: correcting already corrected text changes nothing', () => {
        const once = punctuate('dzień dobry\nchciałbym zapytać o ofertę', 'pl-PL');
        expect(punctuate(once, 'pl-PL')).toBe(once);
    });
});

describe('punctuate: English examples', () => {
    it.each([
        ['what time is it', 'What time is it?'],
        ['hello\nhow are you', 'Hello\nHow are you'],
        ['hello.\nhow are you', 'Hello.\nHow are you?'],
    ])('%j -> %j', (input, expected) => {
        expect(punctuate(input, 'en-US')).toBe(expected);
    });
});
