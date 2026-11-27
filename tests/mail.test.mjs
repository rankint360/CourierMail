import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.js';

const originalFetch = globalThis.fetch;
afterEach(() => globalThis.fetch = originalFetch);
const env = { FASTMAIL_API_TOKEN: 'test-token', LOCAL_DEVELOPMENT: 'true' };
const root = 'https://courier.test';
const session = { primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' }, apiUrl: 'https://api.fastmail.com/jmap/api', uploadUrl: 'https://api.fastmail.com/upload/{accountId}', downloadUrl: 'https://api.fastmail.com/download/{accountId}/{blobId}/{name}?type={type}' };
function mock(methodHandler) {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (String(url).endsWith('/session')) return Response.json(session);
    const input = JSON.parse(options.body);
    return Response.json({ methodResponses: input.methodCalls.map(([method, args, id]) => [method, methodHandler(method, args), id]) });
  };
}
async function post(path, data, overrides = env) {
  return worker.fetch(new Request(root + '/api/' + path, { method: 'POST', headers: { Origin: root, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), overrides);
}
test('unconfigured deployments report demo availability without exposing secrets', async () => {
  const response = await worker.fetch(new Request(root + '/api/config'), {});
  assert.deepEqual(await response.json(), { configured: false, provider: 'Fastmail' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('hosted mailbox requires authenticated identity', async () => {
  const response = await worker.fetch(new Request(root + '/api/mailboxes'), { FASTMAIL_API_TOKEN: 'test-token' });
  assert.equal(response.status, 401);
});
test('cross-origin writes are rejected before accessing the provider', async () => {
  const request = new Request(root + '/api/change', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' });
  assert.equal((await worker.fetch(request, env)).status, 403);
});
test('owner restriction rejects another authenticated user', async () => {
  const response = await worker.fetch(new Request(root + '/api/mailboxes', { headers: { 'oai-authenticated-user-id': 'other' } }), { FASTMAIL_API_TOKEN: 'test-token', OWNER_ID: 'owner' });
  assert.equal(response.status, 403);
});
test('failed replacement draft preserves the old provider draft', async () => {
  let destroyed = false;
  mock((method, args) => {
    if (method === 'Mailbox/get') return { list: [{ id: 'drafts', role: 'drafts' }] };
    if (method === 'Identity/get') return { list: [{ id: 'identity', email: 'alex@example.com' }] };
    if (method === 'Email/get') return { list: [{ id: 'old', keywords: { $draft: true } }] };
    if (method === 'Email/set' && args.create) return { notCreated: { draft: { description: 'Mailbox quota exceeded' } } };
    if (args.destroy) destroyed = true;
    return {};
  });
  const response = await post('draft', { id: 'old', to: 'client@example.com', subject: 'Proposal', text: 'Hello' });
  assert.equal(response.status, 409); assert.equal(destroyed, false);
});
test('retry of an already submitted draft does not create another submission', async () => {
  let submissions = 0;
  mock(method => {
    if (method === 'EmailSubmission/query') return { ids: ['existing-submission'] };
    if (method === 'EmailSubmission/get') return { state: 'state' };
    if (method === 'Mailbox/get') return { list: [{ id: 'sent', role: 'sent' }] };
    if (method === 'Email/get') return { list: [{ id: 'draft', keywords: {} }] };
    if (method === 'EmailSubmission/set') submissions++;
    return {};
  });
  const response = await post('send', { id: 'draft', identityId: 'identity' });
  assert.equal(response.status, 200); assert.equal(submissions, 0);
  assert.equal((await response.json()).alreadySubmitted, true);
});
test('send uses provider state and atomically moves the email to Sent', async () => {
  let submission;
  mock((method, args) => {
    if (method === 'EmailSubmission/query') return { ids: [] };
    if (method === 'EmailSubmission/get') return { state: 'expected-state' };
    if (method === 'Mailbox/get') return { list: [{ id: 'sent', role: 'sent' }] };
    if (method === 'Email/get') return { list: [{ id: 'draft', keywords: { $draft: true }, to: [{ email: 'client@example.com' }] }] };
    if (method === 'EmailSubmission/set') { submission = args; return { created: { send: { id: 'submission' } } }; }
    return {};
  });
  assert.equal((await post('send', { id: 'draft', identityId: 'identity' })).status, 200);
  assert.equal(submission.ifInState, 'expected-state');
  assert.deepEqual(submission.onSuccessUpdateEmail['#send'].mailboxIds, { sent: true });
  assert.equal(submission.onSuccessUpdateEmail['#send']['keywords/$draft'], null);
});
test('partial bulk change failure is reported to the client', async () => {
  mock(() => ({ notUpdated: { missing: { description: 'Email was removed' } } }));
  const response = await post('change', { ids: ['missing'], read: true });
  assert.equal(response.status, 409);
});
test('provider credentials cannot follow a redirect to another host', async () => {
  globalThis.fetch = async () => Response.json({ ...session, apiUrl: 'https://evil.example/steal' });
  const response = await worker.fetch(new Request(root + '/api/mailboxes'), env);
  assert.equal(response.status, 502);
});


test('unread queries combine with folder, search, and starred filters before pagination', async () => {
  const queries = [];
  mock((method, args) => {
    if (method === 'Email/query') { queries.push(args); return { ids: ['unread-mail'], total: 73 }; }
    if (method === 'Email/get') { assert.deepEqual(args.ids, ['unread-mail']); return { list: [{ id: 'unread-mail', keywords: {} }] }; }
    throw new Error(`Unexpected method ${method}`);
  });
  const folder = await worker.fetch(new Request(root + '/api/messages?mailbox=inbox&unread=true&q=proposal&position=50'), env);
  assert.equal(folder.status, 200);
  assert.deepEqual(queries[0].filter, { inMailbox: 'inbox', notKeyword: '$seen', text: 'proposal' });
  assert.equal(queries[0].position, 50);
  assert.equal(queries[0].calculateTotal, true);
  const body = await folder.json();
  assert.equal(body.total, 73);
  assert.equal(body.messages[0].id, 'unread-mail');
  await worker.fetch(new Request(root + '/api/messages?starred=true&unread=true'), env);
  assert.deepEqual(queries[1].filter, { notKeyword: '$seen', hasKeyword: '$flagged' });
  await worker.fetch(new Request(root + '/api/messages?mailbox=inbox'), env);
  assert.deepEqual(queries[2].filter, { inMailbox: 'inbox' });
});
