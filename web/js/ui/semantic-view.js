import { buildSemanticText, parseSemanticResponse } from '../core/semantic.js';
import { classifyError } from '../core/providers.js';
import { byId } from './dom.js';

const NO_AI_NOTICE_MS = 6000;

/**
 * Review panel: the model marks words the recognizer probably got wrong and the user
 * picks which suggestions to take. Calls `onApply(text)` with the result.
 */
export class SemanticView {
    #segments = [];

    constructor({ ai, editor, panels, status, toast, log, isDictating, onApply }) {
        Object.assign(this, { ai, editor, panels, status, toast, log, isDictating, onApply });
        this.content = byId('semanticContent');
        this.empty = byId('semanticEmpty');

        byId('semanticBtn').addEventListener('click', () => this.#onButton());
        byId('semanticCloseBtn').addEventListener('click', () => panels.close('semantic'));
        byId('semanticAcceptAllBtn').addEventListener('click', () => this.#acceptAll());
        byId('semanticApplyBtn').addEventListener('click', () => onApply(buildSemanticText(this.#segments)));
        this.content.addEventListener('click', event => this.#onContentClick(event));
    }

    async #onButton() {
        const text = this.editor.value.trim();
        if (!text) return;
        if (this.panels.isOpen('semantic')) {
            this.panels.close('semantic');
            return;
        }
        this.panels.closeAll();

        if (!(await this.ai.canReview())) {
            this.status.set('⚠ Brak AI – skonfiguruj zewnętrzne AI (Claude/OpenAI) lub zainstaluj Gemini Nano');
            setTimeout(() => this.#idle(), NO_AI_NOTICE_MS);
            return;
        }

        this.panels.open('semantic');
        this.content.hidden = false;
        this.empty.hidden = true;
        this.content.textContent = 'Sprawdzam…';
        this.status.set('Sprawdzam semantykę…');
        await this.#review(text);
    }

    async #review(text) {
        try {
            this.log.info(`Wysyłam prompt do modelu (${text.length} znaków)…`, text.slice(0, 120));
            const { text: response, source } = await this.ai.review(text);
            if (source === 'local') this.toast.show('Brak połączenia – użyto lokalnego Gemini Nano');
            this.log.ok(`Odpowiedź modelu (${response.length} znaków)`, response.slice(0, 200));
            this.#render(response.trim());
            // the panel may have been closed while waiting for the model
            if (!this.panels.isOpen('semantic')) this.panels.open('semantic');
        } catch (err) {
            this.log.err(`session.prompt błąd: ${err.name}: ${err.message}`, err.stack);
            this.content.textContent = this.#describeError(err);
        }
        this.#idle();
    }

    #describeError(err) {
        if (!this.ai.external.active) return `Błąd: ${err.message}`;
        const { kind, text } = classifyError(err.message);
        return `Błąd: ${text}${kind === 'network' ? ' – spróbuj ponownie po odzyskaniu połączenia' : ''}`;
    }

    #idle() {
        if (!this.isDictating()) this.status.idle();
    }

    #render(response) {
        this.#segments = parseSemanticResponse(response);
        this.content.replaceChildren(...this.#segments.map((segment, index) => this.#node(segment, index)));
        const suspects = this.#segments.filter(s => s.kind === 'suspect').length;
        this.content.hidden = suspects === 0;
        this.empty.hidden = suspects > 0;
        this.log.add(suspects ? 'warn' : 'ok', `Znaleziono ${suspects} podejrzanych słów`);
    }

    #node(segment, index) {
        if (segment.kind === 'text') return document.createTextNode(segment.text);

        const group = document.createElement('span');
        group.append(this.#span('suspect-orig', segment.original, index));
        // a suggestion identical to the original has nothing to accept
        if (segment.suggestion && segment.suggestion !== segment.original) {
            group.append(this.#span('suspect-sug', segment.suggestion, index));
        }
        return group;
    }

    #span(className, text, index) {
        const span = document.createElement('span');
        span.className = className;
        span.dataset.idx = index;
        span.textContent = text;
        return span;
    }

    #onContentClick(event) {
        const suggestion = event.target.closest('.suspect-sug');
        const original = event.target.closest('.suspect-orig');
        if (suggestion) {
            this.#setAccepted(suggestion, !this.#segments[suggestion.dataset.idx].accepted);
        } else if (original?.classList.contains('accepted')) {
            this.#setAccepted(original, false);
        }
    }

    #acceptAll() {
        this.content.querySelectorAll('.suspect-sug:not(.accepted)').forEach(span => this.#setAccepted(span, true));
    }

    /** Updates the segment and the highlight of both spans in its group. */
    #setAccepted(span, accepted) {
        this.#segments[span.dataset.idx].accepted = accepted;
        span.parentElement.querySelectorAll('.suspect-orig, .suspect-sug')
            .forEach(el => el.classList.toggle('accepted', accepted));
    }
}
