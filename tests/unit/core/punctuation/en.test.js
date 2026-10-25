import { describe, expect, it } from 'vitest';
import { punctuate } from '../../../../web/js/core/punctuation/index.js';
import { CONJUNCTIONS, INTRO_PHRASES } from '../../../../web/js/core/punctuation/en.js';

const en = text => punctuate(text, 'en-US');

describe('English punctuation', () => {
    it('closes statements and questions', () => {
        expect(en('i am here')).toBe('I am here');
        expect(en('where are you')).toBe('Where are you?');
        expect(en('can you hear me')).toBe('Can you hear me?');
    });

    it('puts a comma before but and which, not before that or because', () => {
        expect(en('i wanted to go but it rained')).toBe('I wanted to go, but it rained');
        expect(en('we took the train which was late')).toBe('We took the train, which was late');
        expect(en('i think that it works because i tested it')).toBe('I think that it works because i tested it');
    });

    it('commas introductory phrases at the start of a sentence', () => {
        expect(en('unfortunately we missed it')).toBe('Unfortunately, we missed it');
        expect(en('it was fine. of course we tried again')).toContain('Of course, we');
    });

    it('uses a semicolon before however after a long clause and a comma after it', () => {
        expect(en('the plan looked good on paper however it never worked in practice'))
            .toBe('The plan looked good on paper; however, it never worked in practice');
    });

    it('leaves a short clause before however without a semicolon', () => {
        expect(en('it works however slowly')).not.toContain(';');
    });

    it('sets off a restatement with an em dash', () => {
        expect(en('we need one thing that is time')).toBe('We need one thing—that is time');
    });

    it('makes a comma list after a cue', () => {
        expect(en('we sell fruit such as apples pears plums and cherries'))
            .toBe('We sell fruit such as apples, pears, plums and cherries');
    });

    it('does not split a two-item list', () => {
        expect(en('we sell fruit such as apples and cherries')).toBe('We sell fruit such as apples and cherries');
    });

    it('has no duplicate words in its lists', () => {
        expect(new Set(CONJUNCTIONS).size).toBe(CONJUNCTIONS.length);
        expect(new Set(INTRO_PHRASES).size).toBe(INTRO_PHRASES.length);
    });
});
