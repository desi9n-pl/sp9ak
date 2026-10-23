/**
 * Delay in ms before retry number `failures + 1`, growing exponentially up to `max`.
 * Returns null once `limit` consecutive failures were reached, meaning: give up.
 */
export function nextRetryDelay(failures, { base = 1000, max = 8000, limit = 4 } = {}) {
    const count = Number.isInteger(failures) && failures > 0 ? failures : 0;
    if (count >= limit) return null;
    return Math.min(max, base * 2 ** count);
}
