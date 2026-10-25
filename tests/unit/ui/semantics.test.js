// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PanelManager } from '../../../web/js/ui/panels.js';
import { ThemePicker } from '../../../web/js/ui/theme-picker.js';
import { $, click, mountPage } from './fixture.js';

beforeEach(mountPage);

describe('page structure', () => {
    it('has a heading, a main landmark and a live status line', () => {
        expect(document.querySelector('h1')).not.toBeNull();
        expect(document.querySelectorAll('main')).toHaveLength(1);
        expect($('output').closest('main')).not.toBeNull();
        expect($('msg').getAttribute('role')).toBe('status');
    });

    it('labels every form field', () => {
        const unlabelled = [...document.querySelectorAll('input, select, textarea')]
            .filter(el => !el.closest('label') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
            .map(el => el.id);
        expect(unlabelled).toEqual([]);
        for (const el of document.querySelectorAll('[aria-labelledby]')) {
            expect($(el.getAttribute('aria-labelledby'))).not.toBeNull();
        }
    });
});

describe('panel buttons', () => {
    it('report whether their panel is expanded', () => {
        const panels = new PanelManager({
            settings: { panel: $('themesPanel'), button: $('settingsBtn') },
            history: { panel: $('historyPanel'), button: $('historyBtn') },
        });
        expect($('settingsBtn').getAttribute('aria-controls')).toBe('themesPanel');
        expect($('settingsBtn').getAttribute('aria-expanded')).toBe('false');
        click($('settingsBtn'));
        expect($('settingsBtn').getAttribute('aria-expanded')).toBe('true');
        click($('historyBtn'));
        expect($('settingsBtn').getAttribute('aria-expanded')).toBe('false');
        expect($('historyBtn').getAttribute('aria-expanded')).toBe('true');
        panels.closeAll();
        expect($('historyBtn').getAttribute('aria-expanded')).toBe('false');
    });
});

describe('theme buttons', () => {
    it('mark the chosen theme as pressed', () => {
        new ThemePicker({ storage: { get: (k, d) => d, set: () => true } });
        click(document.querySelector('[data-t="dark"]'));
        const pressed = [...document.querySelectorAll('[data-t]')].map(b => b.getAttribute('aria-pressed'));
        expect(pressed).toEqual(['false', 'false', 'true']);
    });
});
