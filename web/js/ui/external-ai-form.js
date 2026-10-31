import { PROVIDERS } from '../core/providers.js';
import { SILENT } from '../services/sound.js';
import { byId } from './dom.js';

/** Settings row for choosing an external provider, model and key. */
export class ExternalAiForm {
    constructor({ ai, sound = SILENT }) {
        this.ai = ai;
        this.sound = sound;
        this.provider = byId('extProviderSelect');
        this.model = byId('extModelInput');
        this.key = byId('extKeyInput');
        this.fields = [this.model, this.key, byId('extSaveBtn'), byId('extTestBtn'), byId('extClearBtn')];

        const { provider, model, apiKey } = ai.external.config;
        this.provider.value = provider;
        this.model.value = model;
        this.key.value = apiKey;
        this.#syncVisibility();
        this.shownProvider = provider;

        this.provider.addEventListener('change', () => this.#onProviderChange());
        byId('extTestBtn').addEventListener('click', event => this.#test(event.currentTarget));
        byId('extSaveBtn').addEventListener('click', () => this.#save());
        byId('extClearBtn').addEventListener('click', () => this.#clear());
    }

    #values() {
        return { provider: this.provider.value, model: this.model.value, apiKey: this.key.value };
    }

    #syncVisibility() {
        const chosen = Boolean(this.provider.value);
        this.fields.forEach(field => { field.hidden = !chosen; });
    }

    /** Switching provider swaps the model field's default, but never overwrites a custom model. */
    #onProviderChange() {
        const previousDefault = PROVIDERS[this.shownProvider]?.defaultModel;
        if (!this.model.value || this.model.value === previousDefault) {
            this.model.value = PROVIDERS[this.provider.value]?.defaultModel ?? '';
        }
        this.shownProvider = this.provider.value;
        this.#syncVisibility();
        this.sound.play('select');
    }

    async #save() {
        const { model } = this.ai.saveExternal(this.#values());
        this.model.value = model;
        await this.ai.applyExternal();
        this.sound.play(this.ai.external.active ? 'success' : 'error');
    }

    async #test(button) {
        button.disabled = true;
        try {
            this.sound.play((await this.ai.external.test(this.#values())) ? 'success' : 'error');
        } finally {
            button.disabled = false;
        }
    }

    #clear() {
        this.provider.value = this.shownProvider = '';
        this.model.value = this.key.value = '';
        this.#syncVisibility();
        this.ai.clearExternal();
        this.sound.play('remove');
    }
}
