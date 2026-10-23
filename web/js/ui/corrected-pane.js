import { isEditKey } from '../core/edit-keys.js';
import { byId } from './dom.js';

const EDIT_HINT = 'Edytuj tekst w górnym okienku';
const REFRESH_DELAY_MS = 3000;

/** The read-only text below the editor: the dictated text after punctuation. */
export class CorrectedPane {
    #lastSource = '';
    #timer = null;

    constructor({ toast }) {
        this.section = byId('correctedSection');
        this.field = byId('corrected');
        this.#blockEditing(toast);
    }

    get value() {
        return this.field.value;
    }

    get visible() {
        return !this.section.hidden;
    }

    show() {
        this.section.hidden = false;
    }

    append(text) {
        this.show();
        this.field.value += text;
        this.field.scrollTop = this.field.scrollHeight;
    }

    clear() {
        this.field.value = '';
        this.section.hidden = true;
    }

    /**
     * Keeps the pane in step with manual edits of `editor`: a few seconds after the
     * text stops changing, it is rendered again with `render(text)`.
     */
    followEditor(editor, render) {
        editor.on('change', () => {
            clearTimeout(this.#timer);
            this.#timer = setTimeout(() => this.#refresh(editor, render), REFRESH_DELAY_MS);
        });
    }

    #refresh(editor, render) {
        const text = editor.value.trim();
        if (!this.visible || !text || text === this.#lastSource) return;
        this.#lastSource = text;
        this.field.value = `${render(text).trimEnd()} `;
    }

    /** Selecting and copying stay possible; anything that would change the text only shows a hint. */
    #blockEditing(toast) {
        const refuse = event => {
            event.preventDefault();
            toast.show(EDIT_HINT);
        };
        this.field.addEventListener('keydown', event => isEditKey(event) && refuse(event));
        for (const type of ['paste', 'cut', 'drop']) this.field.addEventListener(type, refuse);
        this.field.addEventListener('beforeinput', event => {
            if (event.inputType !== 'insertCompositionText') refuse(event);
        });
    }
}
