// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Emitter } from '../../../web/js/core/emitter.js';
import { LanguageToggle } from '../../../web/js/ui/language-toggle.js';
import { PunctuationToggle } from '../../../web/js/ui/punctuation-toggle.js';
import { installShortcuts } from '../../../web/js/ui/shortcuts.js';
import { watchConnectivity } from '../../../web/js/ui/connectivity.js';
import { PinButton } from '../../../web/js/ui/pin-button.js';
import { EmptyState } from '../../../web/js/ui/empty-state.js';
import { DictationButton } from '../../../web/js/ui/dictation-button.js';
import { Editor } from '../../../web/js/ui/editor.js';
import { $, click, key, mountPage } from './fixture.js';

beforeEach(mountPage);

const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return { data, get: (k, d = null) => data[k] ?? d, set: (k, v) => { data[k] = v; return true; } };
};

describe('LanguageToggle', () => {
    it('cycles between Polish and English and informs dictation', () => {
        const dictation = { setLanguage: vi.fn() };
        new LanguageToggle({ dictation });
        click($('langToggle'));
        expect($('langToggle').textContent).toBe('EN');
        expect($('langToggle').classList.contains('en')).toBe(true);
        click($('langToggle'));
        expect($('langToggle').textContent).toBe('PL');
        expect($('langToggle').classList.contains('en')).toBe(false);
        expect(dictation.setLanguage.mock.calls).toEqual([['en-US'], ['pl-PL']]);
    });
});

describe('PunctuationToggle', () => {
    const assistant = indicator => ({ indicator, nano: { download: vi.fn() } });

    it('is on by default and punctuates', () => {
        const toggle = new PunctuationToggle({ storage: memoryStorage(), ai: assistant('on') });
        expect(toggle.enabled).toBe(true);
        expect($('punctToggle').classList.contains('active')).toBe(true);
        expect(toggle.apply('nie przyjdę bo jestem chory')).toBe('Nie przyjdę, bo jestem chory.');
    });

    it('can be switched off and remembers it', () => {
        const storage = memoryStorage();
        const toggle = new PunctuationToggle({ storage, ai: assistant('on') });
        click($('punctToggle'));
        expect(toggle.apply('tekst bez zmian')).toBe('tekst bez zmian');
        expect(storage.data['sp9ak-punct']).toBe('off');
        expect($('punctToggle').classList.contains('active')).toBe(false);
        expect(new PunctuationToggle({ storage, ai: assistant('on') }).enabled).toBe(false);
    });

    it('starts the model download instead of toggling when one is pending', () => {
        const ai = assistant('dl');
        const toggle = new PunctuationToggle({ storage: memoryStorage(), ai });
        click($('punctToggle'));
        expect(ai.nano.download).toHaveBeenCalled();
        expect(toggle.enabled).toBe(true);
    });
});

describe('installShortcuts', () => {
    let actions;
    beforeEach(() => {
        actions = { copyAll: vi.fn(), newNote: vi.fn(), toggleDictation: vi.fn(), dismiss: vi.fn() };
        installShortcuts(actions);
        window.getSelection = () => ({ toString: () => '' });
    });

    it('Ctrl+D toggles dictation, but not while the key is held down', () => {
        expect(key(document, { key: 'd', ctrlKey: true }).defaultPrevented).toBe(true);
        key(document, { key: 'd', ctrlKey: true, repeat: true });
        expect(actions.toggleDictation).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+N starts a new note', () => {
        key(document, { key: 'n', ctrlKey: true });
        expect(actions.newNote).toHaveBeenCalled();
    });

    it('Ctrl+C copies everything only without a selection', () => {
        key(document, { key: 'c', ctrlKey: true });
        expect(actions.copyAll).toHaveBeenCalledTimes(1);
        window.getSelection = () => ({ toString: () => 'zaznaczone' });
        const event = key(document, { key: 'c', ctrlKey: true });
        expect(actions.copyAll).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(false);
    });

    it('Ctrl+S is swallowed so the browser does not offer to save the page', () => {
        expect(key(document, { key: 's', ctrlKey: true }).defaultPrevented).toBe(true);
    });

    it('Escape dismisses', () => {
        key(document, { key: 'Escape' });
        expect(actions.dismiss).toHaveBeenCalled();
    });

    it('ignores other keys and key-less events', () => {
        key(document, { key: 'd' });
        key(document, {});
        expect(actions.toggleDictation).not.toHaveBeenCalled();
    });
});

