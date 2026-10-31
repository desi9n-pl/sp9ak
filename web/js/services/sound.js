import { ATTACK_S, SILENCE, pickCue, planCue } from '../core/earcons.js';

// Let the oscillator run a little past the fade-out so the tail is not cut into a click.
const TAIL_S = 0.02;

/** Stand-in for views created without sound (tests, optional dependency). */
export const SILENT = { play() {} };

/**
 * Plays the cues from core/earcons.js through Web Audio. The AudioContext is created on the
 * first cue. Cues requested in the same task are merged into the most important one, so one
 * action that changes several things (a panel opening closes another) makes one sound.
 * Never throws: without Web Audio the app simply stays silent.
 */
export class SoundPlayer {
    enabled = true;
    #createContext;
    #context = null;
    #pending = [];

    constructor({ enabled = true, createContext = () => new globalThis.AudioContext() } = {}) {
        this.enabled = enabled;
        this.#createContext = createContext;
    }

    play(name) {
        if (!this.enabled) return;
        this.#pending.push(name);
        if (this.#pending.length === 1) queueMicrotask(() => this.#flush());
    }

    async #flush() {
        const name = pickCue(this.#pending);
        this.#pending = [];
        if (!name || !this.enabled) return;
        try {
            const context = this.#audio();
            // Chrome starts a context suspended until the page gets a user gesture.
            if (context.state === 'suspended') await context.resume();
            for (const tone of planCue(name, context.currentTime)) this.#tone(context, tone);
        } catch {
            // no Web Audio here: stay silent
        }
    }

    #audio() {
        this.#context ??= this.#createContext();
        return this.#context;
    }

    #tone(context, { frequency, start, end, peak }) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(SILENCE, start);
        gain.gain.linearRampToValueAtTime(peak, start + ATTACK_S);
        gain.gain.exponentialRampToValueAtTime(SILENCE, end);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + TAIL_S);
    }
}
