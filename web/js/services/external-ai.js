import { Emitter } from '../core/emitter.js';
import { PROVIDERS, classifyError, maskApiKey, normalizeConfig, validateConfig } from '../core/providers.js';
import { STORAGE_KEYS } from '../config.js';

export const OFFLINE_ERROR = 'Failed to fetch (offline)';
const PING_PROMPT = 'Odpowiedz jednym słowem: OK';

/**
 * Claude / OpenAI, called through the local server's /api/ai proxy (browsers cannot reach them directly).
 * Emits `status` ({ level, text }), or null when the status line should disappear.
 */
export class ExternalAi extends Emitter {
    config;
    active = false;
    #storage;
    #fetch;
    #log;
    #isOnline;
    #timeoutMs;

    constructor({
        storage,
        log,
        fetchFn = (...args) => globalThis.fetch(...args),
        isOnline = () => navigator.onLine,
        // the server proxy enforces its own 30 s limit
        timeoutMs = 35_000,
    }) {
        super();
        this.#storage = storage;
        this.#log = log;
        this.#fetch = fetchFn;
        this.#isOnline = isOnline;
        this.#timeoutMs = timeoutMs;
        this.config = {
            provider: storage.get(STORAGE_KEYS.extProvider, ''),
            model: storage.get(STORAGE_KEYS.extModel, ''),
            apiKey: storage.get(STORAGE_KEYS.extKey, ''),
        };
    }

    get configured() {
        return Boolean(this.config.provider && this.config.apiKey);
    }

    get label() {
        return `${PROVIDERS[this.config.provider].label} (${this.config.model})`;
    }

    #report(level, text) {
        this.emit('status', { level, text });
    }

    /** Sends a prompt through the proxy. Rejects with a message `classifyError` understands. */
    async call(system, prompt, config = this.config) {
        if (!this.#isOnline()) throw new Error(OFFLINE_ERROR);
        // On a flaky connection a request must not hang forever.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
        try {
            const response = await this.#fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, system, prompt }),
                signal: controller.signal,
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data.text;
        } catch (err) {
            if (err.name === 'AbortError') throw new Error('timeout – brak odpowiedzi z API');
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    /** Stores a config from the form. The key is not checked until `activate()`. */
    save(raw) {
        this.config = normalizeConfig(raw);
        const { provider, model, apiKey } = this.config;
        this.#storage.set(STORAGE_KEYS.extProvider, provider);
        this.#storage.set(STORAGE_KEYS.extModel, model);
        this.#storage.set(STORAGE_KEYS.extKey, apiKey);
        this.active = false;
        return this.config;
    }

    clear() {
        for (const key of [STORAGE_KEYS.extProvider, STORAGE_KEYS.extModel, STORAGE_KEYS.extKey]) {
            this.#storage.remove(key);
        }
        this.config = { provider: '', model: '', apiKey: '' };
        this.active = false;
        this.emit('status', null);
    }

    /** Verifies the saved key with a real request and switches the provider on. */
    async activate() {
        if (!this.configured) return false;
        const local = validateConfig(this.config);
        if (!local.ok) {
            this.active = false;
            this.#report('off', local.error);
            return false;
        }
        this.#report('dl', 'Sprawdzam klucz…');
        try {
            await this.call('', PING_PROMPT);
            this.active = true;
            this.#report('on', `${this.label} aktywny`);
            this.#log.ok(`Zewn. AI aktywne: ${this.label}`);
            return true;
        } catch (err) {
            this.active = false;
            this.#report('off', `Błąd: ${classifyError(err.message).text}`);
            this.#log.err(`Zewn. AI błąd klucza: ${err.message}`);
            return false;
        }
    }

    /** Checks a key from the form without saving it or changing the active provider. */
    async test(raw) {
        const config = normalizeConfig(raw);
        const local = validateConfig(config);
        if (!local.ok) {
            this.#report('off', local.error);
            return false;
        }
        this.#report('dl', 'Testuję klucz…');
        try {
            await this.call('', PING_PROMPT, config);
            this.#report('on', `Klucz działa (${PROVIDERS[config.provider].label}, ${maskApiKey(config.apiKey)})`);
            return true;
        } catch (err) {
            this.#report('off', `Błąd: ${classifyError(err.message).text}`);
            return false;
        }
    }

    /** Shows the offline notice when a provider is configured. */
    reportOffline() {
        if (this.configured) this.#report('off', 'Brak połączenia z internetem');
    }
}
