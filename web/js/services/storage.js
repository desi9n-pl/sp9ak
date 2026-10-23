/** localStorage that never throws (private windows and blocked site data make it fail). */
export class Storage {
    #backend;

    constructor(backend = globalThis.localStorage) {
        this.#backend = backend;
    }

    get(key, fallback = null) {
        try {
            return this.#backend.getItem(key) ?? fallback;
        } catch {
            return fallback;
        }
    }

    set(key, value) {
        try {
            this.#backend.setItem(key, value);
            return true;
        } catch {
            return false;
        }
    }

    remove(key) {
        try {
            this.#backend.removeItem(key);
        } catch {
            // nothing to clean up if storage is unavailable
        }
    }
}
