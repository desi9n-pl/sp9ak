const MIN_SEGMENTS = 3;
const LOUD_RATIO = 1.5;
const BASELINE_WEIGHT = 0.2;

/**
 * Learns the speaker's usual voice level and flags phrases that stand out above it.
 * `record(level)` takes one audio frame; `takeSegment()` closes the phrase heard since the last call.
 */
export class LoudnessTracker {
    #sum = 0;
    #frames = 0;
    #baseline = 0;
    #segments = 0;

    constructor({ speechLevel }) {
        this.speechLevel = speechLevel;
    }

    /** Only frames above the speech level count: silence between words must not lower the average. */
    record(level) {
        if (level <= this.speechLevel) return;
        this.#sum += level;
        this.#frames++;
    }

    /** True when the phrase since the last call was clearly louder than the learned baseline. */
    takeSegment() {
        if (this.#frames === 0) return false;
        const mean = this.#sum / this.#frames;
        this.#sum = 0;
        this.#frames = 0;
        const loud = this.#segments >= MIN_SEGMENTS && mean > this.#baseline * LOUD_RATIO;
        // a shout must not drag the baseline up, or the next one would no longer stand out
        if (!loud) {
            this.#baseline = this.#segments === 0 ? mean : this.#baseline * (1 - BASELINE_WEIGHT) + mean * BASELINE_WEIGHT;
            this.#segments++;
        }
        return loud;
    }

    /** Forgets the phrase in progress (the dictation stopped), keeping the learned baseline. */
    discardSegment() {
        this.#sum = 0;
        this.#frames = 0;
    }
}
