/* Accessibility audit with pa11y (WCAG 2 AA, HTML_CodeSniffer + axe) of the page in each theme
   and with each panel open. Fails on any definite error. Results axe marks "needs further review" (e.g. text over overlapping
   elements, pseudo-element badges) cannot be decided automatically and are only listed with PA11Y_VERBOSE=1. */
import pa11y from 'pa11y';
import puppeteer from 'puppeteer';
import { startServer, CHROME } from './server.mjs';

const THEMES = ['sepia', 'light', 'dark'];
const STATES = {
    'editor': [],
    'settings': ['click element #settingsBtn', 'wait for element #themesPanel to be visible'],
    'history': ['click element #historyBtn', 'wait for element #historyPanel to be visible'],
    'install guide': ['click element #settingsBtn', 'wait for element #themesPanel to be visible',
        'click element #installGeminiBtn', 'wait for element #installModal .modal to be visible'],
};

/** The theme is chosen before the first paint, and transitions are off so axe never reads colours mid-fade. */
const prepare = theme => {
    try { localStorage.setItem('sp9ak-theme', theme); } catch { /* storage unavailable */ }
    document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.head.append(style);
    });
};

const { url, stop } = await startServer();
let failures = 0;
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
    for (const theme of THEMES) {
        for (const [state, actions] of Object.entries(STATES)) {
            const page = await browser.newPage();
            await page.evaluateOnNewDocument(prepare, theme);
            const { issues } = await pa11y(url, {
                standard: 'WCAG2AA',
                runners: ['axe', 'htmlcs'],
                browser,
                page,
                actions,
                timeout: 30000,
            });
            await page.close();
            const errors = issues.filter(issue => issue.type === 'error' && !issue.runnerExtras?.needsFurtherReview);
            failures += errors.length;
            console.log(`${errors.length ? '✗' : '✓'} ${theme} / ${state}: ${errors.length} errors, ${issues.length - errors.length} warnings/notices`);
            for (const issue of errors) console.log(`    ${issue.code}\n      ${issue.message}\n      ${issue.selector}`);
            if (process.env.PA11Y_VERBOSE) for (const issue of issues.filter(i => !errors.includes(i))) console.log(`    (${issue.runnerExtras?.needsFurtherReview ? 'review' : issue.type}) ${issue.code} ${issue.selector}`);
        }
    }
} finally {
    await browser.close();
    stop();
}
if (failures) { console.error(`\n${failures} błędów dostępności`); process.exit(1); }
console.log('\nPa11y: brak błędów dostępności');
