// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ThickCaret } from '../../../web/js/ui/thick-caret.js';
import { $, mountPage } from './fixture.js';

// jsdom has no layout, so only the visibility rules are checked here; the position is covered by E2E.
let caret;
beforeEach(() => {
    mountPage();
    // otherwise the caret counts as scrolled out of a zero-height field
    Object.defineProperty($('output'), 'clientHeight', { value: 200 });
    caret = new ThickCaret($('output'));
});

describe('thick caret', () => {
    it('hides the native caret and adds a bar next to the field', () => {
        expect($('output').classList.contains('has-thick-caret')).toBe(true);
        expect($('output').nextElementSibling).toBe(caret.bar);
        expect(caret.bar.getAttribute('aria-hidden')).toBe('true');
    });

    it('is hidden while the field has no focus', () => {
        caret.update();
        expect(caret.bar.hidden).toBe(true);
    });

    it('is shown in the focused field', () => {
        $('output').focus();
        caret.update();
        expect(caret.bar.hidden).toBe(false);
        expect(caret.bar.classList.contains('blink')).toBe(true);
    });

    it('is hidden while text is selected', () => {
        $('output').value = 'Ala ma kota';
        $('output').focus();
        $('output').setSelectionRange(0, 3);
        caret.update();
        expect(caret.bar.hidden).toBe(true);
    });

    it('updates on its own after the field gets the focus', async () => {
        $('output').focus();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(caret.bar.hidden).toBe(false);
    });
});
