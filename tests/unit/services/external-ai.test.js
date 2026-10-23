import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalAi, OFFLINE_ERROR } from '../../../web/js/services/external-ai.js';
import { Logger } from '../../../web/js/services/logger.js';
import { STORAGE_KEYS } from '../../../web/js/config.js';

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        get: (key, fallback = null) => data[key] ?? fallback,
        set: (key, value) => { data[key] = value; return true; },
        remove: key => { delete data[key]; },
    };
}

const answer = body => ({ json: async () => body });
const VALID = { provider: 'claude', model: '', apiKey: 'sk-ant-secret-1234' };

let storage;
let fetchFn;
let online;
let ai;
let statuses;

beforeEach(() => {
    storage = fakeStorage();
    fetchFn = vi.fn(async () => answer({ text: 'OK' }));
    online = true;
    ai = new ExternalAi({ storage, fetchFn, log: new Logger(), isOnline: () => online, timeoutMs: 50 });
    statuses = [];
    ai.on('status', s => statuses.push(s));
});

describe('configuration', () => {
    it('is unconfigured by default', () => {
        expect(ai.configured).toBe(false);
        expect(ai.active).toBe(false);
    });

    it('loads a saved configuration', () => {
        const saved = fakeStorage({
            [STORAGE_KEYS.extProvider]: 'openai', [STORAGE_KEYS.extModel]: 'gpt-4o', [STORAGE_KEYS.extKey]: 'sk-abc',
        });
        const loaded = new ExternalAi({ storage: saved, log: new Logger() });
        expect(loaded.configured).toBe(true);
        expect(loaded.label).toBe('OpenAI (gpt-4o)');
    });

    it('save() normalizes, persists and deactivates', () => {
        ai.active = true;
        const config = ai.save({ ...VALID, apiKey: ' sk-ant-secret-1234 ' });
        expect(config.model).toBe('claude-haiku-4-5-20251001');
        expect(storage.data[STORAGE_KEYS.extKey]).toBe('sk-ant-secret-1234');
        expect(storage.data[STORAGE_KEYS.extProvider]).toBe('claude');
        expect(ai.active).toBe(false);
        expect(ai.configured).toBe(true);
    });

    it('clear() forgets everything and hides the status', () => {
        ai.save(VALID);
        ai.clear();
        expect(ai.configured).toBe(false);
        expect(storage.data).toEqual({});
        expect(statuses.at(-1)).toBeNull();
    });
});

describe('call', () => {
    it('posts the config and prompt to the proxy and returns the text', async () => {
        ai.save(VALID);
        expect(await ai.call('system', 'prompt')).toBe('OK');
        const [url, options] = fetchFn.mock.calls[0];
        expect(url).toBe('/api/ai');
        expect(JSON.parse(options.body)).toMatchObject({ provider: 'claude', apiKey: VALID.apiKey, system: 'system', prompt: 'prompt' });
    });

    it('does not even try while offline', async () => {
        online = false;
        await expect(ai.call('', 'p')).rejects.toThrow(OFFLINE_ERROR);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects with the error the proxy reports', async () => {
        fetchFn.mockResolvedValue(answer({ error: 'Claude API 401: invalid x-api-key' }));
        await expect(ai.call('', 'p')).rejects.toThrow('Claude API 401');
    });

    it('turns a hanging request into a timeout error', async () => {
        fetchFn.mockImplementation((url, { signal }) => new Promise((_, reject) => {
            signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }));
        await expect(ai.call('', 'p')).rejects.toThrow(/timeout/);
    });

    it('passes network failures through unchanged', async () => {
        fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(ai.call('', 'p')).rejects.toThrow('Failed to fetch');
    });
});

describe('activate', () => {
    it('does nothing when nothing is configured', async () => {
        expect(await ai.activate()).toBe(false);
        expect(statuses).toEqual([]);
    });

    it('checks the key with a real request and switches on', async () => {
        ai.save(VALID);
        expect(await ai.activate()).toBe(true);
        expect(ai.active).toBe(true);
        expect(statuses.map(s => s.level)).toEqual(['dl', 'on']);
        expect(statuses.at(-1).text).toContain('Claude');
    });

    it('rejects a malformed key without a request', async () => {
        ai.save({ provider: 'claude', apiKey: 'wrong-prefix' });
        expect(await ai.activate()).toBe(false);
        expect(fetchFn).not.toHaveBeenCalled();
        expect(statuses.at(-1)).toMatchObject({ level: 'off' });
        expect(statuses.at(-1).text).toContain('sk-ant-');
    });

    it('explains a rejected key', async () => {
        ai.save(VALID);
        fetchFn.mockResolvedValue(answer({ error: 'Claude API 401: invalid x-api-key' }));
        expect(await ai.activate()).toBe(false);
        expect(ai.active).toBe(false);
        expect(statuses.at(-1).text).toBe('Błąd: Klucz odrzucony (nieprawidłowy lub bez uprawnień)');
    });
});

describe('test', () => {
    it('checks a key from the form without saving it or switching on', async () => {
        expect(await ai.test(VALID)).toBe(true);
        expect(ai.configured).toBe(false);
        expect(ai.active).toBe(false);
        expect(statuses.at(-1).text).toBe('Klucz działa (Claude, sk-…1234)');
    });

    it('reports a local validation error', async () => {
        expect(await ai.test({ provider: '', apiKey: '' })).toBe(false);
        expect(fetchFn).not.toHaveBeenCalled();
        expect(statuses.at(-1).level).toBe('off');
    });

    it('reports a failing key', async () => {
        fetchFn.mockResolvedValue(answer({ error: 'OpenAI API 429: quota' }));
        expect(await ai.test({ provider: 'openai', apiKey: 'sk-abc' })).toBe(false);
        expect(statuses.at(-1).text).toBe('Błąd: Przekroczony limit lub brak środków');
    });
});

describe('reportOffline', () => {
    it('stays quiet without a configured provider', () => {
        ai.reportOffline();
        expect(statuses).toEqual([]);
    });

    it('shows that the connection is missing', () => {
        ai.save(VALID);
        ai.reportOffline();
        expect(statuses.at(-1)).toEqual({ level: 'off', text: 'Brak połączenia z internetem' });
    });
});
