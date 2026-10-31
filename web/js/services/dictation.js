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
// How long stop() waits for the engine to report `end` before the dictation is finished without it.
const STOP_TIMEOUT_MS = 2000;

/**
 * Speech recognition writing into a text field.
 *
 * Emits:
 *  - `status`   { text, active }   progress line for the status bar
 *  - `started`                     the recognizer is listening (again after every automatic restart)
 *  - `stopped`                     dictation ended (also on fatal errors)
 *  - `began`                       once per dictation, when the recognizer first listens
 *  - `ended`    { failed }         once per dictation, when it is over; `failed` if it broke off
 *  - `toast`    { text, ms }       something worth telling the user
 *  - `finished` { text }           final dictated text, once per dictation
 */
export class Dictation extends Emitter {
    language = DEFAULT_LANGUAGE;
    span = new SpeechSpan();
    #editor;
    #loudness;
    #recognition;
    #listening = false;
    #rememberedCaret = 0;
    #networkFailures = 0;
    #networkError = false;
    #fatalMessage = null;
    // the network kept failing and the dictation was given up
    #gaveUp = false;
    // `began` was emitted for the current dictation
    #began = false;
    // stop() was called but the engine has not reported `end` yet; start() would throw until it does
    #stopping = false;
    #stopTimer = null;
    // the dictation was finished (`finished` emitted); a late `end` of its engine must not finish it again
    #settled = true;
    // waiting to start the engine again after a network error
    #retryTimer = null;
    #startRequested = false;
    // Enter was pressed in the middle of a phrase: the line break waits until the phrase is final
    #pendingBreak = false;

