import { Emitter } from '../core/emitter.js';

/** In-memory diagnostic log shown in the logs panel. Levels: ok, warn, err, info. */
export class Logger extends Emitter {
    entries = [];

    add(level, message, detail = '') {
        const time = new Date().toISOString().replace('T', ' ').slice(0, 23);
        this.entries.push({ time, level, message, detail });
        this.emit('change');
    }

    info = (message, detail) => this.add('info', message, detail);
    ok = (message, detail) => this.add('ok', message, detail);
    warn = (message, detail) => this.add('warn', message, detail);
    err = (message, detail) => this.add('err', message, detail);

    clear() {
        this.entries.length = 0;
        this.emit('change');
    }

    /** Plain-text dump for the clipboard. */
    toText() {
        return this.entries
            .map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}${e.detail ? `\n  ${e.detail}` : ''}`)
            .join('\n');
    }
}
