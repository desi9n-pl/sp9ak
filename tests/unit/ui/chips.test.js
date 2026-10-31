// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $, click, mountPage } from './fixture.js';
import { LanguageToggle } from '../../../web/js/ui/language-toggle.js';
import { LoudToggle } from '../../../web/js/ui/loud-toggle.js';
import { CopyButton } from '../../../web/js/ui/copy-button.js';
import { CorrectedPane } from '../../../web/js/ui/corrected-pane.js';
import { Editor } from '../../../web/js/ui/editor.js';
import { HistoryView } from '../../../web/js/ui/history-view.js';
import { SoundToggle } from '../../../web/js/ui/sound-toggle.js';
import { ThemePicker } from '../../../web/js/ui/theme-picker.js';
import { Emitter } from '../../../web/js/core/emitter.js';

beforeEach(mountPage);

describe('setting chips', () => {
    it('are real buttons that report their state', () => {
        const storage = { get: (k, d = null) => d, set: () => true };
        new LoudToggle({ storage });
        const chip = $('loudToggle');
        expect(chip.tagName).toBe('BUTTON');
        expect(chip.getAttribute('aria-pressed')).toBe('false');
        click(chip);
        expect(chip.getAttribute('aria-pressed')).toBe('true');
    });

    it('announce the recognition language', () => {
        new LanguageToggle({ dictation: { setLanguage: () => {} } });
        expect($('langToggle').tagName).toBe('BUTTON');
        click($('langToggle'));
        expect($('langToggle').getAttribute('aria-label')).toBe('Język rozpoznawania: angielski');
    });
});

let sound;
let storage;

beforeEach(() => {
    sound = { enabled: true, play: vi.fn() };
    const values = new Map();
    storage = { get: (k, d = null) => values.get(k) ?? d, set: (k, v) => values.set(k, v) };
});

const cues = () => sound.play.mock.calls.map(([name]) => name);

describe('SoundToggle', () => {
    it('is on by default', () => {
        new SoundToggle({ storage, sound });
        expect($('soundToggle').checked).toBe(true);
        expect(sound.enabled).toBe(true);
    });

    it('remembers switching off and plays a sample when switched on', () => {
        new SoundToggle({ storage, sound });
        $('soundToggle').click();
        expect(sound.enabled).toBe(false);
        expect(storage.get('sp9ak-sounds')).toBe('off');

        new SoundToggle({ storage, sound });
        expect($('soundToggle').checked).toBe(false);
        expect(sound.enabled).toBe(false);

        $('soundToggle').click();
        expect(sound.enabled).toBe(true);
        expect(cues()).toContain('on');
    });
});

describe('views', () => {
    it('setting chips tick up when switched on and down when switched off', () => {
        new LoudToggle({ storage, sound });
        click($('loudToggle'));
        click($('loudToggle'));
        expect(cues()).toEqual(['on', 'off']);
    });

    it('choosing a language or a theme selects, but loading the theme makes no sound', () => {
        new ThemePicker({ storage, sound });
        expect(cues()).toEqual([]);
        click(document.querySelector('[data-t="dark"]'));
        new LanguageToggle({ dictation: { setLanguage: () => {} }, sound });
        click($('langToggle'));
        expect(cues()).toEqual(['select', 'select']);
    });

    it('copying confirms, and copying nothing gives a dull tick', async () => {
        Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
        const editor = new Editor();
        const copy = new CopyButton({ editor, corrected: new CorrectedPane({ toast: { show: vi.fn() } }), sound });
        await copy.copy();
        editor.setText('tekst');
        await copy.copy();
        expect(cues()).toEqual(['off', 'success']);
    });

    it('removing a session from the history sounds like removing', () => {
        const history = Object.assign(new Emitter(), {
            items: [{ id: 1, ts: 0, text: 'sesja' }],
            remove: vi.fn(),
        });
        new HistoryView({ history, onSelect: vi.fn(), sound }).render();
        click(document.querySelector('.sess-del'));
        expect(cues()).toEqual(['remove']);
    });
});
