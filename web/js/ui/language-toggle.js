import { byId } from './dom.js';

const LANGUAGES = [
    { code: 'pl-PL', label: 'PL' },
    { code: 'en-US', label: 'EN' },
];

/** The PL / EN chip choosing the recognition language. */
export class LanguageToggle {
    constructor({ dictation }) {
        this.dictation = dictation;
        this.chip = byId('langToggle');
        this.index = 0;
        this.chip.addEventListener('click', () => this.next());
    }

    next() {
        this.index = (this.index + 1) % LANGUAGES.length;
        const { code, label } = LANGUAGES[this.index];
        this.chip.textContent = label;
        this.chip.classList.toggle('en', this.index > 0);
        this.dictation.setLanguage(code);
    }
}
