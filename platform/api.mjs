import { randomUUID } from 'node:crypto';
import { resolveTxt, resolveMx } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import { hashPassword, verifyPassword, digest, token, seal, unseal, rateLimit } from './security.mjs';
import { createMailHost } from './stalwart.mjs';

const now = () => new Date().toISOString();
const error = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const publicUser = user => ({ id: user.id, orgId: user.org_id, email: user.email, name: user.name, role: user.role });
const validEmail = value => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
function domainName(value) {
  const name = domainToASCII(String(value || '').trim().toLowerCase());
  if (name.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name)) error('Enter a valid domain name.');
  return name;
}
export function createPlatform(store, env, dependencies = {}) {
  if (!env.APP_SECRET || env.APP_SECRET.length < 32) throw new Error('Set APP_SECRET to at least 32 characters.');
  const host = dependencies.host || createMailHost(env);
  const dns = dependencies.dns || { resolveTxt, resolveMx };
  const sessionCookie = 'courier_session';
  function cookie(request, value, age = 604800) { return `${sessionCookie}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
  function audit(user, action, resource) { store.run('INSERT INTO audit(id,org_id,user_id,action,resource,created_at) VALUES(?,?,?,?,?,?)', randomUUID(), user.org_id, user.id, action, resource, now()); }
  async function exclusive(resource, operation) {
    const acquired = store.one('INSERT INTO leases(resource,expires) VALUES(?,?) ON CONFLICT(resource) DO UPDATE SET expires=excluded.expires WHERE expires<? RETURNING resource', resource, Date.now() + 120000, Date.now());
    if (!acquired) error('This resource is being updated. Wait a moment and try again.', 409);
    try { return await operation(); }
    finally { store.run('DELETE FROM leases WHERE resource=?', resource); }
  }
  function authenticate(request) {
    const value = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
    if (!value) return null;
    return store.one('SELECT u.*, s.hash AS session_hash, s.mail_auth, s.mailbox_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.active=1', digest(value), Date.now());
  }
  function admin(user) { if (!['owner', 'admin'].includes(user.role)) error('Business administrator access is required.', 403); }
  function owned(table, id, user) {
    const item = store.one(`SELECT * FROM ${table} WHERE id=? AND org_id=?`, id, user.org_id);
    if (!item) error('This item is unavailable.', 404);
    return item;
  }
  function newSession(request, user) {
    const value = token();
    store.run('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)', digest(value), user.id, Date.now() + 604800000);
    store.run('DELETE FROM sessions WHERE expires<?', Date.now());
    return json({ user: publicUser(user) }, 200, { 'Set-Cookie': cookie(request, value) });
  }
  async function checkDomain(domain) {
    const records = await Promise.allSettled([dns.resolveTxt(`_courier.${domain.name}`), dns.resolveMx(domain.name), dns.resolveTxt(domain.name), dns.resolveTxt(`_dmarc.${domain.name}`)]);
    const values = index => records[index].status === 'fulfilled' ? records[index].value : [];
    const ownership = values(0).some(parts => parts.join('') === `courier-verification=${domain.token}`);
    const mx = values(1).map(x => x.exchange.toLowerCase().replace(/\.$/, ''));
    const expected = (env.MAIL_HOSTNAME || '').toLowerCase();
    const spf = values(2).map(x => x.join('')).filter(x => x.startsWith('v=spf1'));
    const dmarc = values(3).map(x => x.join('')).some(x => x.startsWith('v=DMARC1;'));
    return { ownership, mx: expected ? mx.includes(expected) : false, spf: spf.length === 1, dmarc, checkedAt: now(), mxRecords: mx };
  }
  async function provisionDomain(domain, user) {
    if (!domain.verified_at) error('Verify domain ownership before activating hosting.', 409);
    try {
      const id = domain.provider_id || await host.ensureDomain(domain);
      const info = await host.domainInfo(id);
      const saved = JSON.parse(domain.dns_json);
      store.run('UPDATE domains SET provider_id=?,status=?,error=NULL,dns_json=? WHERE id=?', id, 'active', JSON.stringify({ ...saved, providerZone: info?.dnsZoneFile || '' }), domain.id);
      audit(user, 'domain.activated', domain.name);
    } catch (failure) { store.run('UPDATE domains SET status=?,error=? WHERE id=?', 'error', failure.message, domain.id); throw failure; }
  }
  async function provisionMailbox(mailbox, domain, password, user) {
    if (!password || password.length < 12 || password.length > 256) error('Use a mailbox password between 12 and 256 characters.');
    if (domain.status !== 'active' || !domain.provider_id) error('Activate this domain on the mail server first.', 409);
    store.run('UPDATE mailboxes SET status=?,error=NULL WHERE id=?', 'provisioning', mailbox.id);
    try {
      const id = await host.ensureMailbox(mailbox, domain.provider_id, password);
      store.run('UPDATE mailboxes SET provider_id=?,status=?,error=NULL WHERE id=?', id, 'active', mailbox.id);
      audit(user, 'mailbox.activated', mailbox.email);
    } catch (failure) { store.run('UPDATE mailboxes SET status=?,error=? WHERE id=?', 'error', failure.message, mailbox.id); throw failure; }
  }
  return {
    authenticate,
    async mailEnvironment(request) {
      const user = authenticate(request);
      if (!user?.mail_auth || !user.mailbox_id) return null;
      const mailbox = owned('mailboxes', user.mailbox_id, user);
      if (mailbox.status !== 'active' || mailbox.user_id !== user.id) return null;
      return { MAIL_SESSION_URL: new URL('/.well-known/jmap', env.MAIL_SERVER_URL).href, MAIL_AUTHORIZATION: unseal(user.mail_auth, env.APP_SECRET), MAIL_TRUSTED_ORIGIN: new URL(env.MAIL_SERVER_URL).origin };
    },
    async handle(request) {
      const url = new URL(request.url);
      const route = url.pathname.replace('/api/platform', '');
      try {
        if (request.method !== 'GET') {
          if (request.headers.get('Origin') !== url.origin) error('Invalid request origin.', 403);
          if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) error('Use JSON request bodies.', 415);
        }
        if (route === '/config') return json({ available: true, mailHosting: host.configured, registration: env.ALLOW_REGISTRATION === 'true', mailHostname: env.MAIL_HOSTNAME || '', desktopMobile: 'pwa' });
        const user = authenticate(request);
        if (route === '/session' && request.method === 'GET') return json({ user: user ? publicUser(user) : null, mailConnected: Boolean(user?.mail_auth) });
        const body = request.method === 'GET' ? {} : await request.json();
        if (route === '/register' && request.method === 'POST') {
          if (env.ALLOW_REGISTRATION !== 'true') error('Business registration is disabled on this deployment.', 403);
          const email = String(body.email || '').trim().toLowerCase();
          if (!validEmail(email) || !String(body.name || '').trim() || !String(body.business || '').trim()) error('Enter your name, business name, and email address.');
          rateLimit(store, 'register:' + (request.headers.get('x-forwarded-for') || 'local'), 5, 3600);
          const passwordHash = await hashPassword(body.password);
          const orgId = randomUUID(); const id = randomUUID();
          try {
            store.transaction(() => {
              store.run('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)', orgId, body.business.trim().slice(0, 100), now());
              store.run('INSERT INTO users(id,org_id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)', id, orgId, email, body.name.trim().slice(0, 100), passwordHash, 'owner', now());
            });
          } catch (failure) { if (failure.code?.includes('CONSTRAINT')) error('An account with this email already exists.', 409); throw failure; }
          const created = store.one('SELECT * FROM users WHERE id=?', id); audit(created, 'business.created', orgId);
          return newSession(request, created);
        }
        if (route === '/login' && request.method === 'POST') {
          const email = String(body.email || '').trim().toLowerCase();
          rateLimit(store, `login:${email}`, 10);
          const found = store.one('SELECT * FROM users WHERE email=? AND active=1', email);
          const dummy = 'scrypt:00000000000000000000000000000000:' + '0'.repeat(128);
          const valid = await verifyPassword(body.password, found?.password_hash || dummy);
          if (!found || !valid) error('Email or password is incorrect.', 401);
          audit(found, 'session.created', found.id); return newSession(request, found);
        }
        if (route === '/accept-invite' && request.method === 'POST') {
          rateLimit(store, 'invite:' + (request.headers.get('x-forwarded-for') || 'local'), 10);
          const invitation = store.one('SELECT * FROM invitations WHERE token_hash=? AND expires>? AND used_at IS NULL', digest(String(body.token || '')), Date.now());
          if (!invitation) error('This invitation has expired or was already used.', 409);
          const passwordHash = await hashPassword(body.password);
          const id = randomUUID();
          if (!String(body.name || '').trim()) error('Enter your name.');
          store.transaction(() => {
            const claimed = store.run('UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL', now(), invitation.id);
            if (!claimed.changes) error('This invitation was already used.', 409);
            store.run('INSERT INTO users(id,org_id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)', id, invitation.org_id, invitation.email, body.name.trim().slice(0, 100), passwordHash, invitation.role, now());
          });
          return newSession(request, store.one('SELECT * FROM users WHERE id=?', id));
        }
        if (!user) error('Sign in to continue.', 401);
        if (route === '/logout' && request.method === 'POST') { store.run('DELETE FROM sessions WHERE hash=?', user.session_hash); return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) }); }
        if (route === '/password' && request.method === 'POST') {
          rateLimit(store, 'password:' + user.id, 5);
          if (!await verifyPassword(body.currentPassword, user.password_hash)) error('Current password is incorrect.', 401);
          const passwordHash = await hashPassword(body.password);
          store.transaction(() => { store.run('UPDATE users SET password_hash=? WHERE id=?', passwordHash, user.id); store.run('DELETE FROM sessions WHERE user_id=?', user.id); });
          audit(user, 'password.changed', user.id); return newSession(request, user);
        }
        if (route === '/overview' && request.method === 'GET') {
          const org = store.one('SELECT * FROM organizations WHERE id=?', user.org_id);
          const boxes = store.all('SELECT id,email,display_name,status,quota_bytes,user_id,error,aliases_json FROM mailboxes WHERE org_id=?' + (user.role === 'member' ? ' AND user_id=?' : ''), ...[user.org_id, ...(user.role === 'member' ? [user.id] : [])]);
          return json({ organization: org, user: publicUser(user), domains: user.role === 'member' ? [] : store.all('SELECT * FROM domains WHERE org_id=? ORDER BY created_at DESC', user.org_id), mailboxes: boxes, users: user.role === 'member' ? [publicUser(user)] : store.all('SELECT id,email,name,role,active FROM users WHERE org_id=?', user.org_id), audit: user.role === 'member' ? [] : store.all('SELECT action,resource,created_at FROM audit WHERE org_id=? ORDER BY created_at DESC LIMIT 100', user.org_id), infrastructure: { configured: host.configured, hostname: env.MAIL_HOSTNAME || '', render: Boolean(env.RENDER), smtp: 'Requires a mail-capable server outside Render', application: 'Ready' } });
        }
        if (route === '/mail-login' && request.method === 'POST') {
          rateLimit(store, 'mail-login:' + user.id, 10);
          const mailbox = owned('mailboxes', body.mailboxId, user);
          if (mailbox.user_id !== user.id || mailbox.status !== 'active') error('This mailbox must be active and assigned to you.', 403);
          const authorization = await host.verifyMailbox(mailbox.email, String(body.password || ''));
          store.run('UPDATE sessions SET mail_auth=?,mailbox_id=? WHERE hash=?', seal(authorization, env.APP_SECRET), mailbox.id, user.session_hash);
          audit(user, 'mailbox.signed-in', mailbox.email); return json({ ok: true });
        }
        admin(user);
        if (route === '/branding' && request.method === 'POST') {
          const brand = String(body.brand || '').trim().slice(0, 60);
          if (!brand || !/^#[0-9a-f]{6}$/i.test(body.color)) error('Enter a brand name and hex color.');
          store.run('UPDATE organizations SET brand=?,color=? WHERE id=?', brand, body.color, user.org_id); audit(user, 'branding.updated', brand); return json({ ok: true });
        }
        if (route === '/domains' && request.method === 'POST') {
          rateLimit(store, 'domain:' + user.org_id, 20, 3600);
          const name = domainName(body.name); const id = randomUUID();
          try { store.run('INSERT INTO domains(id,org_id,name,token,created_at) VALUES(?,?,?,?,?)', id, user.org_id, name, token(), now()); }
          catch (failure) { if (failure.code?.includes('CONSTRAINT')) error('This domain is already registered.', 409); throw failure; }
          audit(user, 'domain.added', name); return json(owned('domains', id, user), 201);
        }
        if (route === '/verify-domain' && request.method === 'POST') {
          const domain = owned('domains', body.id, user);
          rateLimit(store, 'dns:' + domain.id, 20, 3600);
          const checks = await checkDomain(domain);
          store.run('UPDATE domains SET verified_at=?,dns_json=? WHERE id=?', checks.ownership ? domain.verified_at || now() : null, JSON.stringify({ ...JSON.parse(domain.dns_json), ...checks }), domain.id);
          audit(user, 'domain.dns-checked', domain.name); return json(checks);
        }
        if (route === '/activate-domain' && request.method === 'POST') {
          await exclusive('domain:' + body.id, () => provisionDomain(owned('domains', body.id, user), user)); return json({ ok: true });
        }
        if (route === '/mailboxes' && request.method === 'POST') {
          const domain = owned('domains', body.domainId, user);
          const local = String(body.local || '').toLowerCase();
          if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(local)) error('Use a mailbox name containing letters, numbers, dots, underscores, or hyphens.');
          const quota = Number(body.quotaGB || 5); if (!Number.isFinite(quota) || quota < 1 || quota > 100) error('Choose a quota from 1 to 100 GB.');
          const assigned = store.one('SELECT id FROM users WHERE id=? AND org_id=? AND active=1', body.userId || user.id, user.org_id);
          if (!assigned) error('Select an active team member.');
          if (!domain.verified_at) error('Verify the domain before creating mailboxes.', 409);
          const id = randomUUID();
          try {
            store.transaction(() => {
              if (store.one('SELECT count(*) AS n FROM mailboxes WHERE org_id=?', user.org_id).n >= Number(env.MAX_MAILBOXES_PER_ORG || 25)) error('This organization has reached its mailbox limit.', 409);
              store.run('INSERT INTO mailboxes(id,org_id,domain_id,user_id,email,display_name,quota_bytes,created_at) VALUES(?,?,?,?,?,?,?,?)', id, user.org_id, domain.id, assigned.id, `${local}@${domain.name}`, String(body.name || local).slice(0, 100), quota * 1073741824, now());
            });
          } catch (failure) { if (failure.code?.includes('CONSTRAINT')) error('This mailbox already exists.', 409); throw failure; }
          audit(user, 'mailbox.reserved', `${local}@${domain.name}`);
          // Passwords are used only during provisioning and are never stored on the mailbox record.
          if (domain.status === 'active' && body.password) await provisionMailbox(owned('mailboxes', id, user), domain, body.password, user);
          return json(owned('mailboxes', id, user), 201);
        }
        if (route === '/activate-mailbox' && request.method === 'POST') {
          const mailbox = owned('mailboxes', body.id, user);
          await exclusive('mailbox:' + mailbox.id, () => provisionMailbox(mailbox, owned('domains', mailbox.domain_id, user), body.password, user)); return json({ ok: true });
        }
        if (route === '/update-mailbox' && request.method === 'POST') {
          const mailbox = owned('mailboxes', body.id, user);
          if (!mailbox.provider_id) error('Activate this mailbox first.', 409);
          const domain = owned('domains', mailbox.domain_id, user);
          const aliases = Array.isArray(body.aliases) ? [...new Set(body.aliases.map(x => String(x).trim().toLowerCase()).filter(Boolean))] : JSON.parse(mailbox.aliases_json);
          if (aliases.length > 20 || aliases.some(x => !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(x))) error('Use up to 20 local alias names.');
          const suspended = body.suspended === undefined ? mailbox.status === 'suspended' : Boolean(body.suspended);
          const quota = Number(body.quotaGB || mailbox.quota_bytes / 1073741824);
          if (!Number.isFinite(quota) || quota < 1 || quota > 100) error('Choose a quota from 1 to 100 GB.');
          await host.updateMailbox(mailbox.provider_id, { aliases: Object.fromEntries(aliases.map((name, index) => [String(index), { name, domainId: domain.provider_id, enable: true }])), quotas: { maxDiskQuota: quota * 1073741824 }, permissions: suspended ? { '@type': 'Merge', enabledPermissions: {}, disabledPermissions: { authenticate: true, emailReceive: true, emailSend: true } } : { '@type': 'Inherit' } });
          store.transaction(() => {
            store.run('UPDATE mailboxes SET aliases_json=?,quota_bytes=?,status=? WHERE id=?', JSON.stringify(aliases), quota * 1073741824, suspended ? 'suspended' : 'active', mailbox.id);
            if (suspended) store.run('UPDATE sessions SET mail_auth=NULL,mailbox_id=NULL WHERE mailbox_id=?', mailbox.id);
          });
          audit(user, 'mailbox.updated', mailbox.email); return json({ ok: true });
        }
        if (route === '/invite' && request.method === 'POST') {
          const email = String(body.email || '').trim().toLowerCase(); if (!validEmail(email)) error('Enter a valid email address.');
          const role = body.role === 'admin' ? 'admin' : 'member';
          if (role === 'admin' && user.role !== 'owner') error('Only an owner can invite administrators.', 403);
          const inviteToken = token();
          store.run('INSERT INTO invitations(id,org_id,email,role,token_hash,expires,created_at) VALUES(?,?,?,?,?,?,?)', randomUUID(), user.org_id, email, role, digest(inviteToken), Date.now() + 172800000, now());
          audit(user, 'team.invited', email); return json({ inviteUrl: `${url.origin}/admin?invite=${inviteToken}`, expiresInHours: 48 });
        }
        if (route === '/team-status' && request.method === 'POST') {
          if (user.role !== 'owner') error('Owner access is required.', 403);
          const member = owned('users', body.id, user); if (member.role === 'owner') error('The owner account must remain active.');
          store.transaction(() => { store.run('UPDATE users SET active=? WHERE id=?', body.active ? 1 : 0, member.id); if (!body.active) store.run('DELETE FROM sessions WHERE user_id=?', member.id); });
          audit(user, 'team.status-changed', member.email); return json({ ok: true });
        }
        error('Unknown platform route.', 404);
      } catch (failure) {
        if (failure.code?.includes('CONSTRAINT')) return json({ error: 'This record already exists or conflicts with another change.' }, 409);
        return json({ error: failure.status ? failure.message : 'The operation could not finish. Please try again.' }, failure.status || 500);
      }
    },
  };
}
