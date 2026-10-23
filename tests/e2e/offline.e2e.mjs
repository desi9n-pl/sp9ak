/* E2E: behaviour without internet and on an unstable connection.
   Chrome recognizes speech in the cloud and the external AI needs the network too,
   so the app must not lose text, must not loop, and must degrade gracefully. */
import assert from 'node:assert/strict';
import { start, finish, check, dictPage, toggleDictation, GOOD_KEY } from './helpers.mjs';

/* Stand-in for the local Gemini Nano (works offline). */
const FAKE_NANO = () => {
    window.LanguageModel = {
        availability: async () => 'available',
        create: async () => ({ prompt: async () => 'to jest [[testowy|tekstowy]] wynik' }),
    };
};

const text = (page, sel) => page.textContent(sel);
const waitText = (page, sel, re, timeout = 5000) =>
    page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s).textContent), [sel, re.source], { timeout });

async function saveExtKey(page) {
    await page.click('#settingsBtn');
    await page.selectOption('#extProviderSelect', 'claude');
    await page.fill('#extKeyInput', GOOD_KEY);
    await page.click('#extSaveBtn');
    await waitText(page, '#extStatusText', /aktywny/);
    await page.click('#settingsBtn');
}

await start();
try {
    await check('offline: dictation, rule-based punctuation and sessions work locally', async () => {
        const { page, ctx } = await dictPage();
        await ctx.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await page.click('#typeBtn');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('myślę że to dobry pomysł'));
        await toggleDictation(page);
        assert.match(await page.inputValue('#corrected'), /Myślę, że to dobry pomysł\./);
        await ctx.close();
    });

    await check('speech engine network error: retries with growing delays, then gives up without losing text', async () => {
        const { page, errors, ctx } = await dictPage();
        await page.click('#typeBtn');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('zdanie przed awarią'));
        await page.evaluate(() => { window.__netDown = true; window.__fail('network'); });
        // 1 + 1s + 2s + 4s of delays, then give up
        await page.waitForFunction(() => !document.getElementById('dictBtn').classList.contains('on'), null, { timeout: 20000 });
        const starts = await page.evaluate(() => window.__starts);
        assert.ok(starts >= 3 && starts <= 6, `liczba startów: ${starts} (ponawianie powinno być ograniczone)`);
        assert.match(await page.inputValue('#output'), /zdanie przed awarią/);
        assert.match(await page.inputValue('#corrected'), /Zdanie przed awarią/);
        assert.match(await text(page, '#toast'), /przerwane|internetu/);
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('brief connection loss: dictation resumes by itself and later speech reaches the text', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('pierwsza część'));
        await page.evaluate(() => { window.__netDown = true; window.__fail('network'); });
        await page.waitForTimeout(300);
        await page.evaluate(() => { window.__netDown = false; });   // connection returns before the next retry
        await page.waitForFunction(() => window.__sr.on && window.__starts >= 2, null, { timeout: 8000 });
        await page.waitForTimeout(100);
        await page.evaluate(() => window.__say('druga część'));
        await toggleDictation(page);
        const v = await page.inputValue('#output');
        assert.match(v, /pierwsza część\s+druga część/, `wartość: ${JSON.stringify(v)}`);
        await ctx.close();
    });

    await check('external AI offline: readable message, app keeps working, reactivates when the network returns', async () => {
        const { page, errors, ctx } = await dictPage();
        let down = false;
        await page.route('**/api/ai', route => {
            if (down) return route.abort('internetdisconnected');
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'OK' }) });
        });
        await saveExtKey(page);
        down = true;
        await page.click('#typeBtn');
        await page.type('#output', 'to jest dłuższy tekst do sprawdzenia');
        await page.click('#semanticBtn');
        await waitText(page, '#semanticContent', /Brak połączenia z API/);
        assert.doesNotMatch(await text(page, '#semanticContent'), /TypeError|Failed to fetch/);
        // the field still works
        await page.type('#output', ' i jeszcze trochę');
        // network returns
        down = false;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await waitText(page, '#extStatusText', /aktywny/);
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('external AI offline + local Gemini Nano: the review falls back to Nano', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        let down = false;
        await page.route('**/api/ai', route => down
            ? route.abort('internetdisconnected')
            : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'OK' }) }));
        await saveExtKey(page);
        down = true;
        await page.click('#typeBtn');
        await page.type('#output', 'to jest testowy wynik');
        await page.click('#semanticBtn');
        await waitText(page, '#semanticContent', /tekstowy/);
        assert.match(await text(page, '#toast'), /Gemini Nano/);
        await ctx.close();
    });

    await check('external AI: a server "timeout / no connection" answer becomes a readable message', async () => {
        const { page, ctx } = await dictPage();
        await page.route('**/api/ai', route => route.fulfill({ status: 500, contentType: 'application/json',
            body: JSON.stringify({ error: 'Brak połączenia z API Claude (urlopen: timed out)' }) }));
        await page.click('#settingsBtn');
        await page.selectOption('#extProviderSelect', 'claude');
        await page.fill('#extKeyInput', GOOD_KEY);
        await page.click('#extTestBtn');
        await waitText(page, '#extStatusText', /Brak połączenia z API/);
        await ctx.close();
    });

    await check('sessions: with the server down, history survives a reload through localStorage', async () => {
        const { page, ctx } = await dictPage();
        await page.route('**/api/sessions', r => r.abort());
        await page.route('**/sessions.json', r => r.abort());
        await page.click('#typeBtn');
        await page.type('#output', 'notatka zapisana offline');
        await page.click('#newNoteBtn');
        await page.reload();
        await page.click('#historyBtn');
        await page.waitForSelector('.sess-item');
        assert.match(await text(page, '#historyPanel'), /notatka zapisana offline/);
        await ctx.close();
    });
} finally {
    await finish();
}
