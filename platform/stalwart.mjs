const CAPABILITY = 'urn:stalwart:jmap';
export function createMailHost(env, transport = fetch) {
  const origin = env.MAIL_SERVER_URL ? new URL(env.MAIL_SERVER_URL) : null;
  if (origin && origin.protocol !== 'https:') throw new Error('MAIL_SERVER_URL must use HTTPS.');
  async function call(method, args) {
    if (!origin || !env.MAIL_ADMIN_TOKEN) throw Object.assign(new Error('Configure MAIL_SERVER_URL and MAIL_ADMIN_TOKEN to activate mail hosting.'), { status: 503 });
    const response = await transport(new URL('/jmap/', origin), { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${env.MAIL_ADMIN_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ using: ['urn:ietf:params:jmap:core', CAPABILITY], methodCalls: [[method, args, 'request']] }), signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw Object.assign(new Error('The mail server rejected the management request. Check its connection and permissions.'), { status: 502 });
    const data = await response.json();
    const row = data.methodResponses?.find(x => x[2] === 'request');
    if (!row || row[0] === 'error') throw Object.assign(new Error(row?.[1]?.description || 'Mail server management failed.'), { status: 502 });
    const result = row[1];
    const error = Object.values({ ...result.notCreated, ...result.notUpdated, ...result.notDestroyed })[0];
    if (error) throw Object.assign(new Error(error.description || `Mail server rejected the operation (${error.type}).`), { status: 409 });
    return result;
  }
  return {
    configured: Boolean(origin && env.MAIL_ADMIN_TOKEN),
    async ensureDomain(domain) {
      const found = await call('x:Domain/query', { filter: { name: domain.name } });
      if (found.ids?.length) {
        const domains = await call('x:Domain/get', { ids: found.ids });
        const existing = domains.list.find(x => x.name === domain.name);
        if (existing) return existing.id;
      }
      const result = await call('x:Domain/set', { create: { domain: { name: domain.name, enable: true, allowRelaying: false, dkimManagement: { '@type': 'Automatic' }, dnsManagement: { '@type': 'Manual' } } } });
      return result.created.domain.id;
    },
    async domainInfo(id) { return (await call('x:Domain/get', { ids: [id] })).list[0]; },
    async ensureMailbox(mailbox, domainId, password) {
      const name = mailbox.email.split('@')[0];
      const found = await call('x:Account/query', { filter: { name, domainId } });
      if (found.ids?.length) {
        const accounts = await call('x:Account/get', { ids: found.ids });
        const existing = accounts.list.find(x => x.name === name && x.domainId === domainId && x['@type'] === 'User');
        if (existing) return existing.id;
      }
      const result = await call('x:Account/set', { create: { account: { '@type': 'User', name, domainId, description: mailbox.display_name, credentials: { '0': { '@type': 'Password', secret: password } }, quotas: { maxDiskQuota: mailbox.quota_bytes }, roles: { '@type': 'User' }, permissions: { '@type': 'Inherit' }, aliases: {} } } });
      return result.created.account.id;
    },
    async updateMailbox(id, changes) { return call('x:Account/set', { update: { [id]: changes } }); },
    async mailboxInfo(id) { return (await call('x:Account/get', { ids: [id] })).list[0]; },
    async verifyMailbox(email, password) {
      if (!origin) throw Object.assign(new Error('Mail hosting has not been connected.'), { status: 503 });
      const authorization = `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;
      const response = await transport(new URL('/.well-known/jmap', origin), { headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Object.assign(new Error('Mailbox sign-in failed.'), { status: 401 });
      const session = await response.json();
      if (!session.primaryAccounts?.['urn:ietf:params:jmap:mail']) throw Object.assign(new Error('This account does not have a mail service.'), { status: 409 });
      return authorization;
    },
  };
}
