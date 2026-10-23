import { byId } from './dom.js';

/** Tiny toolbar button keeping the window above all others; hidden where the desktop cannot do it. */
export class PinButton {
    #fetch;

    constructor({ toast, fetchFn = (...args) => globalThis.fetch(...args) }) {
        this.toast = toast;
        this.#fetch = fetchFn;
        this.button = byId('pinBtn');
        this.pinned = false;
        this.button.addEventListener('click', () => this.toggle());
    }

    /** Asks the server whether pinning works here and what the current state is. */
    async load() {
        try {
            const state = await (await this.#fetch('/api/window', { cache: 'no-store' })).json();
            this.#render(state);
        } catch {
            // server unavailable: the button stays hidden
        }
    }

    async toggle() {
        try {
            const response = await this.#fetch('/api/window', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alwaysOnTop: !this.pinned }),
            });
            this.#render(await response.json());
        } catch {
            this.toast.show('Nie udało się zmienić przypięcia okna');
        }
    }

    #render({ supported, alwaysOnTop }) {
        this.button.hidden = !supported;
        this.pinned = Boolean(alwaysOnTop);
        this.button.classList.toggle('active', this.pinned);
        this.button.setAttribute('aria-pressed', String(this.pinned));
    }
}
