// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Emitter } from '../../../web/js/core/emitter.js';
import { Logger } from '../../../web/js/services/logger.js';
import { AiStatusView } from '../../../web/js/ui/ai-status-view.js';
import { ExternalAiForm } from '../../../web/js/ui/external-ai-form.js';
import { SemanticView } from '../../../web/js/ui/semantic-view.js';
import { Editor } from '../../../web/js/ui/editor.js';
import { PanelManager } from '../../../web/js/ui/panels.js';
import { $, click, mountPage } from './fixture.js';

function fakeAssistant({ config = { provider: '', model: '', apiKey: '' }, indicator = 'off' } = {}) {
    const ai = Object.assign(new Emitter(), {
        indicator,
        nano: new Emitter(),
        external: Object.assign(new Emitter(), { config, active: false, test: vi.fn(async () => true) }),
        saveExternal: vi.fn(raw => ({ ...raw, model: raw.model || 'domyślny-model' })),
        applyExternal: vi.fn(async () => {}),
        clearExternal: vi.fn(async () => {}),
        canReview: vi.fn(async () => true),
        review: vi.fn(),
    });
    return ai;
}

beforeEach(mountPage);

describe('AiStatusView', () => {
    it('shows the Nano status, its progress and the hint on the ✦ chip', () => {
        const ai = fakeAssistant();
        new AiStatusView({ ai });
        ai.nano.emit('status', { level: 'dl', text: 'Pobieranie modelu…', detail: 'Nie zamykaj aplikacji.' });
        expect($('aiStatusDot').className).toBe('ai-status-dot dl');
        expect($('aiStatusText').textContent).toBe('Pobieranie modelu…');
        expect($('punctToggle').title).toContain('Nie zamykaj aplikacji.');
        ai.nano.emit('progress', 'Pobieranie: 40%');
        expect($('aiStatusText').textContent).toBe('Pobieranie: 40%');
    });

    it('shows and hides the external provider status', () => {
        const ai = fakeAssistant();
        new AiStatusView({ ai });
        ai.external.emit('status', { level: 'on', text: 'Claude aktywny' });
        expect($('extStatusRow').hidden).toBe(false);
        expect($('extStatusText').textContent).toBe('Claude aktywny');
        expect($('extStatusDot').className).toBe('ai-status-dot on');
        ai.external.emit('status', null);
        expect($('extStatusRow').hidden).toBe(true);
    });

    it('mirrors the assistant indicator on the ✦ chip', () => {
        const ai = fakeAssistant();
        new AiStatusView({ ai });
        ai.indicator = 'on';
        ai.emit('change');
        expect($('punctToggle').dataset.ai).toBe('on');
    });
});

