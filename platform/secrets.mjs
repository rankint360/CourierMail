import { readFile } from 'node:fs/promises';

export async function loadSecrets(source = process.env) {
  const env = { ...source };
  for (const name of ['APP_SECRET', 'MAIL_ADMIN_TOKEN']) {
    if (!env[`${name}_FILE`]) continue;
    if (env[name]) throw new Error(`Set only ${name} or ${name}_FILE.`);
    env[name] = (await readFile(env[`${name}_FILE`], 'utf8')).trim();
    if (!env[name]) throw new Error(`${name}_FILE is empty.`);
  }
  return env;
}
