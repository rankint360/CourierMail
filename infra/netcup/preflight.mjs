import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const entries = (await readFile('.env', 'utf8')).split(/\r?\n/).filter(s => s.trim() && !s.trim().startsWith('#')).map(s => { const i = s.indexOf('='); return [s.slice(0,i).trim(), s.slice(i+1).trim()]; });
const env = Object.fromEntries(entries);
for (const key of ['APP_HOSTNAME', 'MAIL_HOSTNAME']) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(env[key] || '') || /(^|\.)example\.(com|org|net)$/.test(env[key])) throw new Error(`Set a real ${key} in .env.`);
}
if (env.APP_HOSTNAME === env.MAIL_HOSTNAME) throw new Error('App and mail hostnames must differ.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ACME_EMAIL || '') || env.ACME_EMAIL.endsWith('@example.com')) throw new Error('Set a real ACME_EMAIL.');
if (!['mail_offline', 'mail_ready'].includes(env.MAIL_ROUTE)) throw new Error('Invalid MAIL_ROUTE.');
if (!['true', 'false'].includes(env.ALLOW_REGISTRATION)) throw new Error('Invalid ALLOW_REGISTRATION.');
if ((await readFile('secrets/app_secret', 'utf8')).trim().length < 32) throw new Error('APP_SECRET must contain at least 32 characters.');
const token = (await readFile('secrets/mail_admin_token', 'utf8')).trim();
if (!token || (env.MAIL_ROUTE === 'mail_ready' && token === 'UNCONFIGURED')) throw new Error('Configure the Stalwart management token before opening mail.');
const result = spawnSync('docker', ['compose', 'config', '--quiet'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status) process.exit(result.status);
console.log('Configuration checks passed. DNS, mail ports, certificates, relay restrictions, and external delivery still need live verification.');
