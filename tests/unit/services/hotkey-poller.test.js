import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotkeyPoller } from '../../../web/js/services/hotkey-poller.js';

const reply = (seq, action = 'start') => ({ json: async () => ({ seq, action }) });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('HotkeyPoller', () => {
    it('ignores the first reading, so an old press does not replay on page load', async () => {
        const onSignal = vi.fn();
        const poller = new HotkeyPoller({ onSignal, fetchFn: vi.fn(async () => reply(7)) });
        await poller.poll();
        expect(onSignal).not.toHaveBeenCalled();
    });

    it('signals once per counter increase, with the requested action', async () => {
        const onSignal = vi.fn();
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(reply(1))
            .mockResolvedValueOnce(reply(1))
            .mockResolvedValueOnce(reply(2, 'stop'))
            .mockResolvedValueOnce(reply(2, 'stop'));
        const poller = new HotkeyPoller({ onSignal, fetchFn });
        for (let i = 0; i < 4; i++) await poller.poll();
        expect(onSignal).toHaveBeenCalledTimes(1);
        expect(onSignal).toHaveBeenCalledWith('stop');
    });

    it('survives a server that is briefly unreachable', async () => {
        const onSignal = vi.fn();
        const fetchFn = vi.fn()
            .mockResolvedValueOnce(reply(1))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(reply(2));
        const poller = new HotkeyPoller({ onSignal, fetchFn });
        for (let i = 0; i < 3; i++) await poller.poll();
        expect(onSignal).toHaveBeenCalledTimes(1);
    });

    it('polls on an interval until stopped', async () => {
        const fetchFn = vi.fn(async () => reply(1));
        const poller = new HotkeyPoller({ onSignal: vi.fn(), fetchFn, intervalMs: 500 });
        poller.start();
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchFn).toHaveBeenCalledTimes(4);
        poller.stop();
        await vi.advanceTimersByTimeAsync(1500);
        expect(fetchFn).toHaveBeenCalledTimes(4);
    });
});
