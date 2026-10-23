/* Monkey testing with gremlins.js: random clicks, typing, forms and scrolling,
   plus a custom gremlin firing shortcuts (Ctrl+D/N/S, Esc) and simulating speech.
   Several seeds; each seed gives a repeatable run.
   Seeds: GREMLINS_SEEDS="1,2,3"  Actions: GREMLINS_ACTIONS=1000 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { start, finish, check, dictPage, ROOT } from './helpers.mjs';

const SEEDS   = (process.env.GREMLINS_SEEDS || '1,7,42,2024').split(',').map(Number);
const ACTIONS = Number(process.env.GREMLINS_ACTIONS || 1000);

/* Runs in the browser. */
function unleash({ seed, actions }) {
    const g = window.gremlins;
    const chance = new g.Chance(seed);

    const hotkeys = () => {
        const keys = [['d'], ['n'], ['s'], ['c'], ['Escape']];
        const [key] = chance.pickone(keys);
        const target = chance.bool() ? document.activeElement || document.body : document;
        target.dispatchEvent(new KeyboardEvent('keydown', {
            key, ctrlKey: key !== 'Escape', repeat: chance.bool({ likelihood: 20 }), bubbles: true, cancelable: true,
        }));
    };
    const speak = () => window.__say?.(chance.sentence({ words: chance.integer({ min: 1, max: 6 }) }), chance.bool());

    const horde = g.createHorde({
        randomizer: chance,
        species: [
            g.species.clicker(), g.species.formFiller(), g.species.typer(), g.species.scroller(),
            () => () => (chance.bool() ? hotkeys() : speak()),   // gremlin factory: (logger, randomizer) => attack
        ],
        mogwais: [g.mogwais.alert(), g.mogwais.gizmo()],
        strategies: [g.strategies.distribution({ nb: actions, delay: 3 })],
    });
    return horde.unleash();
}

await start();
try {
    for (const seed of SEEDS) {
        await check(`monkey (seed ${seed}, ${ACTIONS} actions): no exceptions, no navigation, the field still works`, async () => {
            const { page, errors, ctx } = await dictPage();
            await page.addScriptTag({ path: path.join(ROOT, 'node_modules/gremlins.js/dist/gremlins.min.js') });
            page.on('dialog', d => d.dismiss());
            await page.evaluate(unleash, { seed, actions: ACTIONS });
            assert.deepEqual(errors, []);
            assert.equal(new URL(page.url()).pathname, '/index.html', 'monkey wyprowadził z aplikacji');
            // after the storm: stop dictation and check that typing still works
            await page.keyboard.press('Escape');
            // the engine's stop() completes a moment later; only then is the text written to the field
            await page.waitForFunction(() => !document.querySelector('#dictBtn')?.classList.contains('on'));
            await page.waitForTimeout(600);
            await page.evaluate(() => { const o = document.getElementById('output'); o.value = ''; o.focus(); });
            await page.keyboard.type('test po monkey');
            assert.equal(await page.inputValue('#output'), 'test po monkey');
            await ctx.close();
        });
    }
} finally {
    await finish();
}
