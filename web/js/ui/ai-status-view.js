import { byId } from './dom.js';

/** Settings rows showing the state of Gemini Nano and of the external provider, plus the ✦ indicator. */
export class AiStatusView {
    constructor({ ai }) {
        this.ai = ai;
        this.nanoDot = byId('aiStatusDot');
        this.nanoText = byId('aiStatusText');
        this.chip = byId('punctToggle');
        this.extRow = byId('extStatusRow');
        this.extDot = byId('extStatusDot');
        this.extText = byId('extStatusText');

        ai.nano.on('status', status => this.#showNano(status));
        ai.nano.on('progress', text => { this.nanoText.textContent = text; });
        ai.external.on('status', status => this.#showExternal(status));
        ai.on('change', () => this.#refreshIndicator());
    }

    #showNano({ level, text, detail }) {
        this.nanoDot.className = `ai-status-dot ${level}`;
        this.nanoText.textContent = text;
        this.chip.title = `Interpunkcja\nAI: ${text}\n\n${detail}`;
    }

    #showExternal(status) {
        this.extRow.hidden = status === null;
        if (status === null) return;
        this.extDot.className = `ai-status-dot ${status.level}`;
        this.extText.textContent = status.text;
    }

    #refreshIndicator() {
        this.chip.dataset.ai = this.ai.indicator;
    }
}
