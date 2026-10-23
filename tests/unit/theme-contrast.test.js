import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'web/css/theme.css'), 'utf8');

/** Variables of one theme: the `:root` block holds the dark theme, the others override it. */
function theme(selector) {
    const vars = {};
    for (const name of [':root', selector]) {
        const block = css.match(new RegExp(`${name.replace(/[[\]"]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
        for (const [, key, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) vars[key] = value;
    }
    return vars;
}

const luminance = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const THEMES = { dark: ':root', light: '[data-theme="light"]', sepia: '[data-theme="sepia"]' };

describe.each(Object.entries(THEMES))('%s theme contrast (WCAG AA)', (_name, selector) => {
    const vars = theme(selector);

    it.each(['text', 'muted', 'faint', 'accent-text'])('%s is readable on the page and panel backgrounds', color => {
        for (const background of ['bg', 'surface']) {
            expect(ratio(vars[color], vars[background]), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps white button text readable on the accent', () => {
        expect(ratio('#ffffff', vars.accent)).toBeGreaterThanOrEqual(4.5);
    });
});
