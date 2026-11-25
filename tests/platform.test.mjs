import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../platform/store.mjs';
import { createPlatform } from '../platform/api.mjs';
import { seal, unseal } from '../platform/security.mjs';
import { createMailHost } from '../platform/stalwart.mjs';

const origin = 'https://courier.test';
const secret = 'a-long-test-only-secret-that-is-more-than-32-characters';
function setup() {
  const store = createStore(':memory:');
  let domainRecord;
  const hostCalls = [];
  const host = { configured: true,
    async ensureDomain(d) { hostCalls.push(['domain', d.name]); return 'provider-domain'; },
    async domainInfo() { return { dnsZoneFile: 'selector._domainkey IN TXT "v=DKIM1; p=public"' }; },
    async ensureMailbox(m, d, password) { hostCalls.push(['mailbox', m.email, d]); assert.ok(password.length >= 12); return 'provider-mailbox'; },
    async updateMailbox(id, changes) { hostCalls.push(['update', id, changes]); },
    async verifyMailbox(email) { return `Basic ${Buffer.from(email + ':password').toString('base64')}`; },
  };
  const env = { APP_SECRET: secret, ALLOW_REGISTRATION: 'true', MAIL_SERVER_URL: 'https://mail.example.com', MAIL_HOSTNAME: 'mail.example.com' };
  const dns = { async resolveTxt(name) { if (name.startsWith('_courier.')) return [[`courier-verification=${domainRecord?.token || 'wrong'}`]]; if (name.startsWith('_dmarc.')) return [['v=DMARC1; p=none']]; return [['v=spf1 mx -all']]; }, async resolveMx() { return [{ exchange: 'mail.example.com', priority: 10 }]; } };
  const app = createPlatform(store, env, { host, dns });
  async function request(path, body, cookie, customOrigin = origin) {
    return app.handle(new Request(origin + '/api/platform/' + path, { ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}), headers: { Origin: customOrigin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } }));
  }
  async function register(email = 'owner@example.com') {
    const response = await request('register', { email, password: 'a-strong-password-123', name: 'Test Owner', business: 'Example Studio' });
    assert.equal(response.status, 200); return response.headers.get('Set-Cookie').split(';')[0];
  }
  async function addDomain(cookie, name = 'example.com') { const response = await request('domains', { name }, cookie); assert.equal(response.status, 201); domainRecord = await response.json(); return domainRecord; }
  return { store, app, request, register, addDomain, hostCalls };
}
test('business registration stores a scrypt hash and sets a protected session cookie', async t => {
  const s = setup(); t.after(() => s.store.close()); const cookie = await s.register();
  const user = s.store.one('SELECT * FROM users'); assert.ok(user.password_hash.startsWith('scrypt:')); assert.equal(user.role, 'owner');
  assert.ok(s.app.authenticate(new Request(origin, { headers: { cookie } })));
  assert.equal((await s.request('session', undefined, cookie)).status, 200);
});
test('unauthenticated and cross-origin changes are rejected', async t => {
  const s = setup(); t.after(() => s.store.close());
  assert.equal((await s.request('domains', { name: 'example.com' })).status, 401);
  const cookie = await s.register();
  assert.equal((await s.request('domains', { name: 'example.com' }, cookie, 'https://evil.example')).status, 403);
});
test('tenant cannot read or mutate another tenant domain', async t => {
  const s = setup(); t.after(() => s.store.close()); const a = await s.register(); const domain = await s.addDomain(a);
  const b = await s.register('second@example.com');
  assert.equal((await s.request('verify-domain', { id: domain.id }, b)).status, 404);
  assert.equal((await (await s.request('overview', undefined, b)).json()).domains.length, 0);
});
test('domain ownership verification gates mail hosting activation', async t => {
  const s = setup(); t.after(() => s.store.close()); const cookie = await s.register(); const domain = await s.addDomain(cookie);
  assert.equal((await s.request('activate-domain', { id: domain.id }, cookie)).status, 409);
  const checks = await (await s.request('verify-domain', { id: domain.id }, cookie)).json(); assert.equal(checks.ownership, true);
  assert.equal((await s.request('activate-domain', { id: domain.id }, cookie)).status, 200);
  assert.equal(s.store.one('SELECT status FROM domains').status, 'active');
});
test('mailbox creation and mailbox sessions stay scoped to assigned members', async t => {
  const s = setup(); t.after(() => s.store.close()); const cookie = await s.register(); const domain = await s.addDomain(cookie);
  await s.request('verify-domain', { id: domain.id }, cookie); await s.request('activate-domain', { id: domain.id }, cookie);
  const box = await (await s.request('mailboxes', { domainId: domain.id, local: 'hello', name: 'Hello', password: 'mailbox-password-123' }, cookie)).json();
  assert.equal(box.status, 'active'); assert.equal(box.email, 'hello@example.com');
  assert.equal((await s.request('mail-login', { mailboxId: box.id, password: 'mailbox-password-123' }, cookie)).status, 200);
  const context = await s.app.mailEnvironment(new Request(origin, { headers: { cookie } }));
  assert.ok(context.MAIL_AUTHORIZATION.startsWith('Basic '));
  assert.ok(!s.store.one('SELECT mail_auth FROM sessions').mail_auth.includes('Basic'));
  await s.request('update-mailbox', { id: box.id, suspended: true }, cookie);
  assert.equal(await s.app.mailEnvironment(new Request(origin, { headers: { cookie } })), null);
});
test('invitation is accepted once and members cannot administer domains', async t => {
  const s = setup(); t.after(() => s.store.close()); const cookie = await s.register();
  const invite = await (await s.request('invite', { email: 'member@example.com', role: 'member' }, cookie)).json();
  const body = { token: new URL(invite.inviteUrl).searchParams.get('invite'), name: 'Member', password: 'member-password-123' };
  const accepted = await s.request('accept-invite', body); assert.equal(accepted.status, 200);
  const memberCookie = accepted.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await s.request('domains', { name: 'other.example' }, memberCookie)).status, 403);
  assert.equal((await s.request('accept-invite', body)).status, 409);
});
test('password change revokes other sessions and logout revokes the current one', async t => {
  const s = setup(); t.after(() => s.store.close()); const cookie = await s.register();
  const login = await s.request('login', { email: 'owner@example.com', password: 'a-strong-password-123' });
  const other = login.headers.get('Set-Cookie').split(';')[0];
  const changed = await s.request('password', { currentPassword: 'a-strong-password-123', password: 'new-password-45678' }, cookie); assert.equal(changed.status, 200);
  assert.equal(s.app.authenticate(new Request(origin, { headers: { cookie: other } })), undefined);
  const fresh = changed.headers.get('Set-Cookie').split(';')[0]; await s.request('logout', {}, fresh);
  assert.equal(s.app.authenticate(new Request(origin, { headers: { cookie: fresh } })), undefined);
});
test('encrypted credentials reject tampering and require the correct server secret', () => {
  const encrypted = seal('Basic hidden-value', secret); assert.equal(unseal(encrypted, secret), 'Basic hidden-value');
  assert.throws(() => unseal(encrypted, secret + 'other'));
});
test('mail hosting adapter uses Stalwart v1 methods and recovers existing objects', async () => {
  const calls = [];
  const host = createMailHost({ MAIL_SERVER_URL: 'https://mail.example.com', MAIL_ADMIN_TOKEN: 'test-token' }, async (url, options) => {
    assert.equal(url.origin, 'https://mail.example.com'); const body = JSON.parse(options.body); const [method, args] = body.methodCalls[0]; calls.push([method, args]);
    return Response.json({ methodResponses: [[method, method === 'x:Domain/query' ? { ids: ['existing'] } : { list: [{ id: 'existing', name: 'example.com' }] }, 'request']] });
  });
  assert.equal(await host.ensureDomain({ name: 'example.com' }), 'existing'); assert.equal(calls.length, 2);
});
test('mail hosting account credentials and aliases use Stalwart object encoding', async () => {
  let created;
  const host = createMailHost({ MAIL_SERVER_URL: 'https://mail.example.com', MAIL_ADMIN_TOKEN: 'test-token' }, async (url, options) => {
    const [method, args] = JSON.parse(options.body).methodCalls[0];
    if (method === 'x:Account/set') created = args.create.account;
    return Response.json({ methodResponses: [[method, method === 'x:Account/query' ? { ids: [] } : { created: { account: { id: 'mailbox' } } }, 'request']] });
  });
  await host.ensureMailbox({ email: 'hello@example.com', display_name: 'Hello', quota_bytes: 1024 }, 'domain', 'password-12345');
  assert.equal(Array.isArray(created.credentials), false); assert.equal(created.credentials['0']['@type'], 'Password'); assert.deepEqual(created.aliases, {});
});
