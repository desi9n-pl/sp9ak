/* E2E: user interface behaviour: themes, history, panels, semantic review, Gemini Nano status.
   Written before the refactoring to pin down what the app does. */
import assert from 'node:assert/strict';
import { start, finish, check, dictPage, toggleDictation, FAKE_AUDIO } from './helpers.mjs';

/* Gemini Nano stand-in; window.__nanoReply sets the model's answer. */
const FAKE_NANO = () => {
    delete window.ai;
    window.__nanoReply = 'to jest [[testowy|tekstowy]] wynik';
    window.__nanoCreates = [];
    window.LanguageModel = {
        availability: async () => window.__nanoState || 'available',
        create: async opts => {
            window.__nanoCreates.push(!!opts?.monitor);
            if (opts?.monitor) {
                const handlers = [];
                opts.monitor({ addEventListener: (_, fn) => handlers.push(fn) });
                handlers.forEach(fn => fn({ loaded: 50, total: 100 }));
                window.__nanoState = 'available';
            }
            return {
                prompt: async () => {
                    if (window.__nanoFail) throw new Error('model padł');
                    return window.__nanoReply;
                },
                destroy() {},
            };
        },
    };
};
/* Chrome with the flags enabled ships its own API; this stand-in removes it. */
const NO_AI = () => { delete window.ai; delete window.LanguageModel; };
/* Init scripts are serialized, so they cannot close over variables; hence separate literals. */
const NANO_UNAVAILABLE  = () => { window.__nanoState = 'unavailable'; };
const NANO_DOWNLOADABLE = () => { window.__nanoState = 'downloadable'; };

const waitText = (page, sel, re, timeout = 5000) =>
    page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s).textContent), [sel, re.source], { timeout });
const isOpen = (page, sel) => page.evaluate(s => document.querySelector(s).classList.contains('open'), sel);
const visible = (page, sel) => page.evaluate(s => getComputedStyle(document.querySelector(s)).display !== 'none', sel);

async function dictate(page, ...phrases) {
    await toggleDictation(page);
    for (const p of phrases) await page.evaluate(t => window.__say(t), p);
    await toggleDictation(page);
}

