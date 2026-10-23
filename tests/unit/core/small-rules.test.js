import { describe, expect, it } from 'vitest';
import { isEditKey } from '../../../web/js/core/edit-keys.js';
import { nextRetryDelay } from '../../../web/js/core/retry.js';
import { MIN_SESSION_LENGTH, shouldSaveSession } from '../../../web/js/core/sessions.js';
import { Emitter } from '../../../web/js/core/emitter.js';

describe('isEditKey', () => {
    it.each(['a', 'Z', '1', ' ', 'ą', 'Backspace', 'Delete', 'Enter'])('"%s" edits', key => {
        expect(isEditKey({ key })).toBe(true);
    });

    it.each(['x', 'v', 'z', 'y', 'X'])('Ctrl+%s edits', key => {
        expect(isEditKey({ key, ctrlKey: true })).toBe(true);
        expect(isEditKey({ key, metaKey: true })).toBe(true);
    });

    it.each(['ArrowLeft', 'ArrowDown', 'Home', 'End', 'PageUp', 'Tab', 'Escape', 'Shift', 'F5', 'Control'])(
        '%s does not edit', key => {
            expect(isEditKey({ key })).toBe(false);
        });

    it.each(['a', 'c', 'd', 'n', 's'])('Ctrl+%s (select, copy, app shortcuts) does not edit', key => {
        expect(isEditKey({ key, ctrlKey: true })).toBe(false);
    });

    it('treats Alt combinations as navigation', () => {
        expect(isEditKey({ key: 'a', altKey: true })).toBe(false);
    });

    it('ignores events without a key', () => {
        expect(isEditKey({})).toBe(false);
        expect(isEditKey()).toBe(false);
    });
});

describe('nextRetryDelay', () => {
    it('doubles each time', () => {
        expect([0, 1, 2, 3].map(n => nextRetryDelay(n))).toEqual([1000, 2000, 4000, 8000]);
    });

    it('gives up at the limit', () => {
        expect(nextRetryDelay(4)).toBeNull();
        expect(nextRetryDelay(100)).toBeNull();
    });

    it('caps the delay', () => {
        expect(nextRetryDelay(3, { max: 3000, limit: 10 })).toBe(3000);
    });

    it('treats invalid input as the first attempt', () => {
        expect(nextRetryDelay(-1)).toBe(1000);
        expect(nextRetryDelay(NaN)).toBe(1000);
        expect(nextRetryDelay(undefined)).toBe(1000);
    });
});

describe('shouldSaveSession', () => {
    it('accepts new text', () => {
        expect(shouldSaveSession('Moja notatka', '')).toBe(true);
    });

    it('rejects a repeat of the last saved text, ignoring surrounding whitespace', () => {
        expect(shouldSaveSession('Moja notatka', 'Moja notatka')).toBe(false);
        expect(shouldSaveSession('  Moja notatka  ', 'Moja notatka')).toBe(false);
    });

    it('rejects text shorter than the minimum', () => {
        expect(shouldSaveSession('', '')).toBe(false);
        expect(shouldSaveSession('a'.repeat(MIN_SESSION_LENGTH - 1), '')).toBe(false);
        expect(shouldSaveSession('a'.repeat(MIN_SESSION_LENGTH), '')).toBe(true);
    });

    it('measures length after trimming', () => {
        expect(shouldSaveSession('  abc  ', '')).toBe(false);
    });
});

describe('Emitter', () => {
    it('delivers payloads to every listener of an event', () => {
        const emitter = new Emitter();
        const seen = [];
        emitter.on('x', v => seen.push(['a', v]));
        emitter.on('x', v => seen.push(['b', v]));
        emitter.emit('x', 1);
        expect(seen).toEqual([['a', 1], ['b', 1]]);
    });

    it('keeps events apart and tolerates events nobody listens to', () => {
        const emitter = new Emitter();
        const seen = [];
        emitter.on('x', () => seen.push('x'));
        emitter.emit('y');
        expect(seen).toEqual([]);
    });

    it('stops delivering after unsubscribing', () => {
        const emitter = new Emitter();
        const seen = [];
        const off = emitter.on('x', () => seen.push(1));
        emitter.emit('x');
        off();
        emitter.emit('x');
        expect(seen).toEqual([1]);
    });
});
