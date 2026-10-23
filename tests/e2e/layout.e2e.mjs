/* Layout testing with gremlins.js: a random horde runs in several window sizes while a
   sampler checks layout invariants (no horizontal scroll, controls inside the window, a usable editor).
   A separate scenario holds back the pin answer and expects the late button to leave the editor where it is.
   Seeds: GREMLINS_SEEDS="1,2"  Actions: GREMLINS_ACTIONS=400 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { start, finish, check, dictPage, ROOT } from './helpers.mjs';

const SEEDS   = (process.env.GREMLINS_SEEDS || '3,11').split(',').map(Number);
const ACTIONS = Number(process.env.GREMLINS_ACTIONS || 400);
const SIZES = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'okno', width: 720, height: 600 },
    { name: 'wąskie', width: 380, height: 700 },
];
const GREMLINS = path.join(ROOT, 'node_modules/gremlins.js/dist/gremlins.min.js');

/* Runs in the browser. Collects violations of layout invariants into window.__layout. */
function watchLayout() {
    window.__layout = new Set();
    const visible = el => el && !el.hidden && el.getClientRects().length > 0;
    const sample = () => {
        const vw = document.documentElement.clientWidth;
        const root = document.documentElement;
        if (root.scrollWidth > vw) window.__layout.add(`przewijanie poziome: ${root.scrollWidth} > ${vw}`);
        for (const id of ['dictBtn', 'copyBtn', 'newNoteBtn', 'output']) {
            const el = document.getElementById(id);
            if (!visible(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.left < -1 || r.right > vw + 1) window.__layout.add(`#${id} poza oknem: ${Math.round(r.left)}..${Math.round(r.right)} z ${vw}`);
        }
        const out = document.getElementById('output');
        if (visible(out) && out.getBoundingClientRect().height < 40) window.__layout.add('#output zapadł się poniżej 40px');
    };
    setInterval(sample, 50);
    window.__sampleLayout = sample;
}

/* Runs in the browser. */
function unleash({ seed, actions }) {
    const g = window.gremlins;
    const chance = new g.Chance(seed);
    // gremlins draws its own markers at the click position; near the right edge they would widen the page
    const quiet = { showAction: () => {} };
    const horde = g.createHorde({
        randomizer: chance,
        species: [g.species.clicker(quiet), g.species.typer(quiet), g.species.scroller(quiet), g.species.formFiller(quiet)],
        mogwais: [g.mogwais.alert()],
        strategies: [g.strategies.distribution({ nb: actions, delay: 3 })],
    });
    return horde.unleash();
}

await start();
try {
    for (const size of SIZES) {
        for (const seed of SEEDS) {
            await check(`layout ${size.name} ${size.width}x${size.height} (seed ${seed}, ${ACTIONS} actions): invariants hold`, async () => {
                const { page, errors, ctx } = await dictPage();
                await page.setViewportSize({ width: size.width, height: size.height });
                await page.addScriptTag({ path: GREMLINS });
                page.on('dialog', d => d.dismiss());
                await page.evaluate(watchLayout);
                await page.evaluate(unleash, { seed, actions: ACTIONS });
                await page.evaluate(() => window.__sampleLayout());
                assert.deepEqual(errors, []);
                assert.deepEqual(await page.evaluate(() => [...window.__layout]), []);
                await ctx.close();
            });
        }
    }

    await check('layout: the late pin button does not move the editor', async () => {
        const { page, ctx } = await dictPage({
            initScripts: [() => {
                // the window manager lists the window only after ~1.5 s, like right after launch
                const real = window.fetch.bind(window);
                const t0 = performance.now();
                window.fetch = (url, opts) => String(url).includes('/api/window')
                    ? Promise.resolve(new Response(JSON.stringify({ supported: performance.now() - t0 > 1500, alwaysOnTop: false })))
                    : real(url, opts);
                window.__shifts = [];
                new PerformanceObserver(list => {
                    for (const e of list.getEntries()) {
                        if (!e.hadRecentInput) window.__shifts.push(...e.sources.map(src => src.node?.id || src.node?.className || src.node?.nodeName));
                    }
                }).observe({ type: 'layout-shift', buffered: true });
            }],
        });
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => document.getElementById('output').getBoundingClientRect().top);
        await page.waitForFunction(() => !document.getElementById('pinBtn').hidden, null, { timeout: 4000 });
        await page.waitForTimeout(200);
        const after = await page.evaluate(() => document.getElementById('output').getBoundingClientRect().top);
        assert.equal(after, before, 'edytor przesunął się po pojawieniu przycisku PIN');
        // the ✦ chip widening when its AI badge appears is a separate, known shift; the editor area must not take part
        const moved = (await page.evaluate(() => window.__shifts)).filter(id => ['output', 'toolbar', 'pinBtn', 'ta-wrap', 'ta-section', 'ta-inner'].includes(id));
        assert.deepEqual(moved, []);
        await ctx.close();
    });
} finally {
    await finish();
}
