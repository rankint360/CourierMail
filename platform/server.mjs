import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createStore } from './store.mjs';
import { createPlatform } from './api.mjs';
import { loadSecrets } from './secrets.mjs';

const production = process.env.NODE_ENV === 'production';
const dataDir = resolve(process.env.DATA_DIR || '.data');
await mkdir(dataDir, { recursive: true });
const configured = await loadSecrets();
let secret = configured.APP_SECRET;
if (!secret && !production) {
  const file = resolve(dataDir, 'app-secret');
  try { secret = await readFile(file, 'utf8'); }
  catch { secret = randomBytes(32).toString('hex'); await writeFile(file, secret, { mode: 0o600 }); }
}
const env = { ...configured, APP_SECRET: secret, ALLOW_REGISTRATION: configured.ALLOW_REGISTRATION || (production ? 'false' : 'true') };
const store = createStore(resolve(dataDir, 'courier.sqlite'));
const platform = createPlatform(store, env);
if (!production) await import('../build.mjs');
const { default: worker } = await import('../dist/server/index.js');
const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) { res.writeHead(413); res.end('Request too large'); req.destroy(); return; } chunks.push(chunk); }
    const body = Buffer.concat(chunks);
    const publicOrigin = env.APP_ORIGIN || (env.RENDER_EXTERNAL_URL ? env.RENDER_EXTERNAL_URL : `http://127.0.0.1:${port}`);
    const headers = new Headers(Object.entries(req.headers).filter(([, v]) => typeof v === 'string'));
    // Browser identity comes from Zavrill sessions. Proxy identity headers are ignored here.
    headers.delete('oai-authenticated-user-id');
    const request = new Request(new URL(req.url, publicOrigin), { method: req.method, headers, ...(body.length ? { body, duplex: 'half' } : {}) });
    let response;
    if (req.url === '/healthz') response = Response.json({ status: 'ok', database: Boolean(store.one('SELECT 1 AS ok').ok) });
    else if (new URL(request.url).pathname.startsWith('/api/platform/')) response = await platform.handle(request);
    else {
      const pathname = new URL(request.url).pathname;
      const context = pathname.startsWith('/api/') ? await platform.mailEnvironment(request) : null;
      if (production && pathname.startsWith('/api/') && pathname !== '/api/config' && !context) response = Response.json({ error: 'Sign in to your business mailbox first.' }, { status: 401 });
      else response = await worker.fetch(request, { ...env, ...(production ? { FASTMAIL_API_TOKEN: undefined } : {}), ...(context || {}), LOCAL_DEVELOPMENT: 'true' });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (failure) {
    console.error('Request failed', failure.name);
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The request could not finish.' }));
  }
});
server.requestTimeout = 60000;
server.listen(port, production ? '0.0.0.0' : '127.0.0.1', () => console.log(`Zavrill: http://127.0.0.1:${port}\nBusiness Admin: http://127.0.0.1:${port}/admin`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
