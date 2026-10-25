import { isEditKey } from '../core/edit-keys.js';
import { byId } from './dom.js';

const EDIT_HINT = 'Edytuj tekst w górnym okienku';
const REFRESH_DELAY_MS = 3000;
const LOADER_FRAMES = ['.', '..', '...'];
const LOADER_STEP_MS = 400;

/** The read-only text below the editor: the dictated text after punctuation. */
export class CorrectedPane {
    #lastSource = '';
    #timer = null;
    #loaderTimer = null;
    #pending = null;

    constructor({ toast }) {
        this.section = byId('correctedSection');
        this.loader = byId('correctedLoader');
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
     * Keeps the pane in step with edits of `editor`: the first change after a rendering
     * schedules the next one REFRESH_DELAY_MS later, so continuous typing or dictation
     * cannot postpone it. `render(text)` produces the new content; a dots loader shows meanwhile.
     */
    followEditor(editor, render) {
        editor.on('change', () => {
            this.#pending = () => this.#refresh(editor, render);
            if (this.#timer) return;
            this.#timer = setTimeout(() => this.flush(), REFRESH_DELAY_MS);
            this.#startLoader();
        });
    }

    /** Renders a manual edit that is still waiting for its delay, so readers never see the old version. */
    flush() {
        clearTimeout(this.#timer);
        this.#timer = null;
        this.#stopLoader();
        const refresh = this.#pending;
        this.#pending = null;
        refresh?.();
    }

    #startLoader() {
        let frame = 0;
        const step = () => { this.loader.textContent = ` ${LOADER_FRAMES[frame++ % LOADER_FRAMES.length]}`; };
        step();
        this.#loaderTimer = setInterval(step, LOADER_STEP_MS);
    }

    #stopLoader() {
        clearInterval(this.#loaderTimer);
        this.loader.textContent = '';
    }

    #refresh(editor, render) {
        const text = editor.value.trim();
        if (!this.visible) return;
        if (!text) {
            // Emptied editor: leave no old rendering behind, and let the same text render again later.
            this.#lastSource = '';
            this.field.value = '';
            return;
        }
        if (text === this.#lastSource) return;
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