describe('ExternalAiForm', () => {
    const values = () => ({ provider: $('extProviderSelect').value, model: $('extModelInput').value, apiKey: $('extKeyInput').value });

    function choose(provider) {
        $('extProviderSelect').value = provider;
        $('extProviderSelect').dispatchEvent(new Event('change'));
    }

    it('hides the fields until a provider is chosen', () => {
        new ExternalAiForm({ ai: fakeAssistant() });
        expect($('extKeyInput').hidden).toBe(true);
        choose('claude');
        expect($('extKeyInput').hidden).toBe(false);
        expect($('extSaveBtn').hidden).toBe(false);
        choose('');
        expect($('extKeyInput').hidden).toBe(true);
    });

    it('fills in the saved configuration', () => {
        new ExternalAiForm({ ai: fakeAssistant({ config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-abc' } }) });
        expect(values()).toEqual({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-abc' });
        expect($('extKeyInput').hidden).toBe(false);
    });

    it('suggests the default model of the chosen provider', () => {
        new ExternalAiForm({ ai: fakeAssistant() });
        choose('claude');
        expect($('extModelInput').value).toBe('claude-haiku-4-5-20251001');
        choose('openai');
        expect($('extModelInput').value).toBe('gpt-4o-mini');
    });

    it('keeps a custom model when the provider changes', () => {
        new ExternalAiForm({ ai: fakeAssistant({ config: { provider: 'claude', model: 'moj-model', apiKey: 'k' } }) });
        choose('openai');
        expect($('extModelInput').value).toBe('moj-model');
    });

    it('replaces the previous default model, but not an edited one', () => {
        new ExternalAiForm({ ai: fakeAssistant({ config: { provider: 'claude', model: 'claude-haiku-4-5-20251001', apiKey: 'k' } }) });
        choose('openai');
        expect($('extModelInput').value).toBe('gpt-4o-mini');
    });

    it('saves, shows the model that was filled in, and applies it', async () => {
        const ai = fakeAssistant();
        new ExternalAiForm({ ai });
        choose('claude');
        $('extModelInput').value = '';
        $('extKeyInput').value = 'sk-ant-1';
        click($('extSaveBtn'));
        await vi.waitFor(() => expect(ai.applyExternal).toHaveBeenCalled());
        expect(ai.saveExternal).toHaveBeenCalledWith({ provider: 'claude', model: '', apiKey: 'sk-ant-1' });
        expect($('extModelInput').value).toBe('domyślny-model');
    });

    it('tests the key with the button disabled meanwhile', async () => {
        const ai = fakeAssistant();
        let finish;
        ai.external.test.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        new ExternalAiForm({ ai });
        choose('claude');
        $('extKeyInput').value = 'sk-ant-1';
        click($('extTestBtn'));
        expect($('extTestBtn').disabled).toBe(true);
        finish(true);
        await vi.waitFor(() => expect($('extTestBtn').disabled).toBe(false));
        expect(ai.external.test).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-ant-1' }));
    });

    it('clears the form and the saved provider', () => {
        const ai = fakeAssistant({ config: { provider: 'claude', model: 'm', apiKey: 'k' } });
        new ExternalAiForm({ ai });
        click($('extClearBtn'));
        expect(values()).toEqual({ provider: '', model: '', apiKey: '' });
        expect($('extKeyInput').hidden).toBe(true);
        expect(ai.clearExternal).toHaveBeenCalled();
    });
});

describe('SemanticView', () => {
    let ai;
    let editor;
    let panels;
    let status;
    let toast;
    let onApply;
    let dictating;

    beforeEach(() => {
        ai = fakeAssistant();
        ai.review.mockResolvedValue({ text: 'to jest [[testowy|tekstowy]] wynik', source: 'nano' });
        editor = new Editor();
        editor.setText('to jest testowy wynik');
        panels = new PanelManager({
            settings: { panel: $('themesPanel'), button: $('settingsBtn') },
            semantic: { panel: $('semanticPanel'), button: $('semanticBtn'), pinned: true, manual: true },
        });
        status = { set: vi.fn(), idle: vi.fn() };
        toast = { show: vi.fn() };
        onApply = vi.fn();
        dictating = false;
        new SemanticView({ ai, editor, panels, status, toast, log: new Logger(), isDictating: () => dictating, onApply });
    });

    const review = async () => {
        click($('semanticBtn'));
        await vi.waitFor(() => expect($('semanticContent').querySelector('.suspect-orig') ?? $('semanticEmpty').hidden === false).toBeTruthy());
    };

    it('shows suspect words with their suggestions', async () => {
        await review();
        expect(panels.isOpen('semantic')).toBe(true);
        expect($('semanticContent').textContent).toBe('to jest testowytekstowy wynik');
        expect($('semanticContent').querySelector('.suspect-sug').textContent).toBe('tekstowy');
        expect(ai.review).toHaveBeenCalledWith('to jest testowy wynik');
        expect(status.idle).toHaveBeenCalled();
    });

    it('does nothing for an empty field', async () => {
        editor.setText('  ');
        click($('semanticBtn'));
        await Promise.resolve();
        expect(ai.canReview).not.toHaveBeenCalled();
        expect(panels.isOpen('semantic')).toBe(false);
    });

    it('closes the panel on a second click', async () => {
        await review();
        click($('semanticBtn'));
        expect(panels.isOpen('semantic')).toBe(false);
    });

    it('closes other panels when it opens', async () => {
        panels.open('settings');
        await review();
        expect(panels.isOpen('settings')).toBe(false);
    });

    it('explains when no model is available', async () => {
        vi.useFakeTimers();
        ai.canReview.mockResolvedValue(false);
        click($('semanticBtn'));
        await vi.advanceTimersByTimeAsync(0);
        expect(status.set).toHaveBeenCalledWith(expect.stringContaining('Brak AI'));
        expect(panels.isOpen('semantic')).toBe(false);
        await vi.advanceTimersByTimeAsync(6000);
        expect(status.idle).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('does not reset the status line while dictation is running', async () => {
        dictating = true;
        await review();
        expect(status.idle).not.toHaveBeenCalled();
    });

    it('reports a clean text', async () => {
        ai.review.mockResolvedValue({ text: 'czysty tekst', source: 'nano' });
        click($('semanticBtn'));
        await vi.waitFor(() => expect($('semanticEmpty').hidden).toBe(false));
        expect($('semanticContent').hidden).toBe(true);
    });

    it('omits a suggestion identical to the original', async () => {
        ai.review.mockResolvedValue({ text: '[[tak|tak]] i [[nie]]', source: 'nano' });
        await review();
        expect($('semanticContent').querySelectorAll('.suspect-sug')).toHaveLength(0);
        expect($('semanticContent').querySelectorAll('.suspect-orig')).toHaveLength(2);
    });

    it('accepts, un-accepts and applies suggestions', async () => {
        await review();
        click($('semanticContent').querySelector('.suspect-sug'));
        expect($('semanticContent').querySelectorAll('.accepted')).toHaveLength(2);
        click($('semanticContent').querySelector('.suspect-sug'));
        expect($('semanticContent').querySelectorAll('.accepted')).toHaveLength(0);
        click($('semanticContent').querySelector('.suspect-sug'));
        click($('semanticContent').querySelector('.suspect-orig'));
        expect($('semanticContent').querySelectorAll('.accepted')).toHaveLength(0);
        click($('semanticContent').querySelector('.suspect-sug'));
        click($('semanticApplyBtn'));
        expect(onApply).toHaveBeenCalledWith('to jest tekstowy wynik');
    });

    it('ignores a click on a plain original', async () => {
        await review();
        click($('semanticContent').querySelector('.suspect-orig'));
        expect($('semanticContent').querySelectorAll('.accepted')).toHaveLength(0);
    });

    it('applies the original text when nothing was accepted', async () => {
        await review();
        click($('semanticApplyBtn'));
        expect(onApply).toHaveBeenCalledWith('to jest testowy wynik');
    });

    it('accepts all suggestions at once', async () => {
        ai.review.mockResolvedValue({ text: '[[a|b]] i [[c|d]]', source: 'nano' });
        await review();
        click($('semanticAcceptAllBtn'));
        click($('semanticApplyBtn'));
        expect(onApply).toHaveBeenCalledWith('b i d');
    });

    it('closes with ✕', async () => {
        await review();
        click($('semanticCloseBtn'));
        expect(panels.isOpen('semantic')).toBe(false);
    });

    it('tells the user when Nano took over from a disconnected provider', async () => {
        ai.review.mockResolvedValue({ text: 'tekst', source: 'local' });
        click($('semanticBtn'));
        await vi.waitFor(() => expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('lokalnego Gemini Nano')));
    });

    it('reopens the panel if it was closed while waiting for the model', async () => {
        let answer;
        ai.review.mockReturnValue(new Promise(resolve => { answer = resolve; }));
        click($('semanticBtn'));
        await vi.waitFor(() => expect(panels.isOpen('semantic')).toBe(true));
        panels.close('semantic');
        answer({ text: '[[a|b]]', source: 'nano' });
        await vi.waitFor(() => expect(panels.isOpen('semantic')).toBe(true));
    });

    describe('errors', () => {
        it('shows the message of a local model error', async () => {
            ai.review.mockRejectedValue(new Error('model padł'));
            click($('semanticBtn'));
            await vi.waitFor(() => expect($('semanticContent').textContent).toBe('Błąd: model padł'));
            expect(status.idle).toHaveBeenCalled();
        });

        it('translates an external provider error', async () => {
            ai.external.active = true;
            ai.review.mockRejectedValue(new Error('Claude API 401: invalid x-api-key'));
            click($('semanticBtn'));
            await vi.waitFor(() => expect($('semanticContent').textContent).toContain('Klucz odrzucony'));
        });

        it('suggests retrying after a network error', async () => {
            ai.external.active = true;
            ai.review.mockRejectedValue(new Error('Failed to fetch'));
            click($('semanticBtn'));
            await vi.waitFor(() => expect($('semanticContent').textContent).toContain('spróbuj ponownie'));
        });
    });
});
