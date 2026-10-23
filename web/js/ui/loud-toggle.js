import { STORAGE_KEYS } from '../config.js';
import { byId } from './dom.js';

/** The Aa chip: switches CAPITALS for phrases spoken much louder than the speaker's usual level. */
export class LoudToggle {
    constructor({ storage }) {
        this.storage = storage;
        this.chip = byId('loudToggle');
        this.enabled = storage.get(STORAGE_KEYS.loudCaps) === 'on';
        this.#render();
        this.chip.addEventListener('click', () => {
            this.enabled = !this.enabled;
            this.storage.set(STORAGE_KEYS.loudCaps, this.enabled ? 'on' : 'off');
            this.#render();
        });
    }

    #render() {
        this.chip.classList.toggle('active', this.enabled);
    }
}
