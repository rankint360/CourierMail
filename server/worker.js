const CORE = 'urn:ietf:params:jmap:core';
const MAIL = 'urn:ietf:params:jmap:mail';
const SUBMIT = 'urn:ietf:params:jmap:submission';
const security = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
};
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { ...security, 'Content-Type': 'application/json' } }); }
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function safeURL(value, trustedOrigin) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.origin === trustedOrigin || url.hostname === 'fastmail.com' || url.hostname.endsWith('.fastmail.com') || url.hostname === 'fastmailusercontent.com' || url.hostname.endsWith('.fastmailusercontent.com'))) fail('Unsupported provider endpoint.', 502);
  return url;
}
async function provider(url, token, options = {}, trustedOrigin) {
  const response = await fetch(safeURL(url, trustedOrigin), { ...options, redirect: 'error', headers: { ...options.headers, Authorization: token.startsWith('Basic ') ? token : `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) fail(response.status === 401 ? 'Mailbox authentication failed. Sign in again or check the server connection.' : 'The mail server could not complete this request. Please try again.', 502);
  return response;
}
async function connection(token, sessionURL = 'https://api.fastmail.com/jmap/session', trustedOrigin) {
  const session = await (await provider(sessionURL, token, {}, trustedOrigin)).json();
  const accountId = session.primaryAccounts?.[MAIL];
  if (!accountId) fail('This account does not expose an email mailbox.', 502);
  return { session, accountId, trustedOrigin };
}
async function call(ctx, methods) {
  const response = await provider(ctx.session.apiUrl, ctx.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ using: [CORE, MAIL, SUBMIT], methodCalls: methods.map(([name, args], i) => [name, { accountId: ctx.accountId, ...args }, String(i)]) }),
  }, ctx.trustedOrigin);
  const result = await response.json();
  return methods.map((_, i) => {
    const row = result.methodResponses?.find(x => x[2] === String(i));
    if (!row || row[0] === 'error') fail(row?.[1]?.description || 'The mail provider rejected this operation.', 502);
    return row[1];
  });
}
function checkSet(result) {
  const errors = { ...result.notCreated, ...result.notUpdated, ...result.notDestroyed };
  if (Object.keys(errors).length) fail(Object.values(errors)[0]?.description || 'The mailbox change was rejected.', 409);
  return result;
}
const summary = ['id', 'threadId', 'mailboxIds', 'keywords', 'from', 'to', 'subject', 'preview', 'receivedAt', 'hasAttachment', 'size'];
async function api(request, env, url) {
  const mailToken = env.MAIL_AUTHORIZATION || env.FASTMAIL_API_TOKEN;
  if (url.pathname === '/api/config') return json({ configured: Boolean(mailToken), provider: env.MAIL_AUTHORIZATION ? 'Zavrill' : 'Fastmail' });
  if (!mailToken) return json({ error: 'Sign in to your mailbox through Business Admin or configure the Fastmail connection.' }, 503);
  if (env.LOCAL_DEVELOPMENT !== 'true' && !request.headers.get('oai-authenticated-user-id')) return json({ error: 'Sign in to access this mailbox.' }, 401);
  if (env.OWNER_ID && request.headers.get('oai-authenticated-user-id') !== env.OWNER_ID && env.LOCAL_DEVELOPMENT !== 'true') return json({ error: 'This mailbox belongs to another user.' }, 403);
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
  const ctx = { ...await connection(mailToken, env.MAIL_SESSION_URL, env.MAIL_TRUSTED_ORIGIN), token: mailToken };
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    const data = await request.arrayBuffer();
    if (data.byteLength > 10 * 1024 * 1024) fail('Attachments must be under 10 MB.');
    const target = ctx.session.uploadUrl.replace('{accountId}', encodeURIComponent(ctx.accountId));
    return json(await (await provider(target, ctx.token, { method: 'POST', headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/octet-stream' }, body: data }, ctx.trustedOrigin)).json());
  }
  if (url.pathname === '/api/download' && request.method === 'GET') {
    const blobId = url.searchParams.get('blobId');
    if (!blobId) fail('Missing attachment ID.');
    const name = (url.searchParams.get('name') || 'attachment').replace(/[\r\n"\\/]/g, '_');
    const target = ctx.session.downloadUrl.replace('{accountId}', encodeURIComponent(ctx.accountId)).replace('{blobId}', encodeURIComponent(blobId)).replace('{name}', encodeURIComponent(name)).replace('{type}', 'application%2Foctet-stream');
    const result = await provider(target, ctx.token, {}, ctx.trustedOrigin);
    return new Response(result.body, { headers: { ...security, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
  }
  if (url.pathname === '/api/mailboxes' && request.method === 'GET') {
    const [boxes, identities] = await call(ctx, [['Mailbox/get', {}], ['Identity/get', {}]]);
    return json({ mailboxes: boxes.list, identities: identities.list });
  }
  if (url.pathname === '/api/messages' && request.method === 'GET') {
    const filter = {};
    if (url.searchParams.get('mailbox')) filter.inMailbox = url.searchParams.get('mailbox');
    if (url.searchParams.get('starred') === 'true') filter.hasKeyword = '$flagged';
    if (url.searchParams.get('q')) filter.text = url.searchParams.get('q').slice(0, 500);
    const position = Math.max(0, Number(url.searchParams.get('position')) || 0);
    const [query] = await call(ctx, [['Email/query', { filter, sort: [{ property: 'receivedAt', isAscending: false }], position, limit: 50, calculateTotal: true }]]);
    const [messages] = await call(ctx, [['Email/get', { ids: query.ids, properties: summary }]]);
    return json({ messages: messages.list, total: query.total, position });
  }
  if (url.pathname === '/api/message' && request.method === 'GET') {
    const [result] = await call(ctx, [['Email/get', { ids: [url.searchParams.get('id')], properties: [...summary, 'cc', 'bcc', 'replyTo', 'messageId', 'references', 'inReplyTo', 'textBody', 'htmlBody', 'bodyValues', 'attachments'], fetchTextBodyValues: true, fetchHTMLBodyValues: true, maxBodyValueBytes: 1000000 }]]);
    if (!result.list.length) fail('This message is no longer available.', 404);
    return json(result.list[0]);
  }
  if (request.method !== 'POST') return json({ error: 'Unknown route.' }, 404);
  if (Number(request.headers.get('content-length') || 0) > 2 * 1024 * 1024) fail('Request too large.', 413);
  const body = await request.json();
  if (url.pathname === '/api/change') {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100) fail('Select up to 100 messages.');
    const patch = {};
    if (typeof body.read === 'boolean') patch['keywords/$seen'] = body.read ? true : null;
    if (typeof body.starred === 'boolean') patch['keywords/$flagged'] = body.starred ? true : null;
    if (typeof body.mailbox === 'string') patch.mailboxIds = { [body.mailbox]: true };
    if (!Object.keys(patch).length) fail('No changes supplied.');
    checkSet((await call(ctx, [['Email/set', { update: Object.fromEntries(body.ids.map(id => [id, patch])) }]]))[0]);
    return json({ ok: true });
  }
  if (url.pathname === '/api/folder') {
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) fail('Enter a folder name.');
    const [result] = await call(ctx, [['Mailbox/set', { create: { folder: { name, parentId: null } } }]]);
    checkSet(result);
    return json(result.created.folder);
  }
  if (url.pathname === '/api/draft') {
    const [boxes, identities] = await call(ctx, [['Mailbox/get', {}], ['Identity/get', {}]]);
    const drafts = boxes.list.find(x => x.role === 'drafts');
    const identity = identities.list.find(x => x.id === body.identityId) || identities.list[0];
    if (!drafts || !identity) fail('The account needs a Drafts folder and sending identity.', 409);
    const addresses = value => String(value || '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(email => {
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) fail(`Invalid email address: ${email}`);
      return { email };
    });
    const email = { mailboxIds: { [drafts.id]: true }, keywords: { '$draft': true, '$seen': true }, from: [{ name: identity.name, email: identity.email }], to: addresses(body.to), cc: addresses(body.cc), bcc: addresses(body.bcc), subject: String(body.subject || '').slice(0, 1000), textBody: [{ partId: 'text', type: 'text/plain' }], bodyValues: { text: { value: String(body.text || '').slice(0, 1000000) } } };
    if (body.inReplyTo?.length) email.inReplyTo = body.inReplyTo;
    if (body.references?.length) email.references = body.references;
    if (Array.isArray(body.attachments)) email.attachments = body.attachments.map(x => ({ blobId: x.blobId, type: x.type || 'application/octet-stream', name: x.name, disposition: 'attachment' }));
    if (body.id) {
      const [old] = await call(ctx, [['Email/get', { ids: [body.id], properties: ['id', 'keywords'] }]]);
      if (!old.list[0]?.keywords?.$draft) fail('This draft changed. Refresh the mailbox before editing.', 409);
    }
    const [result] = await call(ctx, [['Email/set', { create: { draft: email } }]]);
    checkSet(result);
    // Retain the old draft until its replacement exists. A cleanup failure preserves both copies.
    if (body.id) {
      try { await call(ctx, [['Email/set', { destroy: [body.id] }]]); } catch { /* Recoverable duplicate draft. */ }
    }
    return json({ id: result.created.draft.id, identityId: identity.id });
  }
  if (url.pathname === '/api/send') {
    if (!body.id) fail('Save the draft before sending.');
    const [prior, state, boxes, email] = await call(ctx, [['EmailSubmission/query', { filter: { emailIds: [body.id] } }], ['EmailSubmission/get', { ids: [] }], ['Mailbox/get', {}], ['Email/get', { ids: [body.id], properties: ['id', 'keywords', 'to', 'cc', 'bcc'] }]]);
    if (prior.ids.length) return json({ ok: true, alreadySubmitted: true });
    if (!email.list[0]?.keywords?.$draft) fail('This message is no longer a draft.', 409);
    if (!['to', 'cc', 'bcc'].some(k => email.list[0][k]?.length)) fail('Add at least one recipient.');
    const sent = boxes.list.find(x => x.role === 'sent');
    if (!sent) fail('Create a Sent folder in Fastmail first.', 409);
    const [result] = await call(ctx, [['EmailSubmission/set', { ifInState: state.state, create: { send: { emailId: body.id, identityId: body.identityId } }, onSuccessUpdateEmail: { '#send': { mailboxIds: { [sent.id]: true }, 'keywords/$draft': null, 'keywords/$seen': true } } }]]);
    checkSet(result);
    return json({ ok: true });
  }
  return json({ error: 'Unknown route.' }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (typeof binaryAssets !== 'undefined' && binaryAssets[url.pathname]) {
        return new Response(Uint8Array.from(atob(binaryAssets[url.pathname]), x => x.charCodeAt(0)), { headers: { ...security, 'Content-Type': url.pathname.endsWith('.ico') ? 'image/x-icon' : 'image/png' } });
      }
      const asset = assets[url.pathname];
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(asset[0], { headers: { ...security, ...(url.pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}), 'Content-Type': `${asset[1]}; charset=utf-8` } });
    } catch (error) { return json({ error: error.status ? error.message : 'The request could not finish. Your draft is retained. Please try again.' }, error.status || 502); }
  },
};
