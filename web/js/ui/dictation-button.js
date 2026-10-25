import { byId } from './dom.js';

/** The main record/pause button, kept in step with the dictation state. */
export class DictationButton {
    constructor({ dictation, status }) {
        this.dictation = dictation;
        this.button = byId('dictBtn');
        this.label = byId('dictLabel');
        this.micIcon = byId('micIcon');
        this.pauseIcon = byId('pauseIcon');

        if (!dictation.supported) {
            status.set('Przeglądarka nie obsługuje rozpoznawania mowy');
            this.button.disabled = true;
            return;
        }
        this.button.addEventListener('click', () => dictation.toggle());
        // remember where the caret was before the click moves the focus
        this.button.addEventListener('mousedown', () => dictation.rememberCaret());
        dictation.on('started', () => this.#show(true));
        dictation.on('stopped', () => this.#show(false));
    }

    #show(listening) {
        this.label.textContent = listening ? 'Pauza' : 'Dyktuj';
        this.micIcon.toggleAttribute('hidden', listening);
        this.pauseIcon.toggleAttribute('hidden', !listening);
        this.button.classList.toggle('on', listening);
    }
}
