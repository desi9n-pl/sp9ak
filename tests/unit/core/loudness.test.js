import { describe, expect, it } from 'vitest';
import { LoudnessTracker } from '../../../web/js/core/loudness.js';

/** Feeds frames at `level` and closes the phrase. */
function phrase(tracker, level) {
    for (let i = 0; i < 10; i++) tracker.record(level);
    return tracker.takeSegment();
}

describe('LoudnessTracker', () => {
    it('flags nothing until it has learned the usual level', () => {
        const tracker = new LoudnessTracker({ speechLevel: 20 });
        expect(phrase(tracker, 40)).toBe(false);
        expect(phrase(tracker, 100)).toBe(false);
    });

    it('flags a phrase far above the baseline', () => {
        const tracker = new LoudnessTracker({ speechLevel: 20 });
        for (let i = 0; i < 4; i++) phrase(tracker, 40);
        expect(phrase(tracker, 90)).toBe(true);
    });

    it('does not flag normal variation', () => {
        const tracker = new LoudnessTracker({ speechLevel: 20 });
        for (let i = 0; i < 4; i++) phrase(tracker, 40);
        expect(phrase(tracker, 52)).toBe(false);
    });

    it('ignores silence and keeps the baseline after a shout', () => {
        const tracker = new LoudnessTracker({ speechLevel: 20 });
        for (let i = 0; i < 4; i++) {
            tracker.record(5);
            phrase(tracker, 40);
        }
        expect(phrase(tracker, 90)).toBe(true);
        expect(phrase(tracker, 90)).toBe(true);
    });

    it('returns false for a phrase without any speech frames', () => {
        const tracker = new LoudnessTracker({ speechLevel: 20 });
        tracker.record(3);
        expect(tracker.takeSegment()).toBe(false);
    });
});
