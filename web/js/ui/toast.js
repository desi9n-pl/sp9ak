import { byId } from './dom.js';

const DEFAULT_DURATION_MS = 2200;

/** Short message at the bottom of the window. */
export class Toast {
    #timer = null;

    constructor(el = byId('toast')) {
        this.el = el;
    }

    show(text, durationMs = DEFAULT_DURATION_MS) {
        this.el.textContent = text;
        this.el.classList.add('show');
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.el.classList.remove('show'), durationMs);
    }
}
