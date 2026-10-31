import { describe, expect, it } from 'vitest';
import { EARCONS, MASTER_VOLUME, pickCue, planCue } from '../../../web/js/core/earcons.js';

describe('cue definitions', () => {
    it.each(Object.entries(EARCONS))('%s is short, audible and never louder than the master volume', (name, { notes }) => {
        const tones = planCue(name);
        expect(tones.length).toBeGreaterThan(0);
        for (const { frequency, start, end, peak } of tones) {
            expect(frequency).toBeGreaterThanOrEqual(200);
            expect(frequency).toBeLessThanOrEqual(2000);
            expect(end).toBeGreaterThan(start);
            expect(peak).toBeGreaterThan(0);
            expect(peak).toBeLessThanOrEqual(MASTER_VOLUME);
        }
        expect(Math.max(...tones.map(tone => tone.end))).toBeLessThanOrEqual(0.3);
        expect(notes).toHaveLength(tones.length);
    });

    it('start rises and stop falls', () => {
        const pitches = name => planCue(name).map(tone => tone.frequency);
        const [a, b] = pitches('start');
        expect(b).toBeGreaterThan(a);
        expect(pitches('stop')).toEqual([b, a]);
    });

    it('error sounds lower than success', () => {
        const top = name => Math.max(...planCue(name).map(tone => tone.frequency));
        expect(top('error')).toBeLessThan(top('success'));
    });
});

describe('planCue', () => {
    it('schedules the notes from the given time and scales them by the volume', () => {
        const [first, second] = planCue('start', 2, 0.5);
        expect(first).toEqual({ frequency: 660, start: 2, end: 2.07, peak: 0.5 });
        expect(second.start).toBeCloseTo(2.075);
    });

    it('returns nothing for an unknown cue', () => {
        expect(planCue('nope')).toEqual([]);
    });
});

describe('pickCue', () => {
    it('picks the most important of the cues requested together', () => {
        expect(pickCue(['close', 'open'])).toBe('open');
        expect(pickCue(['close', 'stop', 'select'])).toBe('stop');
        expect(pickCue(['success', 'error'])).toBe('error');
    });

    it('keeps the first on a tie and skips unknown names', () => {
        expect(pickCue(['on', 'off'])).toBe('on');
        expect(pickCue(['nope', 'select'])).toBe('select');
        expect(pickCue([])).toBeNull();
    });
});
