import { SILENT } from '../services/sound.js';
import { byId } from './dom.js';

const LANGUAGES = [
    { code: 'pl-PL', label: 'PL', name: 'polski' },
    { code: 'en-US', label: 'EN', name: 'angielski' },
];

/** The PL / EN chip choosing the recognition language. */
export class LanguageToggle {
    constructor({ dictation, sound = SILENT }) {
        this.dictation = dictation;
        this.sound = sound;
        this.chip = byId('langToggle');
        this.index = 0;
        this.chip.addEventListener('click', () => this.next());
    }

    next() {
        this.index = (this.index + 1) % LANGUAGES.length;
        const { code, label, name } = LANGUAGES[this.index];
        this.chip.textContent = label;
        this.chip.setAttribute('aria-label', `Język rozpoznawania: ${name}`);
        this.chip.classList.toggle('en', this.index > 0);
        this.dictation.setLanguage(code);
        this.sound.play('select');
    }
}
