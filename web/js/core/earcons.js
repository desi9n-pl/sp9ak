/**
 * Short synthesized cues ("earcons") for user actions. Each cue is a few sine notes, so they
 * stay quiet and soft. Rising notes mean something began or succeeded, falling notes that it
 * ended or went away, low notes that something failed. Related actions share a cue.
 *
 * A note is [frequency Hz, offset s, duration s, loudness 0–1 (relative to the master volume)].
 * When several cues are requested at once (e.g. a panel opens and another one closes), only the
 * one with the highest `priority` plays.
 */
export const EARCONS = {
    error:    { priority: 11, notes: [[349, 0, 0.09, 1], [294, 0.11, 0.14, 1]] },
    start:    { priority: 10, notes: [[660, 0, 0.07, 1], [880, 0.075, 0.1, 1]] },
    stop:     { priority: 10, notes: [[880, 0, 0.07, 1], [660, 0.075, 0.1, 1]] },
    warning:  { priority: 9,  notes: [[587, 0, 0.09, 0.8], [494, 0.1, 0.12, 0.8]] },
    success:  { priority: 8,  notes: [[784, 0, 0.06, 0.8], [1175, 0.065, 0.12, 0.8]] },
    notice:   { priority: 7,  notes: [[988, 0, 0.12, 0.7]] },
    create:   { priority: 6,  notes: [[523, 0, 0.05, 0.7], [659, 0.05, 0.05, 0.7], [784, 0.1, 0.09, 0.7]] },
    remove:   { priority: 5,  notes: [[440, 0, 0.06, 0.6], [330, 0.06, 0.08, 0.6]] },
    on:       { priority: 4,  notes: [[1319, 0, 0.045, 0.5]] },
    off:      { priority: 4,  notes: [[988, 0, 0.045, 0.5]] },
    select:   { priority: 3,  notes: [[1175, 0, 0.035, 0.45]] },
    open:     { priority: 2,  notes: [[740, 0, 0.04, 0.4], [988, 0.04, 0.05, 0.4]] },
    close:    { priority: 1,  notes: [[988, 0, 0.04, 0.4], [740, 0.04, 0.05, 0.4]] },
};

/** Peak gain of the loudest note; Web Audio's full scale is 1. */
export const MASTER_VOLUME = 0.1;
/** Fade-in, long enough to avoid a click at the start of a note. */
export const ATTACK_S = 0.006;
/** Gain a note fades out to (an exponential ramp cannot reach 0). */
export const SILENCE = 0.0001;

/** The cue to play out of those requested together: the highest priority, the first on a tie. */
export function pickCue(names) {
    let best = null;
    for (const name of names) {
        if (!EARCONS[name]) continue;
        if (best === null || EARCONS[name].priority > EARCONS[best].priority) best = name;
    }
    return best;
}

/**
 * The notes of cue `name` as tones scheduled from time `at` (s): { frequency, start, end, peak }.
 * Empty for an unknown cue.
 */
export function planCue(name, at = 0, volume = MASTER_VOLUME) {
    return (EARCONS[name]?.notes ?? []).map(([frequency, offset, duration, loudness]) => ({
        frequency,
        start: at + offset,
        end: at + offset + duration,
        peak: volume * loudness,
    }));
}
