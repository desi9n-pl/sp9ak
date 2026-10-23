import { Emitter } from '../core/emitter.js';
import { byId } from './dom.js';

/**
 * The main text field. Emits `input` (user typed), `interact` (the caret may have moved)
 * and `change` (any change to the text, including programmatic ones).
 */
export class Editor extends Emitter {
    constructor(el = byId('output')) {
        super();
        this.el = el;
        for (const type of ['mouseup', 'keyup', 'touchend', 'click', 'blur']) {
            el.addEventListener(type, () => this.emit('interact'));
        }
        el.addEventListener('input', () => {
            this.emit('input');
            this.emit('change');
        });
    }

    get value() {
        return this.el.value;
    }

    get caret() {
        return this.el.selectionStart;
    }

    setText(text) {
        this.el.value = text;
        this.emit('change');
    }

    setCaret(position) {
        this.el.selectionStart = this.el.selectionEnd = position;
    }

    focus() {
        this.el.focus();
    }
}
