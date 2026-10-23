import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiNano, isReady, normalizeAvailability } from '../../../web/js/services/gemini-nano.js';
import { Logger } from '../../../web/js/services/logger.js';

describe('normalizeAvailability', () => {
    it.each([
        ['available', 'available'],
        [{ available: 'readily' }, 'readily'],
        [{}, 'no'],
        [undefined, 'no'],
    ])('%j → %s', (raw, expected) => {
        expect(normalizeAvailability(raw)).toBe(expected);
    });

    it('knows which states are usable', () => {
        expect(['readily', 'available'].every(isReady)).toBe(true);
        expect(['downloadable', 'no', null].some(isReady)).toBe(false);
    });
});

function setup({ availability = 'available', ...options } = {}) {
    const session = { prompt: vi.fn(async () => 'odpowiedź'), destroy: vi.fn() };
    const api = {
        availability: vi.fn(async () => availability),
        create: vi.fn(async () => session),
    };
    const log = new Logger();
    const nano = new GeminiNano({ log, getApi: () => api, sleep: async () => {}, ...options });
    const statuses = [];
    nano.on('status', s => statuses.push(s));
    return { nano, api, session, log, statuses };
}

describe('check', () => {
    it('reports the missing flag when the browser has no API', async () => {
        const nano = new GeminiNano({ log: new Logger(), getApi: () => undefined });
        const statuses = [];
        nano.on('status', s => statuses.push(s));
        await nano.check();
        expect(statuses).toEqual([expect.objectContaining({ level: 'off', text: 'Flaga wyłączona' })]);
        expect(nano.ready).toBe(false);
    });

    it.each(['readily', 'available'])('is active when the model is %s', async availability => {
        const { nano, statuses } = setup({ availability });
        await nano.check();
        expect(nano.ready).toBe(true);
        expect(statuses.at(-1)).toMatchObject({ level: 'on', text: 'Gemini Nano aktywny' });
    });

    it.each(['no', 'unavailable'])('reports an unusable model (%s)', async availability => {
        const { nano, statuses } = setup({ availability });
        await nano.check();
        expect(statuses.at(-1)).toMatchObject({ level: 'off', text: 'Model niedostępny' });
    });

    it('asks the user to start the download', async () => {
        const { nano, statuses } = setup({ availability: 'downloadable' });
        await nano.check();
        expect(statuses.at(-1)).toMatchObject({ level: 'dl' });
        expect(statuses.at(-1).text).toContain('Kliknij ✦');
    });

    it('accepts the legacy object answer', async () => {
        const { nano } = setup({ availability: { available: 'readily' } });
        await nano.check();
        expect(nano.state).toBe('readily');
    });

    it('turns an exception into an error status', async () => {
        const { nano, api, statuses } = setup();
        api.availability.mockRejectedValue(new Error('boom'));
        await nano.check();
        expect(statuses.at(-1)).toMatchObject({ level: 'off', text: 'Błąd inicjalizacji' });
        expect(statuses.at(-1).detail).toContain('boom');
    });

    describe('while the model initializes', () => {
        it('polls until it becomes ready, reporting progress', async () => {
            const { nano, api, statuses } = setup({ availability: 'downloading' });
            api.availability
                .mockResolvedValueOnce('downloading')
                .mockResolvedValueOnce('downloading')
                .mockResolvedValueOnce('available');
            const progress = [];
            nano.on('progress', text => progress.push(text));
            await nano.check();
            expect(nano.ready).toBe(true);
            expect(progress).toEqual(['Inicjalizacja… 4s']);
            expect(statuses.at(-1)).toMatchObject({ level: 'on' });
        });

        it('stops when the model turns out to be unavailable', async () => {
            const { nano, api, statuses } = setup({ availability: 'downloading' });
            api.availability.mockResolvedValueOnce('downloading').mockResolvedValueOnce('unavailable');
            await nano.check();
            expect(statuses.at(-1)).toMatchObject({ level: 'off', text: 'Model niedostępny' });
        });

        it('gives up after the maximum wait', async () => {
            const { nano, api, statuses } = setup({ availability: 'downloading', pollMs: 1000, maxWaitMs: 3000 });
            api.availability.mockResolvedValue('downloading');
            await nano.check();
            expect(statuses.at(-1)).toMatchObject({ level: 'off', text: 'Timeout inicjalizacji' });
            expect(api.availability).toHaveBeenCalledTimes(1 + 3);
        });
    });
});

describe('download', () => {
    it('creates a session with a progress monitor and then reports the model as active', async () => {
        const { nano, api, session, statuses } = setup({ availability: 'downloadable' });
        const progress = [];
        nano.on('progress', text => progress.push(text));
        api.create.mockImplementation(async ({ monitor }) => {
            monitor({ addEventListener: (_, listener) => listener({ loaded: 50, total: 200 }) });
            return session;
        });
        await nano.download();
        expect(progress).toEqual(['Pobieranie: 25%']);
        expect(session.destroy).toHaveBeenCalled();
        expect(nano.ready).toBe(true);
        expect(statuses.map(s => s.level)).toEqual(['dl', 'on']);
    });

    it('shows an unknown total as an ellipsis', async () => {
        const { nano, api, session } = setup();
        const progress = [];
        nano.on('progress', text => progress.push(text));
        api.create.mockImplementation(async ({ monitor }) => {
            monitor({ addEventListener: (_, listener) => listener({ loaded: 5, total: 0 }) });
            return session;
        });
        await nano.download();
        expect(progress).toEqual(['Pobieranie: …%']);
    });

    it('reports a failed download', async () => {
        const { nano, api, statuses } = setup();
        api.create.mockRejectedValue(new Error('brak miejsca'));
        await nano.download();
        expect(statuses.at(-1)).toMatchObject({ level: 'off', text: 'Błąd pobierania', detail: 'brak miejsca' });
    });

    it('does nothing without the API', async () => {
        const nano = new GeminiNano({ log: new Logger(), getApi: () => undefined });
        const onStatus = vi.fn();
        nano.on('status', onStatus);
        await nano.download();
        expect(onStatus).not.toHaveBeenCalled();
    });
});

describe('getSession', () => {
    let context;
    beforeEach(() => { context = setup(); });

    it('creates a session once and reuses it', async () => {
        await context.nano.check();
        const first = await context.nano.getSession();
        expect(await context.nano.getSession()).toBe(first);
        expect(context.api.create).toHaveBeenCalledTimes(1);
    });

    it('checks availability itself when check() never ran', async () => {
        expect(await context.nano.getSession()).toBe(context.session);
        expect(context.api.availability).toHaveBeenCalledTimes(1);
    });

    it('returns null when the model is not usable', async () => {
        const { nano } = setup({ availability: 'downloadable' });
        await nano.check();
        expect(await nano.getSession()).toBeNull();
    });

    it('returns null without the API', async () => {
        const nano = new GeminiNano({ log: new Logger(), getApi: () => undefined });
        expect(await nano.getSession()).toBeNull();
    });

    it('returns null when creating the session fails', async () => {
        context.api.create.mockRejectedValue(new Error('boom'));
        expect(await context.nano.getSession()).toBeNull();
    });

    it('creates a fresh session after dropSession', async () => {
        await context.nano.getSession();
        context.nano.dropSession();
        await context.nano.getSession();
        expect(context.api.create).toHaveBeenCalledTimes(2);
    });
});
