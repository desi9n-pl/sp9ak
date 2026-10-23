// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelManager } from '../../../web/js/ui/panels.js';
import { click } from './fixture.js';

let panels;
const elements = {};

beforeEach(() => {
    document.body.innerHTML = '';
    for (const name of ['a', 'b', 'pinned']) {
        elements[name] = { panel: document.createElement('div'), button: document.createElement('button') };
    }
    panels = new PanelManager({
        a: elements.a,
        b: elements.b,
        pinned: { ...elements.pinned, pinned: true, manual: true },
    });
});

const open = name => elements[name].panel.classList.contains('open');
const active = name => elements[name].button.classList.contains('active');

describe('PanelManager', () => {
    it('opens a panel and marks its button', () => {
        panels.open('a');
        expect(open('a')).toBe(true);
        expect(active('a')).toBe(true);
        expect(panels.isOpen('a')).toBe(true);
    });

    it('closes the other panels when one opens', () => {
        panels.open('a');
        panels.open('b');
        expect(open('a')).toBe(false);
        expect(active('a')).toBe(false);
        expect(open('b')).toBe(true);
    });

    it('toggles from the button', () => {
        click(elements.a.button);
        expect(open('a')).toBe(true);
        click(elements.a.button);
        expect(open('a')).toBe(false);
    });

    it('leaves a pinned panel alone when an ordinary one opens', () => {
        panels.open('pinned');
        panels.open('a');
        expect(open('pinned')).toBe(true);
        expect(open('a')).toBe(true);
    });

    it('closes everything when the pinned panel opens', () => {
        panels.open('a');
        panels.open('pinned');
        expect(open('a')).toBe(false);
        expect(open('pinned')).toBe(true);
    });

    it('does not toggle a manual panel from its button', () => {
        click(elements.pinned.button);
        expect(open('pinned')).toBe(false);
    });

    it('closeAll closes even the pinned panel', () => {
        panels.open('a');
        panels.open('pinned');
        panels.closeAll();
        expect(['a', 'b', 'pinned'].some(open)).toBe(false);
    });

    it('emits open and close once per real change', () => {
        const opened = vi.fn();
        const closed = vi.fn();
        panels.on('open', opened);
        panels.on('close', closed);
        panels.open('a');
        panels.open('a');
        panels.close('a');
        panels.close('a');
        expect(opened.mock.calls).toEqual([['a']]);
        expect(closed.mock.calls).toEqual([['a']]);
    });
});
