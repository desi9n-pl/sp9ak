import { describe, expect, it } from 'vitest';
import { Storage } from '../../../web/js/services/storage.js';

const memoryBackend = () => {
    const data = new Map();
    return {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: key => void data.delete(key),
    };
};

const blockedBackend = () => ({
    getItem() { throw new DOMException('blocked', 'SecurityError'); },
    setItem() { throw new DOMException('quota', 'QuotaExceededError'); },
    removeItem() { throw new DOMException('blocked', 'SecurityError'); },
});

describe('Storage', () => {
    it('stores, reads and removes values', () => {
        const storage = new Storage(memoryBackend());
        expect(storage.set('k', 'v')).toBe(true);
        expect(storage.get('k')).toBe('v');
        storage.remove('k');
        expect(storage.get('k')).toBeNull();
    });

    it('returns the fallback for a missing key', () => {
        expect(new Storage(memoryBackend()).get('missing', 'dflt')).toBe('dflt');
    });

    it('does not throw when the browser blocks storage', () => {
        const storage = new Storage(blockedBackend());
        expect(storage.get('k', 'fallback')).toBe('fallback');
        expect(storage.set('k', 'v')).toBe(false);
        expect(() => storage.remove('k')).not.toThrow();
    });
});
