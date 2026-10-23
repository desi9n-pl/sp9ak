import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHistory } from '../../../web/js/services/session-history.js';
import { STORAGE_KEYS } from '../../../web/js/config.js';

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        get: (key, fallback = null) => data[key] ?? fallback,
        set: (key, value) => { data[key] = value; return true; },
    };
}

const ok = body => ({ ok: true, json: async () => body });

let storage;
let fetchFn;
let history;

beforeEach(() => {
    storage = fakeStorage();
    fetchFn = vi.fn(async () => ok([]));
    history = new SessionHistory({ storage, fetchFn });
});

describe('load', () => {
    it('reads sessions from the server and notifies', async () => {
        const sessions = [{ id: '1', ts: 't', text: 'zapisane' }];
        fetchFn.mockResolvedValue(ok(sessions));
        const onChange = vi.fn();
        history.on('change', onChange);
        await history.load();
        expect(history.items).toEqual(sessions);
        expect(fetchFn).toHaveBeenCalledWith('/api/sessions');
        expect(onChange).toHaveBeenCalled();
    });

    it.each([
        ['the server is down', () => fetchFn.mockRejectedValue(new TypeError('Failed to fetch'))],
        ['the server answers with an error', () => fetchFn.mockResolvedValue({ ok: false, status: 500 })],
    ])('falls back to the localStorage copy when %s', async (_, breakServer) => {
        storage.data[STORAGE_KEYS.sessions] = JSON.stringify([{ id: 'b', ts: 't', text: 'z kopii' }]);
        breakServer();
        await history.load();
        expect(history.items[0].text).toBe('z kopii');
    });

    it.each([['not json', 'nie-json'], ['not a list', '{"a":1}'], ['missing', undefined]])(
        'starts empty when the backup is %s', async (_, backup) => {
            if (backup !== undefined) storage.data[STORAGE_KEYS.sessions] = backup;
            fetchFn.mockRejectedValue(new Error('down'));
            await history.load();
            expect(history.items).toEqual([]);
        });
});

describe('add', () => {
    it('puts the newest session first, trimmed, with an id and timestamp', () => {
        history.add('  pierwsza notatka  ');
        history.add('druga notatka');
        expect(history.items.map(s => s.text)).toEqual(['druga notatka', 'pierwsza notatka']);
        expect(history.items[0].id).toBeTruthy();
        expect(history.items[0].id).not.toBe(history.items[1].id);
        expect(new Date(history.items[0].ts).toString()).not.toBe('Invalid Date');
    });

    it('refuses short text and a repeat of the last save', () => {
        expect(history.add('abc')).toBe(false);
        expect(history.add('wystarczająco długa')).toBe(true);
        expect(history.add('wystarczająco długa')).toBe(false);
        expect(history.items).toHaveLength(1);
    });

    it('saves to localStorage and to the server', () => {
        history.add('notatka do zapisu');
        expect(JSON.parse(storage.data[STORAGE_KEYS.sessions])[0].text).toBe('notatka do zapisu');
        const [url, options] = fetchFn.mock.calls.at(-1);
        expect(url).toBe('/api/sessions');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)[0].text).toBe('notatka do zapisu');
    });

    it('keeps working when the server cannot be reached', async () => {
        fetchFn.mockRejectedValue(new Error('down'));
        expect(() => history.add('notatka bez serwera')).not.toThrow();
        await Promise.resolve();
        expect(history.items).toHaveLength(1);
    });
});

describe('remove and clear', () => {
    it('removes one session', () => {
        history.add('pierwsza notatka');
        history.add('druga notatka');
        history.remove(history.items[0].id);
        expect(history.items.map(s => s.text)).toEqual(['pierwsza notatka']);
    });

    it('allows saving the same text again once the history is empty', () => {
        history.add('powtarzana notatka');
        history.remove(history.items[0].id);
        expect(history.add('powtarzana notatka')).toBe(true);
    });

    it('clears everything and allows saving the same text again', () => {
        history.add('powtarzana notatka');
        history.clear();
        expect(history.items).toEqual([]);
        expect(history.add('powtarzana notatka')).toBe(true);
    });

    it('notifies on every change', () => {
        const onChange = vi.fn();
        history.on('change', onChange);
        history.add('jakaś notatka');
        history.remove(history.items[0].id);
        history.clear();
        expect(onChange).toHaveBeenCalledTimes(3);
    });
});
