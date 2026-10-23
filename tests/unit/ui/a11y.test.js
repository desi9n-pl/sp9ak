// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountPage } from './fixture.js';

beforeEach(mountPage);

const nameOf = el => el.getAttribute('aria-label') || el.textContent.trim();

describe('accessible names', () => {
    it('gives every button a name that does not depend on its icon or title', () => {
        const unnamed = [...document.querySelectorAll('button')].filter(b => !nameOf(b)).map(b => b.id || b.className);
        expect(unnamed).toEqual([]);
    });

    it('hides decorative icons from assistive technology', () => {
        const exposed = [...document.querySelectorAll('svg:not([aria-hidden="true"])')].map(s => s.id || s.parentElement.id);
        expect(exposed).toEqual([]);
        expect(document.getElementById('waveform').getAttribute('aria-hidden')).toBe('true');
    });
});
