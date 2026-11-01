import { STORAGE_KEYS } from '../config.js';
import { byId } from './dom.js';

/**
 * Settings checkbox choosing how the thick caret blinks: squashing towards its middle (default) or going
 * off and on like the native one. The choice is a `data-caret` attribute on the root, read by editor.css.
 */
export class CaretStyleToggle {
    constructor({ storage }) {
        this.toggle = byId('caretSquashToggle');
        this.toggle.checked = storage.get(STORAGE_KEYS.caretBlink) !== 'blink';
        this.#apply();
        this.toggle.addEventListener('change', () => {
            storage.set(STORAGE_KEYS.caretBlink, this.toggle.checked ? 'squash' : 'blink');
            this.#apply();
        });
    }

    #apply() {
        document.documentElement.dataset.caret = this.toggle.checked ? 'squash' : 'blink';
    }
}
