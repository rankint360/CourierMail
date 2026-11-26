import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
for (const dir of ['secrets', 'tls', 'caddy-data', 'backups']) await mkdir(dir, { recursive: true, mode: 0o700 });
async function create(path, content) {
  try { await writeFile(path, content, { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
await create('.env', await readFile('.env.example', 'utf8'));
await create('secrets/app_secret', randomBytes(48).toString('hex'));
await create('secrets/mail_admin_token', 'UNCONFIGURED');
console.log(`Prepared ${resolve('.')}. Edit .env and replace the mail token after private Stalwart setup. Existing keys were preserved.`);
