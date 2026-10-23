import { byId } from './dom.js';

/** The status line: a dot, a message and the shortcut hint. */
export class StatusBar {
    constructor() {
        this.dot = byId('dot');
        this.message = byId('msg');
        this.hint = byId('kbdHint');
    }

    set(text, active = false) {
        this.message.textContent = text;
        this.dot.classList.toggle('on', active);
        this.hint.hidden = active;
    }

    idle() {
        this.set('Gotowy');
    }
}
