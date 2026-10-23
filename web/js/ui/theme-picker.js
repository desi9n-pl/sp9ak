import { STORAGE_KEYS, DEFAULT_THEME } from '../config.js';

/** Colour theme buttons. The choice is remembered in storage. */
export class ThemePicker {
    constructor({ storage, root = document.documentElement }) {
        this.storage = storage;
        this.root = root;
        this.buttons = [...document.querySelectorAll('[data-t]')];
        this.buttons.forEach(button => button.addEventListener('click', () => this.apply(button.dataset.t)));
        this.apply(storage.get(STORAGE_KEYS.theme, DEFAULT_THEME));
    }

    apply(theme) {
        this.root.dataset.theme = theme;
        this.storage.set(STORAGE_KEYS.theme, theme);
        this.buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.t === theme);
            button.setAttribute('aria-pressed', String(button.dataset.t === theme));
        });
    }
}
