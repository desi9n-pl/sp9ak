import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../web/js/services/logger.js';

describe('Logger', () => {
    it('records entries with a timestamp and notifies listeners', () => {
        const log = new Logger();
        const onChange = vi.fn();
        log.on('change', onChange);
        log.warn('uwaga', 'szczegóły');
        expect(log.entries).toHaveLength(1);
        expect(log.entries[0]).toMatchObject({ level: 'warn', message: 'uwaga', detail: 'szczegóły' });
        expect(log.entries[0].time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it.each(['info', 'ok', 'warn', 'err'])('has a shortcut for the %s level', level => {
        const log = new Logger();
        log[level]('x');
        expect(log.entries[0].level).toBe(level);
    });

    it('formats entries as plain text for the clipboard', () => {
        const log = new Logger();
        log.ok('gotowe');
        log.err('błąd', 'ślad');
        const lines = log.toText().split('\n');
        expect(lines[0]).toMatch(/\] \[OK\] gotowe$/);
        expect(lines[1]).toMatch(/\] \[ERR\] błąd$/);
        expect(lines[2]).toBe('  ślad');
    });

    it('clears and notifies', () => {
        const log = new Logger();
        log.info('x');
        const onChange = vi.fn();
        log.on('change', onChange);
        log.clear();
        expect(log.entries).toEqual([]);
        expect(onChange).toHaveBeenCalled();
    });
});
