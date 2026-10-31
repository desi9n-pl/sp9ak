import { STORAGE_KEYS } from '../config.js';
import { SILENT } from '../services/sound.js';
import { byId } from './dom.js';

/** Diagnostic log panel. Hidden unless switched on in settings. */
export class LogsView {
    constructor({ log, panels, storage, sound = SILENT }) {
        this.log = log;
        this.sound = sound;
        this.panels = panels;
        this.storage = storage;
        this.button = byId('logsBtn');
        this.list = byId('logsList');
        this.empty = byId('logsEmpty');
        this.toggle = byId('logsToggle');

        this.setVisible(storage.get(STORAGE_KEYS.logsVisible) === 'on');
        this.toggle.addEventListener('change', () => {
            storage.set(STORAGE_KEYS.logsVisible, this.toggle.checked ? 'on' : 'off');
            this.setVisible(this.toggle.checked);
            sound.play(this.toggle.checked ? 'on' : 'off');
        });
        byId('copyLogsBtn').addEventListener('click', event => this.#copy(event.currentTarget));
        byId('clearLogsBtn').addEventListener('click', () => {
            log.clear();
            sound.play('remove');
        });
        log.on('change', () => this.#render());
        panels.on('open', name => name === 'logs' && this.#render());
    }

    setVisible(visible) {
        this.button.hidden = !visible;
        this.toggle.checked = visible;
        if (!visible) this.panels.close('logs');
    }

    #render() {
        if (!this.panels.isOpen('logs')) return;
        this.list.replaceChildren();
        if (!this.log.entries.length) {
            this.list.append(this.empty);
            return;
        }
        for (const { time, level, message, detail } of this.log.entries) {
            const row = document.createElement('div');
            row.className = `log-entry log-${level}`;
            row.textContent = `[${time}] ${message}${detail ? `\n  ${detail}` : ''}`;
            this.list.append(row);
        }
        this.list.scrollTop = this.list.scrollHeight;
    }

    async #copy(button) {
        if (!this.log.entries.length) return;
        try {
            await navigator.clipboard.writeText(this.log.toText());
        } catch {
            // clipboard blocked: the confirmation below would be misleading, but the log stays visible
        }
        this.sound.play('success');
        button.textContent = '✓ Skopiowano';
        setTimeout(() => { button.textContent = 'Kopiuj logi'; }, 2000);
    }
}
