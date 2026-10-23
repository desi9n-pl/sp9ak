import { Emitter } from '../core/emitter.js';
import { shouldSaveSession } from '../core/sessions.js';
import { STORAGE_KEYS } from '../config.js';

/**
 * Saved dictation sessions. The server file is the source of truth;
 * localStorage is a backup for when the server cannot be reached.
 */
export class SessionHistory extends Emitter {
    items = [];
    #lastSaved = '';
    #storage;
    #fetch;

    constructor({ storage, fetchFn = (...args) => globalThis.fetch(...args) }) {
        super();
        this.#storage = storage;
        this.#fetch = fetchFn;
    }

    async load() {
        try {
            const response = await this.#fetch('/api/sessions');
            if (!response.ok) throw new Error(String(response.status));
            this.items = await response.json();
        } catch {
            this.items = this.#loadBackup();
        }
        this.emit('change');
    }

    /** Returns true when the text was saved (long enough and not a repeat of the last save). */
    add(text) {
        const trimmed = text.trim();
        if (!shouldSaveSession(trimmed, this.#lastSaved)) return false;
        this.#lastSaved = trimmed;
        this.items.unshift({ id: crypto.randomUUID(), ts: new Date().toISOString(), text: trimmed });
        this.#changed();
        return true;
    }

    remove(id) {
        this.items = this.items.filter(s => s.id !== id);
        if (!this.items.length) this.#lastSaved = '';
        this.#changed();
    }

    clear() {
        this.items = [];
        this.#lastSaved = '';
        this.#changed();
    }

    #loadBackup() {
        try {
            const backup = JSON.parse(this.#storage.get(STORAGE_KEYS.sessions, '[]'));
            return Array.isArray(backup) ? backup : [];
        } catch {
            return [];
        }
    }

    #changed() {
        this.#persist();
        this.emit('change');
    }

    async #persist() {
        const body = JSON.stringify(this.items);
        this.#storage.set(STORAGE_KEYS.sessions, body);
        try {
            await this.#fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
        } catch {
            // server unreachable: the localStorage copy above is what remains
        }
    }
}
