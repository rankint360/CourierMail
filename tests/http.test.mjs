import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { once } from 'node:events';

test('production HTTP entrypoint serves the app and business API with persistent sessions', async t => {
  const project = resolve(import.meta.dirname, '..');
  await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: project });
  const dataDir = await mkdtemp(join(tmpdir(), 'courier-http-'));
  const origin = 'http://127.0.0.1:4189';
  const child = spawn(process.execPath, ['platform/server.mjs'], { cwd: project, env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, APP_SECRET: 'http-test-secret-for-courier-more-than-32-characters', APP_ORIGIN: origin, PORT: '4189', ALLOW_REGISTRATION: 'true', FASTMAIL_API_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    const closed = once(child, 'exit'); child.kill(); await closed;
    if (!dataDir.startsWith(join(tmpdir(), 'courier-http-'))) throw new Error('Unexpected test directory.');
    await rm(dataDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { ready = (await fetch(origin + '/healthz')).ok; if (ready) break; } catch { /* Wait for the owned test server. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(ready, true);
  for (const path of ['/', '/admin', '/admin.js', '/admin.css', '/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png', '/design-system', '/design-tokens.css', '/design-system.css', '/design-system.js', '/brand/mark.svg', '/brand/mark-inverse.svg', '/brand/mark-mono.svg', '/brand/wordmark.svg', '/brand/wordmark-inverse.svg']) assert.equal((await fetch(origin + path)).status, 200, path);
  assert.equal((await fetch(origin + '/favicon.ico')).headers.get('Content-Type'), 'image/x-icon');
  assert.equal((await fetch(origin + '/apple-touch-icon.png')).headers.get('Content-Type'), 'image/png');
  const manifest = await (await fetch(origin + '/manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone');
  assert.equal((await fetch(origin + '/api/messages')).status, 401);
  const response = await fetch(origin + '/api/platform/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'HTTP Test', business: 'HTTP Test Studio', email: 'http-test@example.com', password: 'http-test-password-123' }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('Set-Cookie').split(';')[0];
  assert.ok(response.headers.get('Set-Cookie').includes('HttpOnly'));
  const overview = await (await fetch(origin + '/api/platform/overview', { headers: { cookie } })).json();
  assert.equal(overview.organization.name, 'HTTP Test Studio');
  assert.equal(overview.mailboxes.length, 0);
  assert.equal((await fetch(origin + '/api/platform/domains', { method: 'POST', headers: { cookie, Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'example.com' }) })).status, 403);
});
