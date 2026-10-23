import { Emitter } from '../core/emitter.js';

/**
 * Bottom panels (settings, history, logs, semantic review) and their toggle buttons.
 * Opening a panel closes the others. A `pinned` panel is the exception: other panels
 * opening leave it alone, so review results stay visible while the text is edited.
 * Emits `open` and `close` with the panel name.
 */
export class PanelManager extends Emitter {
    /**
     * @param definitions  { name: { panel, button, pinned?, manual? } }.
     *   The button toggles its panel unless `manual` is set (the owner of the panel decides).
     */
    constructor(definitions) {
        super();
        this.definitions = definitions;
        for (const [name, { button, manual }] of Object.entries(definitions)) {
            if (!manual) button.addEventListener('click', () => this.toggle(name));
        }
    }

    isOpen(name) {
        return this.definitions[name].panel.classList.contains('open');
    }

    open(name) {
        for (const other of Object.keys(this.definitions)) {
            if (other !== name && (!this.definitions[other].pinned || this.definitions[name].pinned)) this.close(other);
        }
        this.#set(name, true);
    }

    close(name) {
        this.#set(name, false);
    }

    toggle(name) {
        if (this.isOpen(name)) this.close(name);
        else this.open(name);
    }

    closeAll() {
        for (const name of Object.keys(this.definitions)) this.close(name);
    }

    #set(name, open) {
        const { panel, button } = this.definitions[name];
        const changed = panel.classList.contains('open') !== open;
        panel.classList.toggle('open', open);
        button.classList.toggle('active', open);
        if (changed) this.emit(open ? 'open' : 'close', name);
    }
}
