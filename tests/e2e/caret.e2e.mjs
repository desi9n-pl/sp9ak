/* E2E: the thick caret drawn over the text field must sit exactly where Chrome's own caret is,
   whatever the text, and must give the field back its native caret when it cannot keep up. */
import assert from 'node:assert/strict';
import { start, finish, check, dictPage, toggleDictation } from './helpers.mjs';

/* The native caret drawn red and steady, the bar hidden but still positioned, so both can be compared. */
const SHOW_NATIVE = `
    textarea.has-thick-caret { caret-color: #ff0000 !important; caret-animation: manual !important; }
    .thick-caret { visibility: hidden; }`;

/* Where Chrome draws its caret: the red pixels in a screenshot of the field, decoded in the page. */
async function nativeCaret(page) {
    const box = await page.locator('#output').boundingBox();
    const png = (await page.screenshot({ caret: 'initial', clip: box })).toString('base64');
    const found = await page.evaluate(async b64 => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, img.width, img.height);
        let left = Infinity, right = -1, top = Infinity, bottom = -1;
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const i = (y * img.width + x) * 4;
                if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] < 80) {
                    left = Math.min(left, x); right = Math.max(right, x);
                    top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
            }
        }
        return right < 0 ? null : { x: (left + right + 1) / 2, top, bottom: bottom + 1 };
    }, png);
    return found && { x: box.x + found.x, top: box.y + found.top, bottom: box.y + found.bottom };
}

const bar = page => page.evaluate(() => {
    const el = document.querySelector('.thick-caret');
    const box = el.getBoundingClientRect();
    return { hidden: el.hidden, x: box.left + box.width / 2, top: box.top, bottom: box.bottom, width: box.width };
});

/* Waits for the bar to be measured (once per frame) and compares it with the native caret. */
async function assertAligned(page, label) {
    await page.waitForTimeout(100);
    const native = await nativeCaret(page);
    const drawn = await bar(page);
    assert.ok(native, `${label}: no native caret on screen`);
    assert.equal(drawn.hidden, false, `${label}: bar hidden`);
    const where = `${label}: native x=${native.x} y=${native.top}-${native.bottom}, bar x=${drawn.x} y=${drawn.top}-${drawn.bottom}`;
    assert.ok(Math.abs(native.x - drawn.x) <= 1.5, where);
    assert.ok(drawn.top <= native.top + 2 && drawn.bottom >= native.bottom - 2, where);
}

async function caretPage() {
    const { page, errors, ctx } = await dictPage();
    await page.setViewportSize({ width: 520, height: 640 });
    await page.click('#typeBtn');
    await page.addStyleTag({ content: SHOW_NATIVE });
    return { page, errors, ctx };
}

const setText = (page, text, position = text.length) => page.evaluate(([t, p]) => {
    const field = document.getElementById('output');
    field.value = t;
    field.focus();
    field.setSelectionRange(p, p);
}, [text, position]);

const WRAPPING = 'Ala ma kota, a kot ma Alę. To jest dłuższe zdanie, które powinno się zawinąć do następnej linii w polu tekstowym.';
const LINES = Array.from({ length: 80 }, (_, i) => `linia ${i}`).join('\n');

await start();
try {
    await check('caret: the bar sits on the native caret for all kinds of text', async () => {
        const { page, errors, ctx } = await caretPage();
        const cases = [
            ['empty field', '', 0],
            ['Polish letters', 'Zażółć gęślą jaźń', 8],
            ['before the space where a line wraps', WRAPPING, WRAPPING.indexOf('powinno') - 1],
            ['at the start of a wrapped word', WRAPPING, WRAPPING.indexOf('powinno')],
            ['end of a wrapped text', WRAPPING, WRAPPING.length],
            ['after a trailing newline', 'abc\n', 4],
            ['on an empty line', 'abc\n\n\ndef', 5],
            ['after tabs and repeated spaces', 'a\tb    c', 6],
            ['inside a word longer than the line', 'x'.repeat(200), 120],
            ['after emoji', 'mikrofon 🎤🎤 tekst', 12],
        ];
        for (const [label, text, position] of cases) {
            await setText(page, text, position);
            await assertAligned(page, label);
        }
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('caret: follows typing, Enter, arrows and a scrolled field; hides on selection and blur', async () => {
        const { page, errors, ctx } = await caretPage();
        await page.keyboard.type('Ala ma kota');
        await assertAligned(page, 'typed');
        await page.keyboard.press('Enter');
        await assertAligned(page, 'Enter');
        await page.keyboard.type('druga linia');
        await page.keyboard.press('ArrowUp');
        await assertAligned(page, 'ArrowUp');
        await page.keyboard.press('Home');
        await assertAligned(page, 'Home');

        await page.keyboard.press('Shift+ArrowRight');
        await page.waitForTimeout(100);
        assert.equal((await bar(page)).hidden, true, 'selection');
        await page.keyboard.press('ArrowRight');

        await setText(page, LINES);
        await page.evaluate(() => { const f = document.getElementById('output'); f.scrollTop = f.scrollHeight; });
        await assertAligned(page, 'end of a scrolled text');
        await page.keyboard.press('Control+Home');
        await assertAligned(page, 'back to the top');
        await page.evaluate(() => { const f = document.getElementById('output'); f.scrollTop = f.scrollHeight; });
        await page.waitForTimeout(100);
        assert.equal((await bar(page)).hidden, true, 'caret scrolled out of view');

        await page.evaluate(() => document.getElementById('output').blur());
        await page.waitForTimeout(100);
        assert.equal((await bar(page)).hidden, true, 'blur');
        assert.ok((await bar(page)).width >= 2);
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('caret: a narrower window re-wraps the text and the bar follows', async () => {
        const { page, errors, ctx } = await caretPage();
        await setText(page, WRAPPING);
        await assertAligned(page, 'wide');
        await page.setViewportSize({ width: 360, height: 640 });
        await assertAligned(page, 'narrow');
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('caret: follows text inserted by dictation, interim and final', async () => {
        const { page, errors, ctx } = await caretPage();
        await page.keyboard.type('Początek ');
        await toggleDictation(page);
        await page.evaluate(() => window.__say('to jest wynik', false));
        await assertAligned(page, 'interim result');
        await page.evaluate(() => window.__say('to jest wynik ostateczny i dość długi, żeby zawinąć się w polu tekstowym'));
        await assertAligned(page, 'final result');
        await toggleDictation(page);
        await assertAligned(page, 'after dictation');
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('caret: a very long text gets the native caret back, a shorter one the bar again', async () => {
        const { page, errors, ctx } = await caretPage();
        await setText(page, 'słowo zdanie '.repeat(2000));
        await page.waitForTimeout(100);
        assert.equal((await bar(page)).hidden, true);
        assert.equal(await page.evaluate(() => document.getElementById('output').classList.contains('has-thick-caret')), false);
        await setText(page, 'krótki tekst');
        await assertAligned(page, 'short again');
        assert.deepEqual(errors, []);
        await ctx.close();
    });

    await check('caret: the hidden copy of the text does not make the page scroll', async () => {
        const { page, ctx } = await caretPage();
        await setText(page, 'słowo zdanie '.repeat(1500));
        await page.waitForTimeout(100);
        const page_ = await page.evaluate(() => {
            const root = document.scrollingElement;
            return { tall: root.scrollHeight > root.clientHeight, wide: root.scrollWidth > root.clientWidth };
        });
        assert.deepEqual(page_, { tall: false, wide: false });
        await ctx.close();
    });
} finally {
    await finish();
}
