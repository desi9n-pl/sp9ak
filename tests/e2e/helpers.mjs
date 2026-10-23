/* Shared E2E tooling: server, browser, and stand-ins for SpeechRecognition and /api/ai. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GOOD_KEY = 'sk-ant-good-key-1234';
const PORT = 17900 + Math.floor(Math.random() * 90);
export const BASE = `http://127.0.0.1:${PORT}`;

let server, browser, failures = 0;

export async function start() {
    server = spawn('python3', ['-m', 'server', String(PORT)], {
        cwd: ROOT,
        stdio: 'inherit',
        // tests must never write to the real session history
        env: { ...process.env, SP9AK_SESSIONS: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp9ak-')), 'sessions.json') },
    });
    process.on('exit', () => server.kill());
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(`${BASE}/index.html`)).ok) break; } catch { /* server still starting */ }
        await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
}

export async function finish() {
    await browser?.close();
    server?.kill();
    if (failures) { console.error(`\n${failures} nieudanych`); process.exit(1); }
    console.log('\nWszystkie testy E2E przeszły');
}

export async function check(name, fn) {
    try { await fn(); console.log(`✓ ${name}`); }
    catch (e) { failures++; console.error(`✗ ${name}\n  ${e.message}`); }
}

/* Replaces /api/ai: only GOOD_KEY passes, anything else gets a 401 like the real provider. */
export async function mockAI(page, calls = []) {
    await page.route('**/api/ai', route => {
        const body = JSON.parse(route.request().postData() || '{}');
        calls.push(body);
        if (body.apiKey === GOOD_KEY) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'OK' }) });
        }
        route.fulfill({ status: 500, contentType: 'application/json',
            body: JSON.stringify({ error: 'Claude API 401: invalid x-api-key' }) });
    });
}

/* Each test starts from an empty history; the server keeps sessions between pages. */
async function resetSessions() {
    await fetch(`${BASE}/api/sessions`, { method: 'POST', body: '[]' });
}

/* A page with the settings panel open (no speech stand-in). */
export async function newPage(calls = []) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await mockAI(page, calls);
    await resetSessions();
    page.setDefaultTimeout(5000);
    await page.goto(`${BASE}/index.html`);
    await page.click('#settingsBtn');
    return { page, errors, ctx };
}

/* SpeechRecognition stand-in: start()/stop() fire onstart/onend, and window.__say()
   delivers a recognition result (final or interim) to the app. */
const FAKE_SR = () => {
    class FakeSR {
        constructor() { window.__sr = this; this.results = []; }
        start() {
            if (this.on) throw new DOMException('already started', 'InvalidStateError');
            window.__starts = (window.__starts || 0) + 1;
            this.on = true; this.results = []; setTimeout(() => this.onstart?.(), 0);
            // simulated offline: the engine fails with a network error right away
            if (window.__netDown) setTimeout(() => window.__fail('network'), 30);
        }
        // The real engine ends a moment later and start() throws InvalidStateError until then.
        stop() {
            if (!this.on || this.stopping) return;
            this.stopping = true;
            setTimeout(() => { this.on = false; this.stopping = false; this.onend?.(); }, 250);
        }
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
    window.__fail = (error) => {
        const sr = window.__sr;
        if (!sr?.on) return;
        sr.on = false;
        sr.onerror?.({ error });
        setTimeout(() => sr.onend?.(), 20);
    };
    window.__say = (text, isFinal = true) => {
        const sr = window.__sr;
        if (!sr?.on) return;
        const idx = sr.results.length;
        sr.results.push(Object.assign([{ transcript: text }], { isFinal }));
        sr.onresult({ resultIndex: idx, results: sr.results });
    };
};

/* A page with the speech stand-in and all panels closed. Collects page errors. */
export async function dictPage({ initScripts = [] } = {}) {
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], baseURL: BASE });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(5000);
    await mockAI(page);
    await resetSessions();
    await page.addInitScript(FAKE_SR);
    for (const sc of initScripts) await page.addInitScript(sc);
    await page.goto(`${BASE}/index.html`);
    return { page, errors, ctx };
}

export const toggleDictation = async page => {
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(400);
};
