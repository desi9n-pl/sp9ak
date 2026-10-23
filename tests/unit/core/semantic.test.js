import { describe, expect, it } from 'vitest';
import { buildSemanticText, parseSemanticResponse } from '../../../web/js/core/semantic.js';

const text = value => ({ kind: 'text', text: value });
const suspect = (original, suggestion, accepted = false) => ({ kind: 'suspect', original, suggestion, accepted });

describe('parseSemanticResponse', () => {
    it('returns plain text as one segment', () => {
        expect(parseSemanticResponse('zwykły tekst')).toEqual([text('zwykły tekst')]);
    });

    it('splits text around a marker', () => {
        expect(parseSemanticResponse('przed [[a|b]] po')).toEqual([text('przed '), suspect('a', 'b'), text(' po')]);
    });

    it('handles several markers and adjacent markers', () => {
        const segments = parseSemanticResponse('[[a|b]][[c|d]] i [[e|f]]');
        expect(segments.filter(s => s.kind === 'suspect').map(s => s.original)).toEqual(['a', 'c', 'e']);
    });

    it('trims whitespace inside a marker', () => {
        expect(parseSemanticResponse('[[ a | b ]]')).toEqual([suspect('a', 'b')]);
    });

    it('keeps multi-word originals and suggestions', () => {
        expect(parseSemanticResponse('[[do lego sklepu|do tego sklepu]]'))
            .toEqual([suspect('do lego sklepu', 'do tego sklepu')]);
    });

    it('treats a marker without a suggestion as a suspect with an empty one', () => {
        expect(parseSemanticResponse('[[sam]]')).toEqual([suspect('sam', '')]);
    });

    it('accepts an empty original', () => {
        expect(parseSemanticResponse('[[|dodane]]')).toEqual([suspect('', 'dodane')]);
    });

    it('returns no segments for an empty response', () => {
        expect(parseSemanticResponse('')).toEqual([]);
    });
});

describe('buildSemanticText', () => {
    it('keeps originals until a suggestion is accepted', () => {
        expect(buildSemanticText([text('tekst '), suspect('org', 'sug')])).toBe('tekst org');
    });

    it('uses accepted suggestions and mixes them with rejected ones', () => {
        const segments = [suspect('A', 'a', true), text(' - '), suspect('B', 'b')];
        expect(buildSemanticText(segments)).toBe('a - B');
    });

    it('returns an empty string for no segments', () => {
        expect(buildSemanticText([])).toBe('');
    });

    it('round-trips a response without accepted suggestions', () => {
        expect(buildSemanticText(parseSemanticResponse('kupiłem [[chomik|chleb]] w sklepie'))).toBe('kupiłem chomik w sklepie');
    });
});
