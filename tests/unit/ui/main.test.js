// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $, click, key, mountPage } from './fixture.js';

class FakeRecognition {
    static last;
    constructor() { FakeRecognition.last = this; this.running = false; }
    start() { this.running = true; setTimeout(() => this.onstart?.()); }
    stop() { setTimeout(() => { this.running = false; this.onend?.(); }); }
    say(transcript) {
        this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal: true })] });
    }
}

let saved;

async function startApp() {
    vi.resetModules();
    mountPage();
    await import('../../../web/js/main.js');
    await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
    vi.useFakeTimers();
    saved = null;
    localStorage.clear();
    window.SpeechRecognition = FakeRecognition;
    delete window.ai;
    delete window.LanguageModel;
    window.getSelection = () => ({ toString: () => '' });
    globalThis.fetch = vi.fn(async (url, options) => {
        if (url === '/api/sessions' && options?.method === 'POST') {
            saved = JSON.parse(options.body);
            return { ok: true };
        }
        if (url === '/api/sessions') return { ok: true, json: async () => [] };
        if (url === '/api/hotkey') return { json: async () => ({ seq: 0, action: 'start' }) };
        throw new Error(`unexpected request ${url}`);
    });
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    navigator.mediaDevices = { getUserMedia: vi.fn(async () => { throw new Error('no mic in tests'); }) };
    HTMLCanvasElement.prototype.getContext = () => ({ fillRect: vi.fn() });
    globalThis.requestAnimationFrame = () => 0;
    globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
    vi.useRealTimers();
    delete navigator.mediaDevices;
});

async function dictate(...phrases) {
    click($('dictBtn'));
    await vi.advanceTimersByTimeAsync(10);
    phrases.forEach(p => FakeRecognition.last.say(p));
    click($('dictBtn'));
    await vi.advanceTimersByTimeAsync(10);
}

