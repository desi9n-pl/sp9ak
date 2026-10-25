/* Front-end quality audit with Lighthouse (desktop profile) of the page served by the app server.
   Fails when a category score drops below its threshold.
   Thresholds (0-100): LH_MIN_PERFORMANCE, LH_MIN_ACCESSIBILITY, LH_MIN_BEST_PRACTICES, LH_MIN_SEO. */
import lighthouse, { desktopConfig } from 'lighthouse';
import { launch } from 'chrome-launcher';
import { startServer, CHROME } from './server.mjs';

const MIN = {
    performance: Number(process.env.LH_MIN_PERFORMANCE || 90),
    accessibility: Number(process.env.LH_MIN_ACCESSIBILITY || 95),
    'best-practices': Number(process.env.LH_MIN_BEST_PRACTICES || 90),
    seo: Number(process.env.LH_MIN_SEO || 80),
};
const METRICS = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'];

const { url, stop } = await startServer();
const chrome = await launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-sandbox'] });
let failed = false;
try {
    const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: Object.keys(MIN) }, desktopConfig);
    for (const [id, minimum] of Object.entries(MIN)) {
        const score = Math.round((lhr.categories[id].score ?? 0) * 100);
        const ok = score >= minimum;
        failed ||= !ok;
        console.log(`${ok ? '✓' : '✗'} ${id}: ${score} (minimum ${minimum})`);
        if (!ok) {
            for (const ref of lhr.categories[id].auditRefs) {
                const audit = lhr.audits[ref.id];
                if (audit.score !== null && audit.score < 0.9 && ref.weight > 0) console.log(`    - ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
            }
        }
    }
    console.log('\nMetryki:');
    for (const id of METRICS) console.log(`  ${lhr.audits[id].title}: ${lhr.audits[id].displayValue}`);
} finally {
    await chrome.kill();
    stop();
}
if (failed) { console.error('\nLighthouse: wynik poniżej progu'); process.exit(1); }
console.log('\nLighthouse: wszystkie kategorie w normie');
