import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSecrets } from '../platform/secrets.mjs';

test('file secrets support Compose mounts and preserve direct environment compatibility', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'courier-secrets-'));
  try {
    const file = join(dir, 'secret');
    await writeFile(file, 'a-private-key\n');
    const source = { APP_SECRET_FILE: file, MAIL_ADMIN_TOKEN: 'direct-token' };
    const loaded = await loadSecrets(source);
    assert.equal(loaded.APP_SECRET, 'a-private-key');
    assert.equal(loaded.MAIL_ADMIN_TOKEN, 'direct-token');
    assert.equal(source.APP_SECRET, undefined);
    await assert.rejects(loadSecrets({ APP_SECRET: 'ambiguous', APP_SECRET_FILE: file }), /Set only/);
    await writeFile(file, '\n');
    await assert.rejects(loadSecrets({ MAIL_ADMIN_TOKEN_FILE: file }), /empty/);
    await assert.rejects(loadSecrets({ APP_SECRET_FILE: join(dir, 'missing') }), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
