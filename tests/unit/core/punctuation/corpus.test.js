import { describe, expect, it } from 'vitest';
import { punctuate } from '../../../../web/js/core/punctuation/index.js';

/**
 * Realistic dictation as the recognizer delivers it (lowercase, no punctuation, typical slips)
 * against what a careful writer would put down. A failing row means the rules miss something,
 * so fix the rules, not the row. What the rules cannot know is listed in KNOWN_LIMITS.
 */
const CORPUS = [
    // everyday messages
    ['dzień dobry piszę w sprawie zamówienia które złożyłem w zeszłym tygodniu',
        'Dzień dobry piszę w sprawie zamówienia, które złożyłem w zeszłym tygodniu'],
    ['przepraszam za opóźnienie ale miałem dużo pracy',
        'Przepraszam za opóźnienie, ale miałem dużo pracy'],
    ['nie wiem czy zdążę na spotkanie bo pociąg się spóźnia',
        'Nie wiem, czy zdążę na spotkanie, bo pociąg się spóźnia'],
    ['myślę że powinniśmy przełożyć termin',
        'Myślę, że powinniśmy przełożyć termin'],
    ['kiedy będziesz w domu',
        'Kiedy będziesz w domu?'],
    ['dlaczego nie odpisałeś na wiadomość',
        'Dlaczego nie odpisałeś na wiadomość?'],
    // notes and lists
    ['kupić chleb masło ser i pomidory',
        'Kupić chleb masło ser i pomidory'],
    ['na spotkaniu omówimy między innymi budżet harmonogram oraz zespół',
        'Na spotkaniu omówimy między innymi budżet, harmonogram oraz zespół'],
    // dictation slips
    ['poprostu nie mam na to czasu',
        'Po prostu nie mam na to czasu'],
    ['wogóle nie wiem o co chodzi',
        'W ogóle nie wiem o co chodzi'],
    ['musimy to zrobić i i to szybko',
        'Musimy to zrobić i to szybko'],
    ['byłem w w sklepie i kupiłem mleko',
        'Byłem w sklepie i kupiłem mleko'],
    ['narazie nie mam odpowiedzi ale sprawdzę to jutro',
        'Na razie nie mam odpowiedzi, ale sprawdzę to jutro'],
    ['z resztą nie ma o czym mówić',
        'Zresztą nie ma o czym mówić'],
    // multi-sentence
    ['dziękuję za wiadomość. postaram się odpowiedzieć jak najszybciej',
        'Dziękuję za wiadomość. Postaram się odpowiedzieć jak najszybciej.'],
    ['mam pytanie. czy możemy się spotkać w piątek',
        'Mam pytanie. Czy możemy się spotkać w piątek?'],
    // line breaks
    ['temat spotkania\nuczestnicy\nplan działań',
        'Temat spotkania\nUczestnicy\nPlan działań'],
];

describe('punctuate: dictation corpus', () => {
    it.each(CORPUS)('%j', (input, expected) => {
        expect(punctuate(input, 'pl-PL')).toBe(expected);
    });

    it.each(CORPUS)('is stable on its own output: %j', (input) => {
        const once = punctuate(input, 'pl-PL');
        expect(punctuate(once, 'pl-PL')).toBe(once);
    });
});

// Needs context or a dictionary; the AI review is meant to catch these.
export const KNOWN_LIMITS = [
    '"jeśli masz chwilę to zadzwoń": comma before "to" after a conditional clause (may be a plain object)',
    'ó/u: "rurka" wpisana jako "rórka" is a valid-looking word to a rule',
    'homophones that are real words: "morze" vs "może"',
    'proper nouns in the middle of a sentence ("jadę do warszawy")',
    'numerals and dates ("pierwszego marca dwa tysiące dwudziestego szóstego")',
];
