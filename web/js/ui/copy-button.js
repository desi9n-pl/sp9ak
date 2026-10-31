import { SILENT } from '../services/sound.js';
import { byId } from './dom.js';

const CONFIRMATION_MS = 2000;

/** Copies the corrected text, or the original when there is no correction yet. */
export class CopyButton {
    constructor({ editor, corrected, sound = SILENT }) {
        this.editor = editor;
        this.corrected = corrected;
        this.sound = sound;
        this.button = byId('copyBtn');
        this.label = byId('copyLabel');
        this.button.addEventListener('click', () => this.copy());
    }

    async copy() {
        this.corrected.flush();
        const field = this.corrected.value ? this.corrected.field : this.editor.el;
        if (!field.value) {
            this.sound.play('off');
            return;
        }
        try {
            await navigator.clipboard.writeText(field.value);
        } catch {
            this.#copyBySelection(field);
        }
        this.sound.play('success');
        this.label.textContent = '✓ Skopiowano';
        this.button.classList.add('ok');
        setTimeout(() => {
            this.label.textContent = 'Kopiuj';
            this.button.classList.remove('ok');
        }, CONFIRMATION_MS);
    }

    /** Fallback for when the async clipboard API is refused; restores the user's selection. */
    #copyBySelection(field) {
        const { selectionStart, selectionEnd } = field;
        field.select();
        document.execCommand('copy');
        field.setSelectionRange(selectionStart, selectionEnd);
    }
}
