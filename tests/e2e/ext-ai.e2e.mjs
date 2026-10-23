/* E2E: configuring the external AI (Claude/OpenAI) in settings. */
import assert from 'node:assert/strict';
import { start, finish, check, newPage, GOOD_KEY } from './helpers.mjs';

await start();
try {
    await check('external AI fields appear once a provider is chosen', async () => {
        const { page, ctx } = await newPage();
        assert.equal(await page.locator('#extKeyInput').isVisible(), false);
        await page.selectOption('#extProviderSelect', 'claude');
        assert.equal(await page.locator('#extKeyInput').isVisible(), true);
        assert.equal(await page.locator('#extTestBtn').isVisible(), true);
        assert.equal(await page.inputValue('#extModelInput'), 'claude-haiku-4-5-20251001');
        await ctx.close();
    });

    await check('Testuj: a malformed key sends no request', async () => {
        const calls = [];
        const { page, ctx } = await newPage(calls);
        await page.selectOption('#extProviderSelect', 'claude');
        await page.fill('#extKeyInput', 'zly klucz');
        await page.click('#extTestBtn');
        assert.match(await page.textContent('#extStatusText'), /spacji|zaczynać/);
        assert.equal(calls.length, 0);
        await ctx.close();
    });

    await check('Testuj: a rejected key → error message, nothing saved', async () => {
        const calls = [];
        const { page, ctx } = await newPage(calls);
        await page.selectOption('#extProviderSelect', 'claude');
        await page.fill('#extKeyInput', 'sk-ant-bad');
        await page.click('#extTestBtn');
        await page.waitForFunction(() => /Klucz odrzucony/.test(document.getElementById('extStatusText').textContent));
        assert.equal(await page.evaluate(() => localStorage.getItem('sp9ak-ext-key')), null);
        await ctx.close();
    });

    await check('Testuj + Zapisz: a working key activates the external AI and lands in localStorage', async () => {
        const calls = [];
        const { page, ctx } = await newPage(calls);
        await page.selectOption('#extProviderSelect', 'claude');
        await page.fill('#extKeyInput', GOOD_KEY);
        await page.click('#extTestBtn');
        await page.waitForFunction(() => /Klucz działa/.test(document.getElementById('extStatusText').textContent));
        assert.doesNotMatch(await page.textContent('#extStatusText'), /good-key/); // the key is masked
        await page.click('#extSaveBtn');
        await page.waitForFunction(() => /aktywny/.test(document.getElementById('extStatusText').textContent));
        assert.equal(await page.evaluate(() => localStorage.getItem('sp9ak-ext-key')), GOOD_KEY);
        assert.equal(calls.at(-1).provider, 'claude');
        await ctx.close();
    });

    await check('Usuń: clears the saved key and hides the fields', async () => {
        const { page, ctx } = await newPage();
        await page.evaluate(k => {
            localStorage.setItem('sp9ak-ext-provider', 'claude');
            localStorage.setItem('sp9ak-ext-key', k);
        }, GOOD_KEY);
        await page.reload();
        await page.click('#settingsBtn');
        await page.waitForFunction(() => /aktywny/.test(document.getElementById('extStatusText').textContent));
        await page.click('#extClearBtn');
        assert.equal(await page.evaluate(() => localStorage.getItem('sp9ak-ext-key')), null);
        assert.equal(await page.locator('#extKeyInput').isVisible(), false);
        await ctx.close();
    });

} finally {
    await finish();
}
