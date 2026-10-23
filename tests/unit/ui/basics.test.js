// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byId } from '../../../web/js/ui/dom.js';
import { Editor } from '../../../web/js/ui/editor.js';
import { Toast } from '../../../web/js/ui/toast.js';
import { StatusBar } from '../../../web/js/ui/status-bar.js';
import { InstallModal } from '../../../web/js/ui/install-modal.js';
import { ThemePicker } from '../../../web/js/ui/theme-picker.js';
import { $, click, mountPage } from './fixture.js';

beforeEach(mountPage);

describe('byId', () => {
    it('finds an element', () => {
        expect(byId('output')).toBe($('output'));
    });

    it('fails loudly for a missing one', () => {
        expect(() => byId('nope')).toThrow('Missing element #nope');
    });
});

describe('Editor', () => {
    it('reads and writes the text and the caret', () => {
        const editor = new Editor();
        editor.setText('abcdef');
        editor.setCaret(3);
        expect(editor.value).toBe('abcdef');
        expect(editor.caret).toBe(3);
    });

    it('announces programmatic changes as change only', () => {
        const editor = new Editor();
        const seen = [];
        editor.on('change', () => seen.push('change'));
        editor.on('input', () => seen.push('input'));
        editor.setText('x');
        expect(seen).toEqual(['change']);
    });

    it('announces typing as input and change', () => {
        const editor = new Editor();
        const seen = [];
        editor.on('change', () => seen.push('change'));
        editor.on('input', () => seen.push('input'));
        $('output').dispatchEvent(new Event('input'));
        expect(seen).toEqual(['input', 'change']);
    });

    it.each(['mouseup', 'keyup', 'touchend', 'click', 'blur'])('announces %s as interaction', type => {
        const editor = new Editor();
        const onInteract = vi.fn();
        editor.on('interact', onInteract);
        $('output').dispatchEvent(new Event(type));
        expect(onInteract).toHaveBeenCalledTimes(1);
    });

    it('focuses the field', () => {
        new Editor().focus();
        expect(document.activeElement).toBe($('output'));
    });
});

describe('Toast', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('shows a message and hides it after the duration', () => {
        const toast = new Toast();
        toast.show('cześć', 1000);
        expect($('toast').textContent).toBe('cześć');
        expect($('toast').classList.contains('show')).toBe(true);
        vi.advanceTimersByTime(1000);
        expect($('toast').classList.contains('show')).toBe(false);
    });

    it('restarts the countdown when a new message replaces the old one', () => {
        const toast = new Toast();
        toast.show('pierwszy', 1000);
        vi.advanceTimersByTime(800);
        toast.show('drugi', 1000);
        vi.advanceTimersByTime(800);
        expect($('toast').classList.contains('show')).toBe(true);
        vi.advanceTimersByTime(200);
        expect($('toast').classList.contains('show')).toBe(false);
    });
});

describe('StatusBar', () => {
    it('shows text and hides the shortcut hint while active', () => {
        const status = new StatusBar();
        status.set('Słucham…', true);
        expect($('msg').textContent).toBe('Słucham…');
        expect($('dot').classList.contains('on')).toBe(true);
        expect($('kbdHint').hidden).toBe(true);
    });

    it('returns to idle', () => {
        const status = new StatusBar();
        status.set('Słucham…', true);
        status.idle();
        expect($('msg').textContent).toBe('Gotowy');
        expect($('dot').classList.contains('on')).toBe(false);
        expect($('kbdHint').hidden).toBe(false);
    });
});

describe('InstallModal', () => {
    it('opens from the settings button and closes with ✕, the backdrop or close()', () => {
        const modal = new InstallModal();
        const isOpen = () => $('installModal').classList.contains('open');
        click($('installGeminiBtn'));
        expect(isOpen()).toBe(true);
        click($('installModalClose'));
        expect(isOpen()).toBe(false);
        click($('installGeminiBtn'));
        click($('installModal'));
        expect(isOpen()).toBe(false);
        modal.open();
        modal.close();
        expect(isOpen()).toBe(false);
    });

    it('stays open when the dialog itself is clicked', () => {
        new InstallModal();
        click($('installGeminiBtn'));
        click($('installModal').querySelector('.modal'));
        expect($('installModal').classList.contains('open')).toBe(true);
    });
});

describe('ThemePicker', () => {
    const storage = initial => {
        const data = { 'sp9ak-theme': initial };
        return { data, get: (k, d) => data[k] ?? d, set: (k, v) => { data[k] = v; } };
    };

    it('applies the saved theme', () => {
        new ThemePicker({ storage: storage('dark') });
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(document.querySelector('[data-t="dark"]').classList.contains('active')).toBe(true);
        expect(document.querySelector('[data-t="light"]').classList.contains('active')).toBe(false);
    });

    it('switches and remembers the choice', () => {
        const store = storage(undefined);
        new ThemePicker({ storage: store });
        expect(document.documentElement.dataset.theme).toBe('sepia');
        click(document.querySelector('[data-t="light"]'));
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(store.data['sp9ak-theme']).toBe('light');
    });
});