describe('watchConnectivity', () => {
    it('warns when the connection drops and retries the provider when it returns', () => {
        const toast = { show: vi.fn() };
        const ai = { external: { reportOffline: vi.fn() }, reconnect: vi.fn() };
        watchConnectivity({ toast, ai });
        window.dispatchEvent(new Event('offline'));
        expect(toast.show).toHaveBeenLastCalledWith(expect.stringContaining('Brak internetu'), 4000);
        expect(ai.external.reportOffline).toHaveBeenCalled();
        window.dispatchEvent(new Event('online'));
        expect(toast.show).toHaveBeenLastCalledWith('Połączenie wróciło', 2000);
        expect(ai.reconnect).toHaveBeenCalled();
    });
});

describe('EmptyState', () => {
    let editor;
    let dictation;
    const isEmpty = () => $('emptyState').parentElement.classList.contains('is-empty');

    beforeEach(() => {
        editor = new Editor();
        dictation = Object.assign(new Emitter(), { listening: false, start: vi.fn() });
    });

    it('shows when the field is empty and nothing is happening', () => {
        new EmptyState({ editor, dictation });
        expect(isEmpty()).toBe(true);
    });

    it('hides once there is text and returns when it is emptied', () => {
        new EmptyState({ editor, dictation });
        editor.setText('coś');
        expect(isEmpty()).toBe(false);
        editor.setText('');
        expect(isEmpty()).toBe(true);
    });

    it('hides while dictating', () => {
        new EmptyState({ editor, dictation });
        dictation.listening = true;
        dictation.emit('started');
        expect(isEmpty()).toBe(false);
        dictation.listening = false;
        dictation.emit('stopped');
        expect(isEmpty()).toBe(true);
    });

    it('hides when the user chooses to type, until reset', () => {
        const state = new EmptyState({ editor, dictation });
        click($('typeBtn'));
        expect(isEmpty()).toBe(false);
        expect(document.activeElement).toBe($('output'));
        state.reset();
        expect(isEmpty()).toBe(true);
    });

    it('the big button starts dictation', () => {
        new EmptyState({ editor, dictation });
        click($('bigDictBtn'));
        expect(dictation.start).toHaveBeenCalled();
    });

    it('keeps the focus where it was when its buttons are pressed', () => {
        new EmptyState({ editor, dictation });
        const event = new MouseEvent('mousedown', { cancelable: true, bubbles: true });
        $('bigDictBtn').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('DictationButton', () => {
    const makeDictation = supported => Object.assign(new Emitter(), {
        supported, toggle: vi.fn(), rememberCaret: vi.fn(),
    });

    it('toggles dictation and remembers the caret before the click moves the focus', () => {
        const dictation = makeDictation(true);
        new DictationButton({ dictation, status: { set: vi.fn() } });
        $('dictBtn').dispatchEvent(new MouseEvent('mousedown'));
        click($('dictBtn'));
        expect(dictation.rememberCaret).toHaveBeenCalled();
        expect(dictation.toggle).toHaveBeenCalled();
    });

    it('shows the pause state while listening', () => {
        const dictation = makeDictation(true);
        new DictationButton({ dictation, status: { set: vi.fn() } });
        dictation.emit('started');
        expect($('dictLabel').textContent).toBe('Pauza');
        expect($('dictBtn').classList.contains('on')).toBe(true);
        expect($('micIcon').hasAttribute('hidden')).toBe(true);
        expect($('pauseIcon').hasAttribute('hidden')).toBe(false);
        dictation.emit('stopped');
        expect($('dictLabel').textContent).toBe('Dyktuj');
        expect($('dictBtn').classList.contains('on')).toBe(false);
        expect($('micIcon').hasAttribute('hidden')).toBe(false);
        expect($('pauseIcon').hasAttribute('hidden')).toBe(true);
    });

    it('is disabled with an explanation when speech recognition is unsupported', () => {
        const status = { set: vi.fn() };
        new DictationButton({ dictation: makeDictation(false), status });
        expect($('dictBtn').disabled).toBe(true);
        expect(status.set).toHaveBeenCalledWith(expect.stringContaining('nie obsługuje'));
    });
});

describe('PinButton', () => {
    const reply = payload => vi.fn().mockResolvedValue({ json: async () => payload });

    it('stays hidden where pinning is not supported', async () => {
        const pin = new PinButton({ toast: { show: vi.fn() }, fetchFn: reply({ supported: false, alwaysOnTop: false }) });
        await pin.load();
        expect($('pinBtn').hidden).toBe(true);
    });

    it('keeps asking until the window manager lists the window', async () => {
        vi.useFakeTimers();
        const fetchFn = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ supported: false, alwaysOnTop: false }) })
            .mockResolvedValue({ json: async () => ({ supported: true, alwaysOnTop: false }) });
        await new PinButton({ toast: { show: vi.fn() }, fetchFn }).load();
        expect($('pinBtn').hidden).toBe(true);
        await vi.advanceTimersByTimeAsync(1000);
        expect($('pinBtn').hidden).toBe(false);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    it('reserves the toolbar row until the answer is final', async () => {
        vi.useFakeTimers();
        const fetchFn = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ supported: false, alwaysOnTop: false }) })
            .mockResolvedValue({ json: async () => ({ supported: true, alwaysOnTop: false }) });
        await new PinButton({ toast: { show: vi.fn() }, fetchFn }).load();
        expect($('toolbar').classList.contains('pending')).toBe(true);
        await vi.advanceTimersByTimeAsync(1000);
        expect($('toolbar').classList.contains('pending')).toBe(false);
        vi.useRealTimers();
    });

    it('releases the reserved row when pinning never becomes available', async () => {
        vi.useFakeTimers();
        const fetchFn = reply({ supported: false, alwaysOnTop: false });
        await new PinButton({ toast: { show: vi.fn() }, fetchFn }).load();
        await vi.advanceTimersByTimeAsync(20000);
        expect($('toolbar').classList.contains('pending')).toBe(false);
        expect($('pinBtn').hidden).toBe(true);
        vi.useRealTimers();
    });

    it('shows the current state once the server reports support', async () => {
        const pin = new PinButton({ toast: { show: vi.fn() }, fetchFn: reply({ supported: true, alwaysOnTop: true }) });
        await pin.load();
        expect($('pinBtn').hidden).toBe(false);
        expect($('pinBtn').classList.contains('active')).toBe(true);
        expect($('pinBtn').getAttribute('aria-pressed')).toBe('true');
    });

    it('asks the server for the opposite state on click', async () => {
        const fetchFn = reply({ supported: true, alwaysOnTop: false });
        const pin = new PinButton({ toast: { show: vi.fn() }, fetchFn });
        await pin.load();
        fetchFn.mockResolvedValue({ json: async () => ({ supported: true, alwaysOnTop: true }) });
        await pin.toggle();
        expect(JSON.parse(fetchFn.mock.lastCall[1].body)).toEqual({ alwaysOnTop: true });
        expect(pin.pinned).toBe(true);
    });

    it('tells the user when the request fails', async () => {
        const toast = { show: vi.fn() };
        const pin = new PinButton({ toast, fetchFn: vi.fn().mockRejectedValue(new Error('down')) });
        await pin.toggle();
        expect(toast.show).toHaveBeenCalled();
    });
});
