import { byId } from './dom.js';

/** Big "Dyktuj" button shown instead of an empty text field, until there is text or typing starts. */
export class EmptyState {
    #typing = false;

    constructor({ editor, dictation }) {
        this.editor = editor;
        this.dictation = dictation;
        this.container = byId('emptyState').parentElement;

        // keep the focus in the text field when these are pressed
        for (const id of ['bigDictBtn', 'typeBtn']) {
            byId(id).addEventListener('mousedown', event => event.preventDefault());
        }
        byId('bigDictBtn').addEventListener('click', () => dictation.start());
        byId('typeBtn').addEventListener('click', () => {
            this.#typing = true;
            this.refresh();
            editor.focus();
        });
        editor.on('change', () => this.refresh());
        dictation.on('started', () => this.refresh());
        dictation.on('stopped', () => this.refresh());
        this.refresh();
    }

    /** Back to the initial state (a new note starts empty). */
    reset() {
        this.#typing = false;
        this.refresh();
    }

    refresh() {
        const empty = !this.editor.value && !this.dictation.listening && !this.#typing;
        this.container.classList.toggle('is-empty', empty);
    }
}
