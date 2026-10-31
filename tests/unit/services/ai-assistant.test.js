import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant } from '../../../web/js/services/ai-assistant.js';
import { Emitter } from '../../../web/js/core/emitter.js';
import { SEMANTIC_INSTRUCTION } from '../../../web/js/prompts.js';

class FakeNano extends Emitter {
    state = null;
    session = { prompt: vi.fn(async () => 'od nano') };
    get ready() { return this.state === 'available'; }
    check = vi.fn(async () => { this.state = 'available'; });
    getSession = vi.fn(async () => this.session);
    dropSession = vi.fn();
}

class FakeExternal extends Emitter {
    active = false;
    configured = false;
    save = vi.fn(raw => { this.configured = Boolean(raw.apiKey); return raw; });
    clear = vi.fn(() => { this.configured = false; this.active = false; });
    activate = vi.fn(async () => { this.active = true; return true; });
    call = vi.fn(async () => 'od zewnętrznego');
}

const log = { warn: vi.fn() };
let nano;
let external;
let ai;

beforeEach(() => {
    nano = new FakeNano();
    external = new FakeExternal();
    ai = new AiAssistant({ nano, external, log });
});

describe('indicator', () => {
    it.each([
        ['nothing is available', {}, 'off'],
        ['Nano is ready', { nano: 'available' }, 'on'],
        ['Nano can be downloaded', { nano: 'downloadable' }, 'dl'],
        ['an external provider is active', { external: true }, 'on'],
        ['an external provider is active although Nano is downloadable', { external: true, nano: 'downloadable' }, 'on'],
    ])('when %s', (_, { nano: nanoState = null, external: extActive = false }, expected) => {
        nano.state = nanoState;
        external.active = extActive;
        expect(ai.indicator).toBe(expected);
    });

    it('announces changes whenever either model reports a status', () => {
        const onChange = vi.fn();
        ai.on('change', onChange);
        nano.emit('status', {});
        external.emit('status', {});
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});

describe('init', () => {
    it('checks Nano when no provider is configured', async () => {
        await ai.init();
        expect(nano.check).toHaveBeenCalled();
    });

    it('prefers a working external provider and skips Nano', async () => {
        external.configured = true;
        await ai.init();
        expect(nano.check).not.toHaveBeenCalled();
    });

    it('falls back to Nano when the provider does not work', async () => {
        external.configured = true;
        external.activate.mockResolvedValue(false);
        await ai.init();
        expect(nano.check).toHaveBeenCalled();
    });
});

describe('external configuration', () => {
    it('saveExternal stores the form values and drops the Nano session', () => {
        const config = ai.saveExternal({ provider: 'claude', apiKey: 'k' });
        expect(config).toEqual({ provider: 'claude', apiKey: 'k' });
        expect(nano.dropSession).toHaveBeenCalled();
    });

    it('applyExternal activates a saved provider', async () => {
        ai.saveExternal({ provider: 'claude', apiKey: 'k' });
        await ai.applyExternal();
        expect(external.activate).toHaveBeenCalled();
        expect(nano.check).not.toHaveBeenCalled();
    });

    it('applyExternal with an empty form hides the status and falls back to Nano', async () => {
        const statuses = [];
        external.on('status', s => statuses.push(s));
        ai.saveExternal({ provider: '', apiKey: '' });
        await ai.applyExternal();
        expect(statuses).toEqual([null]);
        expect(nano.check).toHaveBeenCalled();
    });

    it('clearExternal forgets the provider and re-checks Nano', async () => {
        await ai.clearExternal();
        expect(external.clear).toHaveBeenCalled();
        expect(nano.check).toHaveBeenCalled();
    });

    it('reconnect retries only a configured provider that is not active', async () => {
        await ai.reconnect();
        expect(external.activate).not.toHaveBeenCalled();
        external.configured = true;
        await ai.reconnect();
        expect(external.activate).toHaveBeenCalledTimes(1);
        await ai.reconnect();
        expect(external.activate).toHaveBeenCalledTimes(1);
    });
});

describe('canReview', () => {
    it('is true with an active provider, without touching Nano', async () => {
        external.active = true;
        expect(await ai.canReview()).toBe(true);
        expect(nano.getSession).not.toHaveBeenCalled();
    });

    it('depends on Nano otherwise', async () => {
        expect(await ai.canReview()).toBe(true);
        nano.getSession.mockResolvedValue(null);
        expect(await ai.canReview()).toBe(false);
    });
});

describe('review', () => {
    it('asks the external provider when it is active', async () => {
        external.active = true;
        expect(await ai.review('tekst')).toEqual({ text: 'od zewnętrznego', source: 'external' });
        expect(external.call).toHaveBeenCalledWith('', SEMANTIC_INSTRUCTION + 'tekst');
    });

    it('asks Nano otherwise', async () => {
        expect(await ai.review('tekst')).toEqual({ text: 'od nano', source: 'nano' });
        expect(nano.session.prompt).toHaveBeenCalledWith(SEMANTIC_INSTRUCTION + 'tekst');
    });

    it('uses Nano when the provider loses its connection', async () => {
        external.active = true;
        external.call.mockRejectedValue(new Error('Failed to fetch'));
        expect(await ai.review('tekst')).toEqual({ text: 'od nano', source: 'local' });
        expect(log.warn).toHaveBeenCalled();
    });

    it('does not hide non-network provider errors behind Nano', async () => {
        external.active = true;
        external.call.mockRejectedValue(new Error('Claude API 401: invalid x-api-key'));
        await expect(ai.review('tekst')).rejects.toThrow('401');
        expect(nano.session.prompt).not.toHaveBeenCalled();
    });

    it('rethrows the network error when Nano is no help either', async () => {
        external.active = true;
        external.call.mockRejectedValue(new Error('Failed to fetch'));
        nano.getSession.mockResolvedValue(null);
        await expect(ai.review('tekst')).rejects.toThrow('Failed to fetch');
    });

    it('fails clearly when no model is available', async () => {
        nano.getSession.mockResolvedValue(null);
        await expect(ai.review('tekst')).rejects.toThrow('Brak dostępnego modelu AI');
    });

    it('drops the Nano session after any failure so the next try starts fresh', async () => {
        nano.session.prompt.mockRejectedValue(new Error('model padł'));
        await expect(ai.review('tekst')).rejects.toThrow('model padł');
        expect(nano.dropSession).toHaveBeenCalled();
    });
});

describe('SEMANTIC_INSTRUCTION', () => {
    it('asks for spelling slips, not only for wrong words', () => {
        expect(SEMANTIC_INSTRUCTION).toContain('ó/u, rz/ż');
    });
});
