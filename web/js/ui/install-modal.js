import { byId } from './dom.js';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The Gemini Nano installation guide dialog: keeps focus inside while open and gives it back on close. */
export class InstallModal {
    #opener = null;

    constructor() {
        this.backdrop = byId('installModal');
        this.dialog = this.backdrop.querySelector('.modal');
        byId('installGeminiBtn').addEventListener('click', () => this.open());
        byId('installModalClose').addEventListener('click', () => this.close());
        this.backdrop.addEventListener('click', event => {
            if (event.target === this.backdrop) this.close();
        });
        this.backdrop.addEventListener('keydown', event => this.#trapTab(event));
    }

    open() {
        this.#opener = document.activeElement;
        this.backdrop.classList.add('open');
        this.dialog.focus();
    }

    close() {
        if (!this.backdrop.classList.contains('open')) return;
        this.backdrop.classList.remove('open');
        this.#opener?.focus?.();
        this.#opener = null;
    }

    /** Tab and Shift+Tab wrap around inside the dialog instead of reaching the page behind it. */
    #trapTab(event) {
        if (event.key !== 'Tab') return;
        const items = [...this.dialog.querySelectorAll(FOCUSABLE)].filter(el => !el.hidden);
        const first = items[0];
        const last = items.at(-1);
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === this.dialog)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }
}
