/**
 * The tray process cannot talk to the page directly, so it bumps a counter on the
 * local server. Polling that counter turns a global shortcut into a start/stop request.
 */
export class HotkeyPoller {
    #lastSeq = null;
    #timer = null;
    #fetch;

    constructor({ onSignal, fetchFn = (...args) => globalThis.fetch(...args), intervalMs = 500 }) {
        this.onSignal = onSignal;
        this.intervalMs = intervalMs;
        this.#fetch = fetchFn;
    }

    start() {
        this.poll();
        this.#timer = setInterval(() => this.poll(), this.intervalMs);
    }

    stop() {
        clearInterval(this.#timer);
        this.#timer = null;
    }

    async poll() {
        try {
            const response = await this.#fetch('/api/hotkey', { cache: 'no-store' });
            const { seq, action } = await response.json();
            // The first reading only establishes the baseline: an old press must not replay on page load.
            if (this.#lastSeq !== null && seq > this.#lastSeq) this.onSignal(action);
            this.#lastSeq = seq;
        } catch {
            // server briefly unavailable: try again on the next tick
        }
    }
}
