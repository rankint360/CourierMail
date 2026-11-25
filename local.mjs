import http from 'node:http';
import { readFile } from 'node:fs/promises';
await import('./build.mjs');
const { default: worker } = await import('./dist/server/index.js');
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, ...(body.length ? { body, duplex: 'half' } : {}) });
    const response = await worker.fetch(request, { ...process.env, LOCAL_DEVELOPMENT: 'true' });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Request failed'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