describe('the assembled page', () => {
    it('starts ready, with the empty state showing and no AI available', async () => {
        await startApp();
        expect($('msg').textContent).toBe('Gotowy');
        expect($('emptyState').parentElement.classList.contains('is-empty')).toBe(true);
        expect($('aiStatusText').textContent).toBe('Flaga wyłączona');
        expect($('punctToggle').dataset.ai).toBe('off');
    });

    it('dictation fills the editor, punctuates below and saves a session', async () => {
        await startApp();
        await dictate('nie przyjdę bo jestem chory');
        expect($('output').value).toBe('nie przyjdę bo jestem chory ');
        expect($('corrected').value).toBe('Nie przyjdę, bo jestem chory ');
        expect($('correctedSection').hidden).toBe(false);
        expect(saved).toHaveLength(1);
        expect(saved[0].text).toBe('Nie przyjdę, bo jestem chory');
    });

    it('does not save an accidental one-word dictation', async () => {
        await startApp();
        await dictate('ok');
        expect(saved).toBeNull();
    });

    it('with punctuation off, the text below stays raw', async () => {
        await startApp();
        click($('punctToggle'));
        await dictate('myślę że tak');
        expect($('corrected').value).toBe('myślę że tak ');
    });

    it('the status line follows the recognizer', async () => {
        await startApp();
        click($('dictBtn'));
        await vi.advanceTimersByTimeAsync(10);
        expect($('msg').textContent).toBe('Słucham…');
        expect($('dictLabel').textContent).toBe('Pauza');
        click($('dictBtn'));
        await vi.advanceTimersByTimeAsync(10);
        expect($('msg').textContent).toBe('Gotowy');
    });

    it('Ctrl+N saves the note and starts a clean one', async () => {
        await startApp();
        await dictate('notatka która zostanie zapisana');
        key(document, { key: 'n', ctrlKey: true });
        expect($('output').value).toBe('');
        expect($('correctedSection').hidden).toBe(true);
        expect($('emptyState').parentElement.classList.contains('is-empty')).toBe(true);
        expect(saved).toHaveLength(1);
    });

    it('picking a session from the history loads it and closes the panel', async () => {
        await startApp();
        await dictate('stara notatka z historii');
        key(document, { key: 'n', ctrlKey: true });
        click($('historyBtn'));
        click(document.querySelector('.sess-body'));
        expect($('output').value).toBe('Stara notatka z historii ');
        expect($('historyPanel').classList.contains('open')).toBe(false);
    });

    it('dictating after loading a session does not glue the new word to the last one', async () => {
        await startApp();
        await dictate('stara notatka z historii');
        key(document, { key: 'n', ctrlKey: true });
        click($('historyBtn'));
        click(document.querySelector('.sess-body'));
        await dictate('dopisek');
        expect($('output').value).toBe('Stara notatka z historii dopisek ');
    });

    it('Ctrl+D toggles dictation', async () => {
        await startApp();
        key(document, { key: 'd', ctrlKey: true });
        await vi.advanceTimersByTimeAsync(10);
        expect($('dictBtn').classList.contains('on')).toBe(true);
    });

    it('Escape stops dictation and closes panels and the guide', async () => {
        await startApp();
        click($('settingsBtn'));
        click($('installGeminiBtn'));
        click($('dictBtn'));
        await vi.advanceTimersByTimeAsync(10);
        key(document, { key: 'Escape' });
        await vi.advanceTimersByTimeAsync(10);
        expect($('themesPanel').classList.contains('open')).toBe(false);
        expect($('installModal').classList.contains('open')).toBe(false);
        expect($('dictBtn').classList.contains('on')).toBe(false);
    });

    it('applying a semantic review replaces the text', async () => {
        window.LanguageModel = {
            availability: async () => 'available',
            create: async () => ({ prompt: async () => 'to jest [[testowy|tekstowy]] wynik' }),
        };
        await startApp();
        $('output').value = 'to jest testowy wynik';
        click($('semanticBtn'));
        await vi.advanceTimersByTimeAsync(10);
        click(document.querySelector('.suspect-sug'));
        click($('semanticApplyBtn'));
        expect($('output').value).toBe('to jest tekstowy wynik');
        expect($('semanticPanel').classList.contains('open')).toBe(false);
    });

    it('a hotkey signal from the tray starts dictation', async () => {
        let seq = 0;
        await startApp();
        globalThis.fetch.mockImplementation(async url => (url === '/api/hotkey'
            ? { json: async () => ({ seq, action: 'start' }) }
            : { ok: true, json: async () => [] }));
        await vi.advanceTimersByTimeAsync(500);
        seq = 1;
        await vi.advanceTimersByTimeAsync(510);
        expect($('dictBtn').classList.contains('on')).toBe(true);
    });

    it('copies with Ctrl+C when nothing is selected', async () => {
        await startApp();
        await dictate('tekst do skopiowania');
        key(document, { key: 'c', ctrlKey: true });
        await vi.advanceTimersByTimeAsync(0);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Tekst do skopiowania ');
    });

    it('beeps when dictation starts and ends, unless sounds are switched off', async () => {
        const played = [];
        window.AudioContext = class {
            state = 'running';
            currentTime = 0;
            destination = {};
            createOscillator() {
                const frequency = { value: 0 };
                return { frequency, connect: node => node, start: () => played.push(frequency.value), stop() {} };
            }
            createGain() {
                const ramp = () => {};
                return { gain: { setValueAtTime: ramp, linearRampToValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: node => node };
            }
        };
        try {
            await startApp();
            await dictate('test dźwięku');
            // rising pair, then the same pair falling
            expect(played).toEqual([660, 880, 880, 660]);

            played.length = 0;
            $('soundToggle').click();
            await dictate('cisza');
            expect(played).toEqual([]);
        } finally {
            delete window.AudioContext;
        }
    });

    it('works without speech recognition', async () => {
        delete window.SpeechRecognition;
        await startApp();
        expect($('dictBtn').disabled).toBe(true);
    });
});
