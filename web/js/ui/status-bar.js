import { byId } from './dom.js';

/** The status line: a dot and a message. */
export class StatusBar {
    constructor() {
        this.dot = byId('dot');
        this.message = byId('msg');
    }

    set(text, active = false) {
        this.message.textContent = text;
        this.dot.classList.toggle('on', active);
    }

    idle() {
        this.set('Gotowy');
    }
}
