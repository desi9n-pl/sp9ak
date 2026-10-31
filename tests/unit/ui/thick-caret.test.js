// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../web/js/services/logger.js';
import { MAX_LENGTH, ThickCaret } from '../../../web/js/ui/thick-caret.js';
import { $, mountPage } from './fixture.js';

// jsdom has no layout, so only the visibility rules are checked here; the position is covered by E2E.
let caret, log;
beforeEach(() => {
    mountPage();
    // otherwise the caret counts as scrolled out of a zero-height field
    Object.defineProperty($('output'), 'clientHeight', { value: 200 });
    // jsdom does not implement these; one line-high box at the top left is enough
    Range.prototype.getClientRects = () => [{ left: 0, top: 0, height: 20 }];
    Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, height: 20 });
    log = new Logger();
    caret = new ThickCaret($('output'), { log });
});
afterEach(() => vi.restoreAllMocks());

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

    it('is drawn where drawAt says, within the text, instead of at the field caret', () => {
        let drawAt = 4;
        const measured = [];
        vi.spyOn(Range.prototype, 'setStart').mockImplementation((node, offset) => measured.push(offset));
        vi.spyOn(Range.prototype, 'setEnd').mockImplementation(() => {});
        const drawn = new ThickCaret($('output'), { drawAt: () => drawAt });
        $('output').value = 'Ala ma kota';
        $('output').focus();
        $('output').setSelectionRange(1, 1);
        drawn.update();
        drawAt = 99;
        drawn.update();
        drawAt = null;
        drawn.update();
        expect(measured).toEqual([4, 0, 1]);
    });

    it('keeps its copy of the text in step with edits anywhere in the field', () => {
        $('output').focus();
        for (const text of ['Ala ma kota', 'Ala ma psa i kota', 'ma psa i kota', 'ma psa', '', 'abc\n\n\ndef']) {
            $('output').value = text;
            caret.update();
            expect(caret.text.data).toBe(text);
        }
    });
});

describe('falling back to the native caret', () => {
    it('gives it back for a very long text and takes over again when the text gets shorter', () => {
        $('output').focus();
        $('output').value = 'a'.repeat(MAX_LENGTH + 1);
        caret.update();
        expect(caret.bar.hidden).toBe(true);
        expect($('output').classList.contains('has-thick-caret')).toBe(false);

        $('output').value = 'krótko';
        caret.update();
        expect(caret.bar.hidden).toBe(false);
        expect($('output').classList.contains('has-thick-caret')).toBe(true);
    });

    it('gives it back for good when a measurement fails, and logs why', () => {
        Range.prototype.getClientRects = () => { throw new Error('boom'); };
        $('output').focus();
        caret.update();
        expect(caret.bar.hidden).toBe(true);
        expect($('output').classList.contains('has-thick-caret')).toBe(false);
        expect(log.entries.at(-1)).toMatchObject({ level: 'warn', detail: 'Error: boom' });

        const measured = vi.fn(() => [{ left: 0, top: 0, height: 20 }]);
        Range.prototype.getClientRects = measured;
        caret.update();
        expect(measured).not.toHaveBeenCalled();
        expect($('output').classList.contains('has-thick-caret')).toBe(false);
    });
});
