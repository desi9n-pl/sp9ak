import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest runs from the project root
const html = readFileSync(resolve(process.cwd(), 'web/index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

/** Puts the real page markup into the jsdom document. */
export function mountPage() {
    document.body.innerHTML = body;
    document.documentElement.dataset.theme = 'sepia';
}

export const $ = id => document.getElementById(id);
export const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
export const key = (target, init) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};
