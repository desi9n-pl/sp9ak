import { describe, expect, it } from 'vitest';
import { CONJUNCTIONS, INTRO_PHRASES, capitalizeSentences, punctuate } from '../../../web/js/core/punctuation.js';

describe('capitalizeSentences', () => {
    it('capitalizes the first letter', () => {
        expect(capitalizeSentences('cześć')).toBe('Cześć');
    });

    it.each([
        ['cześć. jak się masz', 'Cześć. Jak się masz'],
        ['czy jesteś? tak jestem', 'Czy jesteś? Tak jestem'],
        ['hej! wróć tu', 'Hej! Wróć tu'],
        ['koniec. nowe zdanie', 'Koniec. Nowe zdanie'],
    ])('capitalizes after a sentence end: %s', (input, expected) => {
        expect(capitalizeSentences(input)).toBe(expected);
    });

    it('keeps existing capitals and mid-sentence words', () => {
        expect(capitalizeSentences('Jan kowalski. Anna nowak')).toBe('Jan kowalski. Anna nowak');
    });

    it('passes empty values through', () => {
        expect(capitalizeSentences('')).toBe('');
        expect(capitalizeSentences(null)).toBe(null);
    });
});

describe('punctuate', () => {
    it('ends a statement with a full stop and capitalizes it', () => {
        expect(punctuate('witaj')).toBe('Witaj.');
    });

    it('ends a question with a question mark', () => {
        expect(punctuate('czy idziesz')).toBe('Czy idziesz?');
        expect(punctuate('gdzie jesteś')).toBe('Gdzie jesteś?');
    });

    it('trims surrounding whitespace and collapses repeated spaces', () => {
        expect(punctuate('  cześć   wszystkim  ')).toBe('Cześć wszystkim.');
    });

    it('returns an empty string for blank input', () => {
        expect(punctuate('')).toBe('');
        expect(punctuate('   ')).toBe('');
    });

    it('leaves text that already ends with punctuation alone', () => {
        expect(punctuate('jabłka, gruszki, śliwki,')).toBe('Jabłka, gruszki, śliwki,');
        expect(punctuate('Gotowe!')).toBe('Gotowe!');
    });

    describe('commas before conjunctions', () => {
        it.each([
            ['chcę iść ale nie mogę', ', ale'],
            ['myślę że to dobry pomysł', ', że'],
            ['zostałem bo padało', ', bo'],
            ['pracuję podczas gdy on odpoczywa', ', podczas gdy'],
            ['zrobię to chyba że padnie deszcz', ', chyba że'],
            ['było zimno tak że trzęsłem się', ', tak że'],
            ['było trudno mimo to nie poddałem się', ', mimo to'],
            ['pójdę pod warunkiem że będziesz', ', pod warunkiem że'],
            ['zadzwoń jak tylko dojdziesz', ', jak tylko'],
        ])('%s', (input, expected) => {
            expect(punctuate(input)).toContain(expected);
        });

        it('prefers the longest conjunction', () => {
            expect(punctuate('nie przyjdę dlatego że chory')).toContain(', dlatego że');
            expect(punctuate('nie przyjdę dlatego że chory')).not.toContain('dlatego, że');
        });

        it('does not add a comma that is already there', () => {
            expect(punctuate('chcę iść, ale nie mogę').match(/, ale/g)).toHaveLength(1);
        });

        it('does not put a comma after the first word of a sentence', () => {
            expect(punctuate('ale to prawda')).not.toMatch(/^Ale?,/);
        });
    });

    describe('introductory phrases', () => {
        it.each([
            ['niestety nie mogę', 'Niestety,'],
            ['oczywiście pójdę', 'Oczywiście,'],
            ['na przykład jabłka i gruszki', 'Na przykład,'],
            ['to dobrze. niestety nie zdążyłem', 'Niestety,'],
        ])('%s', (input, expected) => {
            expect(punctuate(input)).toContain(expected);
        });

        it('does not double an existing comma', () => {
            expect(punctuate('niestety, nie mogę').match(/niestety,/gi)).toHaveLength(1);
            expect(punctuate('oczywiście że tak')).not.toContain(',,');
        });
    });

    describe('correlative pairs', () => {
        it('adds a comma in "zarówno … jak i"', () => {
            expect(punctuate('zarówno on jak i ona przyszli')).toContain(', jak i');
        });

        it('adds a comma in "ani … ani"', () => {
            expect(punctuate('ani on ani ona nie przyszli')).toContain('on, ani ona');
        });
    });

    describe('cleanup', () => {
        it('collapses doubled commas', () => {
            expect(punctuate('chcę iść, ale, nie mogę')).not.toContain(',,');
        });

        it('removes space before a comma', () => {
            expect(punctuate('chcę iść , ale nie mogę')).not.toContain(' ,');
        });

        it('drops a comma that would precede the final stop', () => {
            expect(punctuate('idę tam, .')).not.toContain(',.');
        });
    });
});

describe('word lists', () => {
    it('have no duplicates', () => {
        expect(new Set(CONJUNCTIONS).size).toBe(CONJUNCTIONS.length);
        expect(new Set(INTRO_PHRASES).size).toBe(INTRO_PHRASES.length);
    });
});
