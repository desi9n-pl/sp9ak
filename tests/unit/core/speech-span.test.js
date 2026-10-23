import { describe, expect, it } from 'vitest';
import { SpeechSpan, resolveStartPosition } from '../../../web/js/core/speech-span.js';

function spanAt(position) {
    const span = new SpeechSpan();
    span.begin(position);
    return span;
}

describe('SpeechSpan.apply', () => {
    it('inserts speech at the start of an empty field', () => {
        const span = spanAt(0);
        expect(span.apply('', 'cześć ', '')).toEqual({ value: 'cześć ', caret: 6 });
        expect(span.length).toBe(6);
    });

    it('keeps the text before the span', () => {
        expect(spanAt(9).apply('Notatka: ', 'cześć', '').value).toBe('Notatka: cześć');
    });

    it('keeps the text after the span and replaces only the span', () => {
        const span = spanAt(6);
        span.length = 4;
        expect(span.apply('przed mowa po', 'nowe', '').value).toBe('przed nowe po');
    });

    it('shows interim words but puts the caret after the final part only', () => {
        const result = spanAt(0).apply('', 'pewne ', 'słowo');
        expect(result).toEqual({ value: 'pewne słowo', caret: 6 });
    });

    it('collapses repeated spaces', () => {
        expect(spanAt(0).apply('', 'a  b', '').value).toBe('a b');
    });

    it('does not read past the end of a field that got shorter', () => {
        const span = spanAt(0);
        span.length = 100;
        expect(span.apply('abc', 'nowe', '').value).toBe('nowe');
    });

    it('rewrites the previous result on every update', () => {
        const span = spanAt(0);
        let value = span.apply('', '', 'rob').value;
        value = span.apply(value, '', 'robię').value;
        value = span.apply(value, 'robię ', '').value;
        expect(value).toBe('robię ');
    });

    it('remembers what it wrote', () => {
        const span = spanAt(0);
        span.apply('', 'a ', 'b');
        expect([span.final, span.interim]).toEqual(['a ', 'b']);
    });
});

describe('SpeechSpan.commitInterim', () => {
    it('moves interim text to final with a trailing space', () => {
        const span = spanAt(0);
        span.apply('', 'raz ', 'dwa');
        expect(span.commitInterim()).toBe(true);
        expect([span.final, span.interim]).toEqual(['raz dwa ', '']);
    });

    it('reports when there was nothing to commit', () => {
        expect(spanAt(0).commitInterim()).toBe(false);
    });
});

describe('SpeechSpan.begin', () => {
    it('forgets everything from the previous span', () => {
        const span = spanAt(0);
        span.apply('', 'old ', 'x');
        span.begin(7);
        expect([span.start, span.length, span.final, span.interim]).toEqual([7, 0, '', '']);
    });
});

describe('resolveStartPosition', () => {
    it.each([
        ['prefers the live caret', [12, 3, 20], 12],
        ['falls back to the remembered position', [null, 3, 20], 3],
        ['falls back to the end without any position', [undefined, undefined, 20], 20],
        ['clamps to the text length', [99, 0, 20], 20],
        ['never goes below zero', [-5, 0, 20], 0],
        ['accepts a caret at 0', [0, 10, 20], 0],
    ])('%s', (_, args, expected) => {
        expect(resolveStartPosition(...args)).toBe(expected);
    });
});
