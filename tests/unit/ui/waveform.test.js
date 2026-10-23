// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Waveform, barColor, voiceLevel } from '../../../web/js/ui/waveform.js';
import { $, mountPage } from './fixture.js';

describe('barColor', () => {
    it.each([
        ['sepia', 'hsl(33, 59%, 48%)'],
        ['light', 'hsl(249, 65%, 53%)'],
        ['dark', 'hsl(253, 69%, 59%)'],
    ])('has its own palette for %s', (theme, expected) => {
        expect(barColor(theme, 0.5, 0.5)).toBe(expected);
    });
});

describe('voiceLevel', () => {
    it('averages the low bins where speech sits', () => {
        const spectrum = new Uint8Array(64);
        spectrum.fill(36, 2, 20);
        spectrum[0] = spectrum[30] = 255;
        expect(voiceLevel(spectrum)).toBe(36);
    });

    it('is zero for silence', () => {
        expect(voiceLevel(new Uint8Array(64))).toBe(0);
    });
});

describe('Waveform', () => {
    let context;
    let analyser;
    let track;
    let frames;

    beforeEach(() => {
        mountPage();
        frames = [];
        context = {
            fillRect: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), rect: vi.fn(), roundRect: vi.fn(),
            fillStyle: '',
        };
        HTMLCanvasElement.prototype.getContext = () => context;
        track = { stop: vi.fn() };
        analyser = {
            frequencyBinCount: 128,
            fftSize: 0,
            getByteFrequencyData: vi.fn(array => array.fill(100)),
        };
        globalThis.AudioContext = class {
            createAnalyser() { return analyser; }
            createMediaStreamSource() { return { connect: vi.fn() }; }
            close() { return Promise.resolve(); }
        };
        navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) };
        globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
        globalThis.cancelAnimationFrame = vi.fn();
        Object.defineProperty(HTMLCanvasElement.prototype, 'offsetWidth', { configurable: true, get: () => 640 });
        Object.defineProperty(HTMLCanvasElement.prototype, 'offsetHeight', { configurable: true, get: () => 52 });
    });
    afterEach(() => delete navigator.mediaDevices);

    it('shows the canvas, draws bars and reports the voice level', async () => {
        const onFrame = vi.fn();
        const waveform = new Waveform({ onFrame });
        await waveform.start();
        expect($('waveform').classList.contains('show')).toBe(true);
        expect($('waveform').width).toBe(640);
        expect(analyser.fftSize).toBe(256);
        expect(context.fill).toHaveBeenCalled();
        expect(context.roundRect).toHaveBeenCalled();
        expect(onFrame).toHaveBeenCalledWith(100);
        frames.shift()();
        expect(onFrame).toHaveBeenCalledTimes(2);
    });

    it('falls back to square bars without roundRect', async () => {
        context.roundRect = undefined;
        await new Waveform({ onFrame: vi.fn() }).start();
        expect(context.rect).toHaveBeenCalled();
    });

    it('skips bars that would be invisible', async () => {
        analyser.getByteFrequencyData.mockImplementation(array => array.fill(0));
        await new Waveform({ onFrame: vi.fn() }).start();
        expect(context.fill).not.toHaveBeenCalled();
    });

    it('keeps going without a microphone', async () => {
        navigator.mediaDevices.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
        const onFrame = vi.fn();
        await new Waveform({ onFrame }).start();
        expect(onFrame).not.toHaveBeenCalled();
        expect(context.fillRect).toHaveBeenCalled();
    });

    it('releases the microphone and hides the canvas on stop', async () => {
        const waveform = new Waveform({ onFrame: vi.fn() });
        await waveform.start();
        waveform.stop();
        expect(track.stop).toHaveBeenCalled();
        expect($('waveform').classList.contains('show')).toBe(false);
        expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it('stopping before starting is harmless', () => {
        expect(() => new Waveform({ onFrame: vi.fn() }).stop()).not.toThrow();
    });

    it('resizes with the window while shown', async () => {
        await new Waveform({ onFrame: vi.fn() }).start();
        Object.defineProperty(HTMLCanvasElement.prototype, 'offsetWidth', { configurable: true, get: () => 800 });
        window.dispatchEvent(new Event('resize'));
        expect($('waveform').width).toBe(800);
    });
});
