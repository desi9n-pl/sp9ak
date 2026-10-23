import { Emitter } from '../core/emitter.js';

const READY_STATES = ['readily', 'available'];
const UNAVAILABLE_STATES = ['no', 'unavailable'];
const INITIALIZING_STATES = ['after-download', 'downloading'];

export const isReady = state => READY_STATES.includes(state);

/** Older Chrome returns `{ available }`, newer returns the string directly. */
export const normalizeAvailability = raw => (typeof raw === 'string' ? raw : (raw?.available ?? 'no'));

const findApi = () => globalThis.ai?.languageModel ?? globalThis.LanguageModel;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const MB = 1024 * 1024;
const READY_DETAIL = 'Korekta tekstu przez lokalny model AI (działa offline).';

/**
 * Chrome's on-device Gemini Nano (Prompt API).
 * Emits `status` ({ level: 'on' | 'dl' | 'off', text, detail }) and `progress` (text).
 */
export class GeminiNano extends Emitter {
    state = null;
    #session = null;
    #log;
    #getApi;
    #sleep;
    #pollMs;
    #maxWaitMs;

    constructor({ log, getApi = findApi, sleep = delay, pollMs = 4000, maxWaitMs = 3 * 60 * 1000 }) {
        super();
        this.#log = log;
        this.#getApi = getApi;
        this.#sleep = sleep;
        this.#pollMs = pollMs;
        this.#maxWaitMs = maxWaitMs;
    }

    get ready() {
        return isReady(this.state);
    }

    #report(level, text, detail = '') {
        this.emit('status', { level, text, detail });
    }

    /** Looks at what the browser offers and reports it. Never throws. */
    async check() {
        this.#log.info(`UA: ${navigator.userAgent}`);
        try {
            const api = this.#getApi();
            if (!api) {
                this.#log.err('Flaga Prompt API wyłączona – brak obiektu languageModel');
                this.#report('off', 'Flaga wyłączona',
                    'Włącz w Chrome:\nchrome://flags/#prompt-api-for-gemini-nano → Enabled\n\nPotem zrestartuj Chrome.');
                return;
            }
            this.#log.info('Wywołuję lm.availability()…');
            const raw = await api.availability();
            this.#log.info(`availability() surowa wartość: ${JSON.stringify(raw)}`);
            this.state = normalizeAvailability(raw);
            this.#log.info(`availability() po normalizacji: "${this.state}"`);
            await this.#reportState(api);
        } catch (err) {
            this.#log.err(`Błąd inicjalizacji: ${err.name}: ${err.message}`, err.stack);
            this.#report('off', 'Błąd inicjalizacji', `${err.message}\nUżywam interpunkcji regex jako fallback.`);
        }
    }

    async #reportState(api) {
        if (UNAVAILABLE_STATES.includes(this.state)) {
            this.#log.warn(`Model niedostępny (avail="${this.state}") – flaga może być wyłączona`);
            this.#report('off', 'Model niedostępny',
                'Flaga włączona, ale model nie jest dostępny.\n' +
                'Sprawdź chrome://on-device-internals lub odwiedź stronę jednorazowo na chrome://flags/#prompt-api-for-gemini-nano.');
            return;
        }
        if (this.state === 'downloadable') {
            this.#log.warn('Model do pobrania (avail="downloadable") – kliknij ✦ aby pobrać');
            this.#report('dl', 'Kliknij ✦ aby pobrać (~3–4 GB)',
                'Model Gemini Nano nie jest jeszcze pobrany.\n' +
                'Kliknij przycisk ✦ w pasku narzędzi – to uruchomi pobieranie.\n' +
                'Pobieranie zajmie kilka–kilkanaście minut (~3–4 GB).');
            return;
        }
        if (INITIALIZING_STATES.includes(this.state)) {
            this.#log.warn(`Model się inicjalizuje (avail="${this.state}") – czekam na gotowość…`);
            this.#report('dl', 'Inicjalizacja modelu…', 'Chrome rejestruje model. Proszę czekać.');
            if (!(await this.#waitUntilReady(api))) return;
        }
        this.#log.ok(`Model gotowy (avail="${this.state}")`);
        this.#report('on', 'Gemini Nano aktywny', READY_DETAIL);
    }

    /** Polls until the model is ready. Reports and returns false on failure or timeout. */
    async #waitUntilReady(api) {
        for (let waited = this.#pollMs; waited <= this.#maxWaitMs; waited += this.#pollMs) {
            await this.#sleep(this.#pollMs);
            this.state = normalizeAvailability(await api.availability());
            this.#log.info(`Polling (${waited / 1000}s): avail="${this.state}"`);
            if (this.ready) return true;
            if (UNAVAILABLE_STATES.includes(this.state)) {
                this.#report('off', 'Model niedostępny',
                    'Pobieranie lub inicjalizacja nie powiodły się.\nSprawdź chrome://on-device-internals.');
                return false;
            }
            this.emit('progress', `Inicjalizacja… ${waited / 1000}s`);
        }
        this.#log.err(`Timeout inicjalizacji modelu po ${this.#maxWaitMs / 1000}s`);
        this.#report('off', 'Timeout inicjalizacji',
            'Model nie stał się dostępny w ciągu 3 minut.\nSprawdź chrome://on-device-internals.');
        return false;
    }

    /** Starts the model download. Chrome only allows it from a user gesture. */
    async download() {
        const api = this.#getApi();
        if (!api) return;
        this.#log.info('downloadAndInit() – pobieranie modelu z gestu użytkownika…');
        this.#report('dl', 'Pobieranie modelu…', 'Trwa pobieranie Gemini Nano (~3–4 GB). Nie zamykaj aplikacji.');
        try {
            const session = await api.create({
                monitor: monitor => monitor.addEventListener('downloadprogress', e => this.#onDownloadProgress(e)),
            });
            session.destroy();
            this.state = 'readily';
            this.#log.ok('Model pobrany – Gemini Nano aktywny');
            this.#report('on', 'Gemini Nano aktywny', READY_DETAIL);
        } catch (err) {
            this.#log.err(`downloadAndInit błąd: ${err.name}: ${err.message}`, err.stack);
            this.#report('off', 'Błąd pobierania', err.message);
        }
    }

    #onDownloadProgress({ loaded, total }) {
        const percent = total ? Math.round((loaded / total) * 100) : '…';
        const totalMb = total ? (total / MB).toFixed(0) : '?';
        this.#log.info(`Pobieranie: ${percent}% (${(loaded / MB).toFixed(0)} / ${totalMb} MB)`);
        this.emit('progress', `Pobieranie: ${percent}%`);
    }

    /** Session for prompts, created on first use. Null when the model cannot be used. */
    async getSession() {
        if (this.#session) return this.#session;
        const api = this.#getApi();
        if (!api) {
            this.#log.err('getSemanticSession: brak languageModel API');
            return null;
        }
        try {
            // check() never ran when an external provider took priority at startup
            if (this.state === null) this.state = normalizeAvailability(await api.availability());
            if (!this.ready) {
                this.#log.warn('getSemanticSession: model niedostępny – pomijam');
                return null;
            }
            this.#log.info('Tworzę sesję semantyczną (lm.create)…');
            this.#session = await api.create();
            this.#log.ok('Sesja semantyczna gotowa');
            return this.#session;
        } catch (err) {
            this.#log.err(`getSemanticSession błąd: ${err.name}: ${err.message}`, err.stack);
            return null;
        }
    }

    dropSession() {
        this.#session = null;
    }
}
