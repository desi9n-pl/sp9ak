import { STORAGE_KEYS } from '../config.js';
import { punctuate } from '../core/punctuation/index.js';
import { byId } from './dom.js';

/** The ✦ chip: switches automatic punctuation, or starts the Nano download when that is pending. */
export class PunctuationToggle {
    constructor({ storage, ai }) {
        this.storage = storage;
        this.ai = ai;
        this.chip = byId('punctToggle');
        this.enabled = storage.get(STORAGE_KEYS.punctuation) !== 'off';
        this.#render();
        this.chip.addEventListener('click', () => this.#onClick());
    }

    /** Punctuated text in the rules of `language`, or the input untouched when punctuation is switched off. */
    apply(text, language) {
        return this.enabled ? punctuate(text, language) : text;
    }

    #onClick() {
        if (this.ai.indicator === 'dl') {
            this.ai.nano.download();
            return;
        }
        this.enabled = !this.enabled;
        this.storage.set(STORAGE_KEYS.punctuation, this.enabled ? 'on' : 'off');
        this.#render();
    }

    #render() {
        this.chip.classList.toggle('active', this.enabled);
        this.chip.setAttribute('aria-pressed', String(this.enabled));
    }
}
