import { Emitter } from '../core/emitter.js';
import { SpeechSpan, resolveStartPosition } from '../core/speech-span.js';
import { nextRetryDelay } from '../core/retry.js';
import { DEFAULT_LANGUAGE } from '../config.js';

const ERROR_MESSAGES = {
    'not-allowed': 'Brak dostępu do mikrofonu',
    'audio-capture': 'Nie znaleziono mikrofonu',
    'network': 'Błąd połączenia sieciowego',
};
// After these the recognizer cannot continue, so the dictation ends.
const FATAL_ERRORS = ['not-allowed', 'audio-capture'];

/**
 * Speech recognition writing into a text field.
 *
 * Emits:
 *  - `status`   { text, active }   progress line for the status bar
 *  - `started`                     the recognizer is listening
 *  - `stopped`                     dictation ended (also on fatal errors)
 *  - `toast`    { text, ms }       something worth telling the user
 *  - `finished` { text }           final dictated text, once per dictation
 */
export class Dictation extends Emitter {
    language = DEFAULT_LANGUAGE;
    span = new SpeechSpan();
    #editor;
    #recognition;
    #listening = false;
    #rememberedCaret = 0;
    #networkFailures = 0;
    #networkError = false;
    #fatalMessage = null;
    // stop() was called but the engine has not reported `end` yet; start() would throw until it does
    #stopping = false;
    #startRequested = false;

    /**
     * @param editor        text field wrapper (see ui/editor.js)
     * @param createRecognition  returns a SpeechRecognition-like object, or null when unsupported
     */
    constructor({ editor, createRecognition }) {
        super();
        this.#editor = editor;
        this.#recognition = createRecognition();
        if (this.#recognition) this.#configure();
        editor.on('interact', () => this.rememberCaret());
        editor.on('input', () => this.#reanchor());
    }

    get supported() {
        return this.#recognition !== null;
    }

    get listening() {
        return this.#listening;
    }

    get hasInterim() {
        return this.span.interim !== '';
    }

    /** Called when the user moves the caret, so a later dictation starts there. */
    rememberCaret() {
        if (!this.#listening) this.#rememberedCaret = this.#editor.caret;
    }

    /** Points the next dictation (and the remembered caret) at `position`. */
    moveTo(position) {
        this.span.begin(position);
        this.#rememberedCaret = position;
    }

    setLanguage(language) {
        this.language = language;
        if (this.#recognition) this.#recognition.lang = language;
    }

    toggle() {
        if (this.#listening) this.stop();
        else this.start();
    }

    start() {
        if (!this.supported || this.#listening) return;
        if (this.#stopping) {
            this.#startRequested = true;
            return;
        }
        this.span.begin(resolveStartPosition(this.#editor.caret, this.#rememberedCaret, this.#editor.value.length));
        this.#listening = true;
        this.#recognition.lang = this.language;
        try {
            this.#recognition.start();
        } catch {
            this.#listening = false;
            this.#status('Błąd uruchamiania mikrofonu');
        }
    }

    stop() {
        this.#startRequested = false;
        if (!this.#listening) return;
        this.#listening = false;
        this.#stopping = true;
        this.#recognition.stop();
    }

    #configure() {
        const rec = this.#recognition;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = this.language;
        rec.onstart = () => {
            this.#status('Słucham…', true);
            this.emit('started');
        };
        rec.onresult = event => this.#onResult(event);
        rec.onerror = event => this.#onError(event);
        rec.onend = () => this.#onEnd();
    }

    #status(text, active = false) {
        this.emit('status', { text, active });
    }

    #write(final, interim) {
        const { value, caret } = this.span.apply(this.#editor.value, final, interim);
        this.#editor.setText(value);
        this.#editor.setCaret(caret);
    }

    /** The user typed while dictating: the recognizer's text now continues from the caret. */
    #reanchor() {
        if (this.#listening) this.span.begin(this.#editor.caret);
    }

    #onResult(event) {
        this.#networkFailures = 0;
        let finals = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const { transcript } = event.results[i][0];
            if (event.results[i].isFinal) finals += `${transcript} `;
            else interim += transcript;
        }
        this.#write(this.span.final + finals, interim);
    }

    #onError({ error }) {
        if (error === 'no-speech') return;
        this.#status(ERROR_MESSAGES[error] ?? `Błąd: ${error}`);
        if (error === 'network') {
            this.#networkError = true;
            this.#networkFailures++;
            this.emit('toast', { text: 'Dyktowanie wymaga internetu (silnik mowy Chrome działa w chmurze)', ms: 3500 });
        }
        if (FATAL_ERRORS.includes(error)) {
            // The recognizer still fires `end` afterwards; keep the message instead of "Gotowy".
            this.#fatalMessage = ERROR_MESSAGES[error];
            this.#listening = false;
            this.emit('stopped');
        }
    }

    #onEnd() {
        this.#stopping = false;
        if (!this.#listening) {
            this.#finish();
            return;
        }
        // Chrome ends the session on its own (silence, network). Freeze what was heard so the
        // restarted engine, which begins from scratch, cannot overwrite it.
        if (this.span.commitInterim()) this.#write(this.span.final, '');
        if (this.#networkError) this.#retryAfterNetworkError();
        else this.#restart();
    }

    #retryAfterNetworkError() {
        this.#networkError = false;
        const delay = nextRetryDelay(this.#networkFailures - 1);
        if (delay === null) {
            this.#listening = false;
            this.#networkFailures = 0;
            this.emit('toast', { text: 'Dyktowanie przerwane – brak stabilnego połączenia. Tekst zachowany.', ms: 4000 });
            this.#finish();
            return;
        }
        this.#status('Brak połączenia – ponawiam…', true);
        setTimeout(() => {
            if (this.#listening) this.#restart();
        }, delay);
    }

    #restart() {
        try {
            this.#recognition.start();
        } catch {
            // already running: the engine restarted by itself
        }
    }

    #finish() {
        this.span.commitInterim();
        // nothing was said: a bare start/stop must not leave a space behind
        const { final } = this.span;
        const raw = final === '' || final.endsWith(' ') ? final : `${final} `;
        this.#write(raw, '');
        this.emit('stopped');
        this.emit('finished', { text: this.span.final });
        this.#status(this.#fatalMessage ?? 'Gotowy');
        this.#fatalMessage = null;
        this.#rememberedCaret = this.#editor.caret;
        this.#editor.focus();
        if (this.#startRequested) {
            this.#startRequested = false;
            this.start();
        }
    }
}
