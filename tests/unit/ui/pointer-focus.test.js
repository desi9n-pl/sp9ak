// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../../web/js/ui/editor.js';
import { InstallModal } from '../../../web/js/ui/install-modal.js';
import { installPointerFocus } from '../../../web/js/ui/pointer-focus.js';
import { $, mountPage } from './fixture.js';

const mouseClick = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
const keyboardClick = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));

let editor;
beforeEach(() => {
    mountPage();
    editor = new Editor();
    installPointerFocus({ editor });
});

describe('focus after a mouse click', () => {
    it('returns to the text field', () => {
        $('historyBtn').focus();
        mouseClick($('historyBtn'));
        expect(document.activeElement).toBe($('output'));
    });

    it('stays on the button when it was activated from the keyboard', () => {
        $('historyBtn').focus();
        keyboardClick($('historyBtn'));
        expect(document.activeElement).toBe($('historyBtn'));
    });

    it('ignores clicks that are not on a button', () => {
        $('msg').focus();
        mouseClick($('msg'));
        expect(document.activeElement).not.toBe($('output'));
    });

    it('does not take the focus from the install dialog it just opened', () => {
        new InstallModal();
        $('installGeminiBtn').focus();
        mouseClick($('installGeminiBtn'));
        expect(document.activeElement).toBe($('installModal').querySelector('.modal'));
    });

    it('leaves the dialog to give the focus back to its opener', () => {
        new InstallModal();
        $('installGeminiBtn').focus();
        mouseClick($('installGeminiBtn'));
        $('installModalClose').focus();
        mouseClick($('installModalClose'));
        expect(document.activeElement).toBe($('installGeminiBtn'));
    });
});
