import { byId } from './dom.js';

/** The Gemini Nano installation guide dialog. */
export class InstallModal {
    constructor() {
        this.backdrop = byId('installModal');
        byId('installGeminiBtn').addEventListener('click', () => this.open());
        byId('installModalClose').addEventListener('click', () => this.close());
        this.backdrop.addEventListener('click', event => {
            if (event.target === this.backdrop) this.close();
        });
    }

    open() {
        this.backdrop.classList.add('open');
    }

    close() {
        this.backdrop.classList.remove('open');
    }
}
