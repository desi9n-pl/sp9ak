/* Starts the app server for the quality audits (pa11y, Lighthouse) and stops it again. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

export async function startServer() {
    const port = 17900 + Math.floor(Math.random() * 90);
    const server = spawn('python3', ['-m', 'server', String(port)], {
        cwd: ROOT,
        stdio: 'inherit',
        // audits must never write to the real session history
        env: { ...process.env, SP9AK_SESSIONS: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp9ak-')), 'sessions.json') },
    });
    process.on('exit', () => server.kill());
    const url = `http://127.0.0.1:${port}/index.html`;
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(url)).ok) break; } catch { /* server still starting */ }
        await new Promise(r => setTimeout(r, 100));
    }
    return { url, stop: () => server.kill() };
}
