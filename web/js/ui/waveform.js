import { byId } from './dom.js';

const BARS = 64;
const FFT_SIZE = 256;
const USED_SPECTRUM = 0.65;
const BAR_HEIGHT_SHARE = 0.88;
const VOICE_BINS = [2, 20];

/** HSL colour of one bar. Each theme has its own palette. */
export function barColor(theme, loudness, position) {
    if (theme === 'sepia') return `hsl(${26 + loudness * 14}, ${50 + loudness * 18}%, ${36 + loudness * 24}%)`;
    if (theme === 'light') return `hsl(${228 + position * 42}, ${55 + loudness * 20}%, ${42 + loudness * 22}%)`;
    return `hsl(${234 + position * 38}, ${60 + loudness * 18}%, ${48 + loudness * 22}%)`;
}

/** Average level of the low bins, where speech sits. */
export function voiceLevel(spectrum) {
    const [from, to] = VOICE_BINS;
    return spectrum.slice(from, to).reduce((sum, v) => sum + v, 0) / (to - from);
}

/** Microphone spectrum drawn on a canvas while dictating. `onFrame(level)` gets the voice level each frame. */
export class Waveform {
    #audio = null;
    #analyser = null;
    #stream = null;
    #frame = null;

    constructor({ onFrame }) {
        this.onFrame = onFrame;
        this.canvas = byId('waveform');
        this.context = this.canvas.getContext('2d');
        window.addEventListener('resize', () => this.#resize());
    }

    async start() {
        this.canvas.classList.add('show');
        this.#resize();
        try {
            this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.#audio = new AudioContext();
            this.#analyser = this.#audio.createAnalyser();
            this.#analyser.fftSize = FFT_SIZE;
            this.#audio.createMediaStreamSource(this.#stream).connect(this.#analyser);
        } catch {
            // no microphone access: the canvas stays blank and dictation itself reports the error
        }
        this.#draw();
    }

    stop() {
        cancelAnimationFrame(this.#frame);
        this.#frame = null;
        this.#audio?.close().catch(() => {});
        this.#stream?.getTracks().forEach(track => track.stop());
        this.#audio = this.#stream = this.#analyser = null;
        this.canvas.classList.remove('show');
    }

    #resize() {
        if (!this.canvas.classList.contains('show')) return;
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    #draw = () => {
        this.#frame = requestAnimationFrame(this.#draw);
        const { width, height } = this.canvas;
        const style = getComputedStyle(document.documentElement);
        this.context.fillStyle = style.getPropertyValue('--surface').trim();
        this.context.fillRect(0, 0, width, height);
        if (!this.#analyser) return;

        const spectrum = new Uint8Array(this.#analyser.frequencyBinCount);
        this.#analyser.getByteFrequencyData(spectrum);
        const theme = document.documentElement.dataset.theme;
        const usedBins = Math.floor(spectrum.length * USED_SPECTRUM);
        const barWidth = width / BARS;
        for (let i = 0; i < BARS; i++) {
            const loudness = spectrum[Math.floor((i * usedBins) / BARS)] / 255;
            const barHeight = loudness * height * BAR_HEIGHT_SHARE;
            if (barHeight < 1) continue;
            this.context.fillStyle = barColor(theme, loudness, i / BARS);
            this.#bar(i * barWidth + 1, height - barHeight, barWidth - 2, barHeight);
        }
        this.onFrame(voiceLevel(spectrum));
    };

    #bar(x, y, width, height) {
        const radius = Math.min(3, width / 2);
        this.context.beginPath();
        if (this.context.roundRect) this.context.roundRect(x, y, width, height, [radius, radius, 0, 0]);
        else this.context.rect(x, y, width, height);
        this.context.fill();
    }
}