await start();
try {
    await check('theme: the choice is saved and survives a reload', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#settingsBtn');
        await page.click('[data-t="dark"]');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
        assert.equal(await page.evaluate(() => document.querySelector('[data-t="dark"]').classList.contains('active')), true);
        await page.reload();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
        assert.equal(await page.evaluate(() => localStorage.getItem('sp9ak-theme')), 'dark');
        await ctx.close();
    });

    await check('language: the PL/EN chip changes the recognition language', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#langToggle');
        assert.equal(await page.textContent('#langToggle'), 'EN');
        await toggleDictation(page);
        assert.equal(await page.evaluate(() => window.__sr.lang), 'en-US');
        await page.click('#langToggle');
        assert.equal(await page.textContent('#langToggle'), 'PL');
        assert.equal(await page.evaluate(() => window.__sr.lang), 'pl-PL');
        await ctx.close();
    });

    await check('punctuation: on by default; switching it off keeps raw text and is remembered', async () => {
        const { page, ctx } = await dictPage();
        assert.equal(await page.evaluate(() => document.getElementById('punctToggle').classList.contains('active')), true);
        await page.click('#punctToggle');
        assert.equal(await page.evaluate(() => localStorage.getItem('sp9ak-punct')), 'off');
        await dictate(page, 'myślę że to dobry pomysł');
        assert.equal((await page.inputValue('#corrected')).trim(), 'myślę że to dobry pomysł');
        await page.reload();
        assert.equal(await page.evaluate(() => document.getElementById('punctToggle').classList.contains('active')), false);
        await ctx.close();
    });

    await check('punctuation on: the corrected text gets a comma and a capital letter', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'nie przyjdę bo jestem chory');
        assert.equal(await visible(page, '#correctedSection'), true);
        assert.equal((await page.inputValue('#corrected')).trim(), 'Nie przyjdę, bo jestem chory');
        await ctx.close();
    });

    await check('interim results appear in the field and are replaced by the final one', async () => {
        const { page, ctx } = await dictPage();
        await toggleDictation(page);
        await page.evaluate(() => window.__say('rob', false));
        assert.equal(await page.inputValue('#output'), 'rob');
        await page.evaluate(() => window.__say('robię', true));
        assert.equal((await page.inputValue('#output')).trim(), 'robię');
        await toggleDictation(page);
        await ctx.close();
    });

    await check('dictation button: labelled Pauza while recording and Dyktuj afterwards', async () => {
        const { page, ctx } = await dictPage();
        await toggleDictation(page);
        assert.equal(await page.textContent('#dictLabel'), 'Pauza');
        assert.equal(await page.textContent('#msg'), 'Słucham…');
        await toggleDictation(page);
        assert.equal(await page.textContent('#dictLabel'), 'Dyktuj');
        assert.equal(await page.textContent('#msg'), 'Gotowy');
        await ctx.close();
    });

    await check('sounds: dictation beeps up and down; switched off they stay off after a reload', async () => {
        const { page, ctx } = await dictPage({ sounds: true, initScripts: [FAKE_AUDIO] });
        await toggleDictation(page);
        await toggleDictation(page);
        assert.deepEqual(await page.evaluate(() => window.__tones), [660, 880, 880, 660]);

        await page.click('#settingsBtn');
        await page.uncheck('#soundToggle');
        await page.reload();
        assert.equal(await page.isChecked('#soundToggle'), false);
        await toggleDictation(page);
        await toggleDictation(page);
        assert.deepEqual(await page.evaluate(() => window.__tones), []);
        await ctx.close();
    });

    await check('no microphone access: the message stays and dictation ends', async () => {
        const { page, ctx } = await dictPage();
        await toggleDictation(page);
        await page.evaluate(() => window.__fail('not-allowed'));
        await page.waitForTimeout(400);   // the engine's `end` event follows the error
        assert.equal(await page.textContent('#msg'), 'Brak dostępu do mikrofonu');
        assert.equal(await page.evaluate(() => document.getElementById('dictBtn').classList.contains('on')), false);
        await ctx.close();
    });

    await check('no SpeechRecognition: the button is disabled with an explanation', async () => {
        const { page, ctx } = await dictPage({ initScripts: [() => {
            delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
        }] });
        assert.equal(await page.isDisabled('#dictBtn'), true);
        assert.match(await page.textContent('#msg'), /nie obsługuje rozpoznawania mowy/);
        await ctx.close();
    });

    await check('empty state: the big button dictates, "Zacznij pisać" hides it', async () => {
        const { page, ctx } = await dictPage();
        const isEmpty = () => page.evaluate(() => document.getElementById('emptyState').parentElement.classList.contains('is-empty'));
        assert.equal(await isEmpty(), true);
        await page.click('#bigDictBtn');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.getElementById('dictBtn').classList.contains('on')), true);
        await toggleDictation(page);
        await page.click('#newNoteBtn');
        await page.click('#typeBtn');
        await page.waitForTimeout(300);
        assert.equal(await isEmpty(), false);
        await ctx.close();
    });

    await check('editing the top field refreshes the bottom one after a few seconds', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'pierwszy tekst');
        await page.fill('#output', 'zupełnie nowy tekst');
        await page.waitForFunction(() => /Zupełnie nowy tekst/.test(document.getElementById('corrected').value), null, { timeout: 5000 });
        await ctx.close();
    });

    await check('history: dictation saves a session, a click loads it, × deletes it', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'to jest dłuższe zdanie testowe');
        await page.click('#historyBtn');
        assert.equal(await isOpen(page, '#historyPanel'), true);
        assert.equal(await page.locator('.sess-item').count(), 1);
        assert.match(await page.textContent('.sess-preview'), /dłuższe zdanie testowe/);
        await page.fill('#output', '');
        await page.click('.sess-body');
        assert.match(await page.inputValue('#output'), /dłuższe zdanie testowe/);
        assert.equal(await isOpen(page, '#historyPanel'), false);
        await page.click('#historyBtn');
        await page.click('.sess-del');
        assert.equal(await page.locator('.sess-item').count(), 0);
        assert.equal(await visible(page, '#historyEmpty'), true);
        await ctx.close();
    });

    await check('history: "Wyczyść wszystkie" asks for confirmation', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'jakieś długie zdanie do historii');
        await page.click('#historyBtn');
        page.once('dialog', d => d.dismiss());
        await page.click('#clearAllBtn');
        assert.equal(await page.locator('.sess-item').count(), 1);
        page.once('dialog', d => d.accept());
        await page.click('#clearAllBtn');
        assert.equal(await page.locator('.sess-item').count(), 0);
        await ctx.close();
    });

    await check('history: after loading a session, the next dictation appends to it', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'stara notatka testowa');
        await page.click('#newNoteBtn');
        await page.click('#historyBtn');
        await page.click('.sess-body');
        await dictate(page, 'dopisek');
        assert.match(await page.inputValue('#output'), /^Stara notatka testowa dopisek\s*$/);
        await ctx.close();
    });

    await check('history: session text is shown literally (no HTML injection)', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.fill('#output', '<img src=x onerror="window.__xss=1"> dłuższy tekst');
        await page.click('#newNoteBtn');
        await page.click('#historyBtn');
        assert.equal(await page.evaluate(() => window.__xss), undefined);
        assert.match(await page.textContent('.sess-preview'), /<img src=x/);
        await ctx.close();
    });

    await check('new note: saves the current text and clears both fields', async () => {
        const { page, ctx } = await dictPage();
        await dictate(page, 'notatka do zapisania w historii');
        await page.keyboard.press('Control+n');
        assert.equal(await page.inputValue('#output'), '');
        assert.equal(await page.inputValue('#corrected'), '');
        assert.equal(await visible(page, '#correctedSection'), false);
        await page.click('#historyBtn');
        assert.equal(await page.locator('.sess-item').count(), 1);
        await ctx.close();
    });

    await check('copy: the corrected text goes to the clipboard, or the original when there is none', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.fill('#output', 'tylko oryginał');
        await page.click('#copyBtn');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'tylko oryginał');
        assert.equal(await page.textContent('#copyLabel'), '✓ Skopiowano');
        await page.fill('#output', '');
        await dictate(page, 'nie przyjdę bo jestem chory');
        await page.click('#copyBtn');
        assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trim(), 'Nie przyjdę, bo jestem chory');
        await page.waitForFunction(() => document.getElementById('copyLabel').textContent === 'Kopiuj', null, { timeout: 4000 });
        await ctx.close();
    });

    await check('Ctrl+C without a selection copies everything', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#typeBtn');
        await page.fill('#output', 'cały tekst');
        await page.keyboard.press('Control+c');
        await page.waitForFunction(() => document.getElementById('copyLabel').textContent !== 'Kopiuj');
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'cały tekst');
        await ctx.close();
    });

    await check('panels: history and settings exclude each other, Escape closes all', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#settingsBtn');
        assert.equal(await isOpen(page, '#themesPanel'), true);
        await page.click('#historyBtn');
        assert.equal(await isOpen(page, '#historyPanel'), true);
        assert.equal(await isOpen(page, '#themesPanel'), false);
        await page.keyboard.press('Escape');
        assert.equal(await isOpen(page, '#historyPanel'), false);
        assert.equal(await page.evaluate(() => document.getElementById('historyBtn').classList.contains('active')), false);
        await ctx.close();
    });

    await check('Escape during dictation ends it', async () => {
        const { page, ctx } = await dictPage();
        await toggleDictation(page);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        assert.equal(await page.evaluate(() => document.getElementById('dictBtn').classList.contains('on')), false);
        await ctx.close();
    });

    await check('Gemini Nano guide: opens, closes with ✕, the backdrop and Escape', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#settingsBtn');
        for (const close of [
            () => page.click('#installModalClose'),
            () => page.mouse.click(5, 5),
            () => page.keyboard.press('Escape'),
        ]) {
            await page.click('#installGeminiBtn');
            assert.equal(await isOpen(page, '#installModal'), true);
            await close();
            if (await isOpen(page, '#installModal')) assert.fail('modal nie zamknął się');
        }
        await ctx.close();
    });

    await check('logs: entries render and can be cleared', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await page.click('#settingsBtn');
        await page.check('#logsToggle');
        await page.click('#settingsBtn');
        await page.click('#logsBtn');
        assert.equal(await isOpen(page, '#logsPanel'), true);
        assert.match(await page.textContent('#logsList'), /availability\(\)/);
        await page.click('#clearLogsBtn');
        assert.equal(await visible(page, '#logsEmpty'), true);
        await page.click('#logsBtn');
        assert.equal(await isOpen(page, '#logsPanel'), false);
        await ctx.close();
    });

    await check('logs: switching the option off closes the panel and hides the button', async () => {
        const { page, ctx } = await dictPage();
        await page.click('#settingsBtn');
        await page.check('#logsToggle');
        await page.click('#logsBtn');
        await page.click('#settingsBtn');
        await page.uncheck('#logsToggle');
        assert.equal(await visible(page, '#logsBtn'), false);
        assert.equal(await isOpen(page, '#logsPanel'), false);
        await ctx.close();
    });

    await check('Gemini Nano: no API → "Flaga wyłączona"', async () => {
        const { page, ctx } = await dictPage({ initScripts: [NO_AI] });
        await waitText(page, '#aiStatusText', /Flaga wyłączona/);
        assert.equal(await page.evaluate(() => document.getElementById('punctToggle').dataset.ai), 'off');
        await ctx.close();
    });

    await check('Gemini Nano: unavailable model → message', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO, NANO_UNAVAILABLE] });
        await waitText(page, '#aiStatusText', /Model niedostępny/);
        await ctx.close();
    });

    await check('Gemini Nano: available → active, ✦ shows the AI badge', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await waitText(page, '#aiStatusText', /Gemini Nano aktywny/);
        assert.equal(await page.evaluate(() => document.getElementById('punctToggle').dataset.ai), 'on');
        await ctx.close();
    });

    await check('Gemini Nano: downloadable → clicking ✦ downloads and activates it', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO, NANO_DOWNLOADABLE] });
        await waitText(page, '#aiStatusText', /Kliknij ✦/);
        assert.equal(await page.evaluate(() => document.getElementById('punctToggle').dataset.ai), 'dl');
        await page.click('#punctToggle');
        await waitText(page, '#aiStatusText', /Gemini Nano aktywny/);
        assert.deepEqual(await page.evaluate(() => window.__nanoCreates), [true]);
        await ctx.close();
    });

    const openSemantic = async page => {
        await page.click('#typeBtn');
        await page.fill('#output', 'to jest testowy wynik');
        await waitText(page, '#aiStatusText', /aktywny/);
        await page.click('#semanticBtn');
        await page.waitForSelector('.suspect-orig');
    };

    await check('review: shows the suspect word with its suggestion', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await openSemantic(page);
        assert.equal(await isOpen(page, '#semanticPanel'), true);
        assert.equal(await page.textContent('.suspect-orig'), 'testowy');
        assert.equal(await page.textContent('.suspect-sug'), 'tekstowy');
        await ctx.close();
    });

    await check('review: accepting a suggestion and "Zastosuj" replaces the text', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await openSemantic(page);
        await page.click('.suspect-sug');
        assert.equal(await page.evaluate(() => document.querySelector('.suspect-sug').classList.contains('accepted')), true);
        await page.click('#semanticApplyBtn');
        assert.equal(await page.inputValue('#output'), 'to jest tekstowy wynik');
        assert.equal(await isOpen(page, '#semanticPanel'), false);
        await ctx.close();
    });

    await check('review: clicking again undoes the acceptance; without acceptance the original stays', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await openSemantic(page);
        await page.click('.suspect-sug');
        await page.click('.suspect-orig');
        assert.equal(await page.evaluate(() => document.querySelector('.suspect-sug').classList.contains('accepted')), false);
        await page.click('#semanticApplyBtn');
        assert.equal(await page.inputValue('#output'), 'to jest testowy wynik');
        await ctx.close();
    });

    await check('review: "Zaakceptuj wszystkie" accepts every suggestion', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO, () => {
            window.__nanoReply = '[[a|b]] i [[c|d]]';
        }] });
        await page.evaluate(() => { window.__nanoReply = '[[a|b]] i [[c|d]]'; });
        await openSemantic(page);
        await page.click('#semanticAcceptAllBtn');
        await page.click('#semanticApplyBtn');
        assert.equal(await page.inputValue('#output'), 'b i d');
        await ctx.close();
    });

    await check('review: no errors → "Brak podejrzanych słów"', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await page.evaluate(() => { window.__nanoReply = 'czysty tekst'; });
        await page.click('#typeBtn');
        await page.fill('#output', 'czysty tekst');
        await waitText(page, '#aiStatusText', /aktywny/);
        await page.click('#semanticBtn');
        await page.waitForFunction(() => getComputedStyle(document.getElementById('semanticEmpty')).display !== 'none');
        await ctx.close();
    });

    await check('review: clicking the button again and ✕ close the panel', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await openSemantic(page);
        await page.click('#semanticBtn');
        assert.equal(await isOpen(page, '#semanticPanel'), false);
        await page.click('#semanticBtn');
        await page.waitForSelector('.suspect-orig');
        await page.click('#semanticCloseBtn');
        assert.equal(await isOpen(page, '#semanticPanel'), false);
        await ctx.close();
    });

    await check('review: a model error shows a message and the app keeps working', async () => {
        const { page, errors, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await page.evaluate(() => { window.__nanoFail = true; });
        await page.click('#typeBtn');
        await page.fill('#output', 'tekst do sprawdzenia');
        await waitText(page, '#aiStatusText', /aktywny/);
        await page.click('#semanticBtn');
        await waitText(page, '#semanticContent', /Błąd: model padł/);
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('review: without any AI a hint appears in the status line', async () => {
        const { page, ctx } = await dictPage({ initScripts: [NO_AI] });
        await page.click('#typeBtn');
        await page.fill('#output', 'jakiś tekst');
        await waitText(page, '#aiStatusText', /Flaga wyłączona/);
        await page.click('#semanticBtn');
        await waitText(page, '#msg', /Brak AI/);
        assert.equal(await isOpen(page, '#semanticPanel'), false);
        await ctx.close();
    });

    await check('review: nothing happens for an empty field', async () => {
        const { page, ctx } = await dictPage({ initScripts: [FAKE_NANO] });
        await page.click('#semanticBtn');
        await page.waitForTimeout(200);
        assert.equal(await isOpen(page, '#semanticPanel'), false);
        await ctx.close();
    });
} finally {
    await finish();
}
