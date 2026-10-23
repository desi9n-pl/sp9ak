/* E2E: regression tests for fixed bugs (caret position while dictating, Ctrl+D, Ctrl+S, read-only field, shortcuts). */
import assert from 'node:assert/strict';
import { start, finish, check, dictPage, toggleDictation, BASE } from './helpers.mjs';

await start();
try {
    await check('Ctrl+D twice: the second dictation appends at the end, not in the middle', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.type('#output', 'Ala ma kota.');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('pierwsze zdanie'));
        await toggleDictation(page);
        await toggleDictation(page);
        await page.evaluate(() => window.__say('drugie zdanie'));
        await toggleDictation(page);
        const v = await page.inputValue('#output');
        assert.match(v, /^Ala ma kota\.\s*pierwsze zdanie\s+drugie zdanie\s*$/, `wartość: ${JSON.stringify(v)}`);
        await ctx.close();
    });

    await check('Ctrl+D: dictating in the middle of text stays at the caret', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.type('#output', 'początek koniec');
        for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('środek'));
        await toggleDictation(page);
        const v = await page.inputValue('#output');
        assert.match(v, /^początek środek\s*koniec$/, `wartość: ${JSON.stringify(v)}`);
        await ctx.close();
    });

    await check('Ctrl+D after typing between dictations: speech goes at the end', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('raz'));
        await toggleDictation(page);
        await page.keyboard.press('Control+End');
        await page.type('#output', 'ręcznie ');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('dwa'));
        await toggleDictation(page);
        const v = await page.inputValue('#output');
        assert.match(v, /^raz\s+ręcznie\s+dwa\s*$/, `wartość: ${JSON.stringify(v)}`);
        await ctx.close();
    });

    await check('Ctrl+D with focus outside the field: speech is appended after the previous one', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.type('#output', 'abc');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('raz'));
        await page.evaluate(() => document.activeElement.blur());   // the user clicks elsewhere
        await toggleDictation(page);                                  // stop: keyup lands outside #output
        await toggleDictation(page);
        await page.evaluate(() => window.__say('dwa'));
        await toggleDictation(page);
        const v = await page.inputValue('#output');
        assert.match(v, /^abc\s*raz\s+dwa\s*$/, `wartość: ${JSON.stringify(v)}`);
        await ctx.close();
    });

    await check('Ctrl+D held down (auto-repeat) does not toggle dictation repeatedly', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.evaluate(() => {
            for (let i = 0; i < 4; i++) {
                document.dispatchEvent(new KeyboardEvent('keydown',
                    { key: 'd', ctrlKey: true, repeat: i > 0, bubbles: true, cancelable: true }));
            }
        });
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => document.getElementById('dictBtn').classList.contains('on')), true);
        await ctx.close();
    });

    await check('Ctrl+S is blocked (defaultPrevented)', async () => {
        const { page, ctx } = await dictPage();
        const prevented = await page.evaluate(() => {
            const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
            document.dispatchEvent(e);
            const e2 = new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, bubbles: true, cancelable: true });
            document.dispatchEvent(e2);
            return e.defaultPrevented && e2.defaultPrevented;
        });
        assert.equal(prevented, true);
        await ctx.close();
    });


    await check('bottom field: not editable, selecting works, an edit attempt shows a toast', async () => {
        const { page, ctx } = await dictPage();
        await page.evaluate(() => {
            document.getElementById('correctedSection').hidden = false;
            document.getElementById('corrected').value = 'Poprawiony tekst.';
        });
        await page.click('#corrected');
        for (const key of ['a', 'Backspace', 'Delete', 'Enter', 'Control+v', 'Control+x']) {
            await page.keyboard.press(key);
        }
        assert.equal(await page.inputValue('#corrected'), 'Poprawiony tekst.');
        assert.match(await page.textContent('#toast'), /górnym okienku/);
        assert.equal(await page.locator('#toast').evaluate(t => t.classList.contains('show')), true);
        // selecting and copying still work
        await page.keyboard.press('Control+a');
        const sel = await page.evaluate(() => {
            const c = document.getElementById('corrected');
            return c.value.substring(c.selectionStart, c.selectionEnd);
        });
        assert.equal(sel, 'Poprawiony tekst.');
        // programmatic writes (e.g. an AI review result) still work
        await page.evaluate(() => { document.getElementById('corrected').value += ' Dodane.'; });
        assert.equal(await page.inputValue('#corrected'), 'Poprawiony tekst. Dodane.');
        await ctx.close();
    });

    await check('bottom field: the toast disappears after a moment', async () => {
        const { page, ctx } = await dictPage();
        await page.evaluate(() => { document.getElementById('correctedSection').hidden = false; });
        await page.click('#corrected');
        await page.keyboard.press('x');
        await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: 4000 });
        await ctx.close();
    });

    await check('Kopiuj button keeps its Ctrl+C label while "Skopiowano" is shown', async () => {
        const { page, ctx } = await dictPage();
        assert.match(await page.textContent('#copyBtn .btn-kbd'), /Ctrl\+C/);
        await page.click('#typeBtn');
        await page.type('#output', 'tekst');
        await page.click('#copyBtn');
        await page.waitForFunction(() => /Skopiowano/.test(document.getElementById('copyLabel').textContent));
        assert.match(await page.textContent('#copyBtn .btn-kbd'), /Ctrl\+C/);
        await ctx.close();
    });

    await check('diagnostic logs: hidden by default, enabled in settings, remembered', async () => {
        const { page, ctx } = await dictPage();
        assert.equal(await page.locator('#logsBtn').isVisible(), false);
        await page.click('#settingsBtn');
        await page.check('#logsToggle');
        assert.equal(await page.locator('#logsBtn').isVisible(), true);
        await page.reload();
        assert.equal(await page.locator('#logsBtn').isVisible(), true);
        await page.click('#settingsBtn');
        await page.click('#logsBtn');
        assert.equal(await page.locator('#logsPanel').evaluate(p => p.classList.contains('open')), true);
        await page.click('#settingsBtn');
        await page.uncheck('#logsToggle');
        assert.equal(await page.locator('#logsBtn').isVisible(), false);
        assert.equal(await page.locator('#logsPanel').evaluate(p => p.classList.contains('open')), false);
        await ctx.close();
    });

    await check('global shortcut (POST /api/hotkey from the tray): starts dictation, a further signal does not stop it', async () => {
        const { page, ctx } = await dictPage();
        const on = () => page.evaluate(() => document.getElementById('dictBtn').classList.contains('on'));
        await page.waitForTimeout(700);   // the page records the baseline counter
        await fetch(`${BASE}/api/hotkey`, { method: 'POST' });
        await page.waitForFunction(() => document.getElementById('dictBtn').classList.contains('on'));
        await fetch(`${BASE}/api/hotkey`, { method: 'POST' });
        await page.waitForTimeout(1200);
        assert.equal(await on(), true, 'drugi sygnał nie powinien wyłączać dyktowania');
        await page.evaluate(() => window.__say('podyktowane skrótem'));
        // Ctrl+Shift+F11: end dictation
        await fetch(`${BASE}/api/hotkey`, { method: 'POST', body: JSON.stringify({ action: 'stop' }) });
        await page.waitForFunction(() => !document.getElementById('dictBtn').classList.contains('on'));
        assert.match(await page.inputValue('#corrected'), /Podyktowane skrótem/);
        // stop while idle must not start anything
        await fetch(`${BASE}/api/hotkey`, { method: 'POST', body: JSON.stringify({ action: 'stop' }) });
        await page.waitForTimeout(1200);
        assert.equal(await on(), false, 'stop nie może włączać dyktowania');
        await ctx.close();
    });

    await check('start right after the previous dictation (engine still closing): dictation starts anyway', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.type('#output', 'tekst który już jest');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('pierwsze'));
        await page.keyboard.press('Control+d');   // stop; the engine takes another quarter second to close
        await page.keyboard.press('Control+d');   // start right away (the global shortcut behaves the same)
        await page.waitForTimeout(1000);
        assert.equal(await page.evaluate(() => document.getElementById('dictBtn').classList.contains('on')), true);
        await page.evaluate(() => window.__say('drugie'));
        await toggleDictation(page);
        assert.match(await page.inputValue('#output'), /pierwsze\s+drugie/);
        await ctx.close();
    });
} finally {
    await finish();
}
