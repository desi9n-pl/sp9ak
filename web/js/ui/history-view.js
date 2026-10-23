import { byId } from './dom.js';

const PREVIEW_LENGTH = 80;
const TIME_FORMAT = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

/** Session history panel. Emits nothing: picking a session calls `onSelect(text)`. */
export class HistoryView {
    constructor({ history, onSelect }) {
        this.history = history;
        this.onSelect = onSelect;
        this.list = byId('historyList');
        this.empty = byId('historyEmpty');
        byId('clearAllBtn').addEventListener('click', () => {
            if (confirm('Usunąć wszystkie sesje z historii?')) history.clear();
        });
        history.on('change', () => this.render());
    }

    render() {
        this.list.replaceChildren(...this.history.items.map(session => this.#item(session)));
        this.empty.hidden = this.history.items.length > 0;
    }

    #item({ id, ts, text }) {
        const item = document.createElement('div');
        item.className = 'sess-item';

        const time = document.createElement('span');
        time.className = 'sess-time';
        time.textContent = new Date(ts).toLocaleString('pl-PL', TIME_FORMAT);

        const preview = document.createElement('span');
        preview.className = 'sess-preview';
        preview.textContent = text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;

        const body = document.createElement('button');
        body.type = 'button';
        body.className = 'sess-body';
        body.addEventListener('click', () => this.onSelect(text));
        body.append(time, preview);

        const remove = document.createElement('button');
        remove.className = 'btn-bare sess-del';
        remove.title = 'Usuń sesję';
        remove.textContent = '×';
        remove.addEventListener('click', event => {
            event.stopPropagation();
            this.history.remove(id);
        });

        item.append(body, remove);
        return item;
    }
}
