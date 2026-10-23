import { Emitter } from '../core/emitter.js';
import { classifyError } from '../core/providers.js';
import { SEMANTIC_INSTRUCTION } from '../prompts.js';

/**
 * Chooses between the external provider (preferred) and on-device Gemini Nano.
 * Emits `change` whenever the availability shown by the ✦ indicator may have changed.
 */
export class AiAssistant extends Emitter {
    constructor({ nano, external, log }) {
        super();
        this.nano = nano;
        this.external = external;
        this.log = log;
        nano.on('status', () => this.emit('change'));
        external.on('status', () => this.emit('change'));
    }

    /** 'on': some model is usable, 'dl': Nano needs downloading, 'off': nothing available. */
    get indicator() {
        if (this.external.active || this.nano.ready) return 'on';
        return this.nano.state === 'downloadable' ? 'dl' : 'off';
    }

    async init() {
        if (this.external.configured && (await this.external.activate())) return;
        await this.nano.check();
    }

    /** Stores the provider form's values and returns the normalized config. */
    saveExternal(raw) {
        this.nano.dropSession();
        return this.external.save(raw);
    }

    /** Switches to the saved provider. An empty config falls back to Nano. */
    async applyExternal() {
        if (this.external.configured) {
            await this.external.activate();
        } else {
            this.external.emit('status', null);
            await this.init();
        }
    }

    async clearExternal() {
        this.external.clear();
        this.nano.dropSession();
        await this.init();
    }

    /** Called when the connection returns: retry a provider that failed while offline. */
    async reconnect() {
        if (this.external.configured && !this.external.active) await this.external.activate();
    }

    /** True when some model can review text. Nano's session is created here, so this may take a moment. */
    async canReview() {
        return this.external.active || Boolean(await this.nano.getSession());
    }

    /**
     * Asks the model to mark misrecognized words in `text`.
     * Resolves with `{ text, source }` where source is 'external', 'local' (Nano after the
     * external provider lost its connection) or 'nano'.
     */
    async review(text) {
        const prompt = SEMANTIC_INSTRUCTION + text;
        try {
            if (this.external.active) return await this.#reviewExternal(prompt);
            const session = await this.nano.getSession();
            if (!session) throw new Error('Brak dostępnego modelu AI');
            return { text: await session.prompt(prompt), source: 'nano' };
        } catch (err) {
            this.nano.dropSession();
            throw err;
        }
    }

    async #reviewExternal(prompt) {
        try {
            return { text: await this.external.call('', prompt), source: 'external' };
        } catch (err) {
            if (classifyError(err.message).kind !== 'network') throw err;
            const local = await this.nano.getSession();
            if (!local) throw err;
            this.log.warn('Brak połączenia z zewn. AI – używam lokalnego Gemini Nano');
            return { text: await local.prompt(prompt), source: 'local' };
        }
    }
}