    /**
     * @param editor        text field wrapper (see ui/editor.js)
     * @param createRecognition  returns a SpeechRecognition-like object, or null when unsupported
     * @param loudness      optional { tracker, enabled() }: phrases spoken louder than usual become CAPITALS
     */
    constructor({ editor, createRecognition, loudness = null }) {
        super();
        this.#editor = editor;
        this.#loudness = loudness;
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

    /** End of the words still being recognized, where the caret appears to be; null when there are none. */
    get interimEnd() {
        return this.#listening && this.hasInterim ? this.span.start + this.span.length : null;
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
        this.#pendingBreak = false;
        this.#began = false;
        this.#settled = false;
        this.#listening = true;
        this.#recognition.lang = this.language;
        try {
            this.#recognition.start();
        } catch {
            this.#listening = false;
            this.#status('Błąd uruchamiania mikrofonu');
            this.emit('ended', { failed: true });
        }
    }

    stop() {
        this.#startRequested = false;
        if (!this.#listening) return;
        this.#listening = false;
        if (this.#retryTimer !== null) {
            // the engine already ended and is only waiting to be restarted: nothing will acknowledge stop()
            clearTimeout(this.#retryTimer);
            this.#retryTimer = null;
            this.#finish();
            return;
        }
        this.#stopping = true;
        this.#status('Zatrzymuję…', true);
        this.#stopTimer = setTimeout(() => this.#giveUpWaiting(), STOP_TIMEOUT_MS);
        this.#recognition.stop();
    }

    /** The engine never reported `end` after stop(): end the dictation anyway so the user is not left stuck. */
    #giveUpWaiting() {
        this.#stopTimer = null;
        if (!this.#stopping) return;
        this.#stopping = false;
        this.#settled = true; // the abandoned engine's `end` is ignored from now on
        try {
            this.#recognition.abort?.();
        } catch {
            // nothing left to abort
        }
        this.#finish();
    }

    #configure() {
        const rec = this.#recognition;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = this.language;
        rec.onstart = () => {
            this.#status('Słucham…', true);
            this.emit('started');
            if (!this.#began) {
                this.#began = true;
                this.emit('began');
            }
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
        if (!this.#listening) return;
        if (this.#deferBreak()) return;
        const caret = this.#dropInterim(this.#editor.caret);
        this.#editor.setCaret(caret);
        this.span.begin(caret);
    }

    /**
     * Enter pressed right before the unfinished phrase would split it across two lines. The break
     * is taken back out of the field and re-applied once the phrase is final. Returns true if so.
     */
    #deferBreak() {
        const interim = this.span.interim.trim();
        const { value, caret } = this.#editor;
        if (!interim || value[caret - 1] !== '\n' || !value.slice(caret).trimStart().startsWith(interim)) return false;
        this.#editor.setText(value.slice(0, caret - 1) + value.slice(caret));
        this.#editor.setCaret(caret - 1);
        this.#pendingBreak = true;
        return true;
    }

    /** Ends the line of a finished phrase when Enter was pressed while it was still being spoken. */
    #applyPendingBreak() {
        if (!this.#pendingBreak || this.span.interim) return;
        this.#pendingBreak = false;
        this.span.final = `${this.span.final.trimEnd()}\n`;
    }

    /**
     * The unfinished phrase is no longer owned by any span once the user edits, yet the recognizer
     * will report it again from the new anchor; leaving it in the field would write it twice.
     * Returns the caret, moved back if the phrase stood before it.
     */
    #dropInterim(caret) {
        const { start } = this.span;
        // The field holds the phrase with doubled spaces collapsed (see SpeechSpan.apply), so match it trimmed.
        const interim = this.span.interim.trim();
        if (!interim) return caret;
        const value = this.#editor.value;
        const at = value.indexOf(interim, start);
        if (at === -1) return caret;
        this.#editor.setText(value.slice(0, at) + value.slice(at + interim.length));
        return at < caret ? caret - interim.length : caret;
    }

    #onResult(event) {
        this.#networkFailures = 0;
        let finals = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const { transcript } = event.results[i][0];
            if (event.results[i].isFinal) finals += `${this.#shout() ? transcript.toUpperCase() : transcript} `;
            else interim += transcript;
        }
        this.span.final += finals;
        this.span.interim = interim;
        this.#applyPendingBreak();
        this.#write(this.span.final, interim);
    }

    /** Closes the phrase for the loudness tracker; true when it should be written in capitals. */
    #shout() {
        const loud = this.#loudness?.tracker.takeSegment() ?? false;
        return loud && this.#loudness.enabled();
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
        clearTimeout(this.#stopTimer);
        this.#stopTimer = null;
        if (!this.#listening) {
            if (!this.#settled) this.#finish();
            return;
        }
        // Chrome ends the session on its own (silence, network). Freeze what was heard so the
        // restarted engine, which begins from scratch, cannot overwrite it.
        if (this.span.commitInterim()) {
            this.#applyPendingBreak();
            this.#write(this.span.final, '');
        }
        if (this.#networkError) this.#retryAfterNetworkError();
        else this.#restart();
    }

    #retryAfterNetworkError() {
        this.#networkError = false;
        const delay = nextRetryDelay(this.#networkFailures - 1);
        if (delay === null) {
            this.#listening = false;
            this.#networkFailures = 0;
            this.#gaveUp = true;
            this.emit('toast', { text: 'Dyktowanie przerwane – brak stabilnego połączenia. Tekst zachowany.', ms: 4000 });
            this.#finish();
            return;
        }
        this.#status('Brak połączenia – ponawiam…', true);
        this.#retryTimer = setTimeout(() => {
            this.#retryTimer = null;
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
        this.#settled = true;
        this.span.commitInterim();
        this.#applyPendingBreak();
        // nothing was said: a bare start/stop must not leave a space behind
        const { final } = this.span;
        const raw = final === '' || /[ \n]$/.test(final) ? final : `${final} `;
        this.#write(raw, '');
        this.emit('stopped');
        this.emit('finished', { text: this.span.final });
        this.emit('ended', { failed: this.#fatalMessage !== null || this.#gaveUp });
        this.#status(this.#fatalMessage ?? 'Gotowy');
        this.#fatalMessage = null;
        this.#gaveUp = false;
        this.#rememberedCaret = this.#editor.caret;
        this.#editor.focus();
        if (this.#startRequested) {
            this.#startRequested = false;
            this.start();
        }
    }
}
