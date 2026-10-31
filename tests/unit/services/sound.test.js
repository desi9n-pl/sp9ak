import { describe, expect, it, vi } from 'vitest';
import { SoundPlayer, SILENT } from '../../../web/js/services/sound.js';
import { planCue } from '../../../web/js/core/earcons.js';

/** Records the oscillators the player creates. */
function fakeContext(state = 'running') {
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const context = {
        state,
        currentTime: 5,
        destination: {},
        oscillators: [],
        resume: vi.fn(async () => { context.state = 'running'; }),
        createOscillator() {
            const oscillator = { frequency: param(), connect: node => node, start: vi.fn(), stop: vi.fn() };
            context.oscillators.push(oscillator);
            return oscillator;
        },
        createGain: () => ({ gain: param(), connect: node => node }),
    };
    return context;
}

const settle = () => new Promise(resolve => setTimeout(resolve));

describe('SoundPlayer', () => {
    it('plays the notes of a cue from the current time', async () => {
        const context = fakeContext();
        new SoundPlayer({ createContext: () => context }).play('start');
        await settle();
        const expected = planCue('start', 5);
        expect(context.oscillators.map(o => o.frequency.value)).toEqual(expected.map(t => t.frequency));
        expect(context.oscillators[0].start).toHaveBeenCalledWith(expected[0].start);
    });

    it('creates the audio context only for the first cue', async () => {
        const createContext = vi.fn(() => fakeContext());
        const player = new SoundPlayer({ createContext });
        expect(createContext).not.toHaveBeenCalled();
        player.play('on');
        await settle();
        player.play('off');
        await settle();
        expect(createContext).toHaveBeenCalledTimes(1);
    });

    it('merges cues requested together into the most important one', async () => {
        const context = fakeContext();
        const player = new SoundPlayer({ createContext: () => context });
        player.play('close');
        player.play('open');
        await settle();
        expect(context.oscillators.map(o => o.frequency.value)).toEqual(planCue('open').map(t => t.frequency));
    });

    it('resumes a context Chrome left suspended', async () => {
        const context = fakeContext('suspended');
        new SoundPlayer({ createContext: () => context }).play('select');
        await settle();
        expect(context.resume).toHaveBeenCalled();
        expect(context.oscillators).toHaveLength(1);
    });

    it('stays silent when switched off, even for a cue already requested', async () => {
        const createContext = vi.fn(() => fakeContext());
        const player = new SoundPlayer({ enabled: false, createContext });
        player.play('start');
        player.enabled = true;
        player.play('start');
        player.enabled = false;
        await settle();
        expect(createContext).not.toHaveBeenCalled();
    });

    it('does not throw without Web Audio', async () => {
        const player = new SoundPlayer({ createContext: () => { throw new ReferenceError('AudioContext is not defined'); } });
        expect(() => player.play('error')).not.toThrow();
        await settle();
    });

    it('SILENT accepts cues and does nothing', () => {
        expect(() => SILENT.play('start')).not.toThrow();
    });
});
