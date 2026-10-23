// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { $, click, mountPage } from './fixture.js';
import { LanguageToggle } from '../../../web/js/ui/language-toggle.js';
import { LoudToggle } from '../../../web/js/ui/loud-toggle.js';

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
