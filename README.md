# Courier Mail

A business email platform with organization administration, domain verification, mailbox provisioning, webmail, and installable desktop/mobile web apps. Stalwart v1 supplies the mail engine. The original Fastmail connection remains available for standalone webmail. Requires Node.js 24 or later and has no npm dependencies.

## Run locally

```powershell
npm start
```

Open http://127.0.0.1:4173 for webmail and http://127.0.0.1:4173/admin for business administration. Local development stores the business database in ignored `.data/` and creates a local encryption key. The local server binds to loopback. Demo messages, attachments, settings, and recovery drafts are retained in IndexedDB. Demo sending adds a message to the demo Sent folder.

## Business email hosting

The Render Blueprint deploys the business application with a persistent disk. The `infra/compose.yaml` stack prepares Stalwart on a mail-capable Linux host. Render handles the application over HTTP, while Stalwart handles SMTP, IMAP, JMAP, storage, spam filtering, and delivery queues.

Business Admin includes account registration and sign-in, tenant ownership, owner/admin/member roles, one-time invitations, custom branding, unique domain registration, DNS ownership checks, domain activation, mailbox provisioning, aliases, quotas, suspension, audit history, password changes, and encrypted mailbox sessions.

See [deployment instructions](docs/DEPLOYMENT.md) for the Render Blueprint, server setup, DNS, DKIM, credentials, backups, recovery, and launch verification. The Blueprint selects a paid Render instance and persistent disk. Review its cost before provisioning.

## Desktop and mobile

Courier is a progressive web app. Install it from a supported desktop/Android browser, or use Safari's Add to Home Screen on iOS. The service worker caches the application shell and excludes mail API responses. Browser-local draft recovery is available. Native app-store packages and signed installers are not included.

## Connect real email

Create a Fastmail JMAP API token with **Email** and **Email submission** scopes. Fastmail Basic plans do not support API tokens. See https://www.fastmail.help/hc/en-us/articles/5254602856719-API-tokens.

For standalone local webmail, set `FASTMAIL_API_TOKEN` in the process environment, then run `npm run start:webmail`. `.env.example` documents the variables. The application does not automatically load `.env` files. Node's built-in `--env-file` can load a local ignored file, for example `node --env-file=.env local.mjs`. The production business server uses each signed-in user's mailbox connection.

For the hosted private Site, set `FASTMAIL_API_TOKEN` as a secret using Sites runtime environment settings, then redeploy. In Courier, open Settings and select **Open live Fastmail mailbox**. The token stays server-side.

Keep the standalone Sites preview owner-private when it contains a Fastmail token. This compatibility mode serves a single Fastmail account and supports optional `OWNER_ID`. Business organizations and persistent administration run on the Render/Node server using Courier sessions and a separate mail engine.

## Included workflows

- Inbox, Sent, Drafts, Starred, Archive, Spam, Trash, and custom folders.
- Live mailbox search and pagination. Demo search covers its local messages.
- Read, unread, star, archive, folder move, and bulk actions.
- Compose, reply, reply all, forward, Cc, Bcc, signatures, and reusable reply templates.
- Attachments up to a combined 10 MB, upload, download, and forwarding.
- Immediate browser draft recovery. Close the live composer to sync a draft to the connected mail server. Open Settings → Recovered drafts after a browser restart or connection failure.
- Provider submission retries retain the same draft ID. A pending submission locks message contents until its outcome is resolved. JMAP submission state guards concurrent submission attempts.
- Responsive layout, keyboard focus, labeled controls, and Ctrl/Cmd K to search.

Mail content is rendered as plain text, including text extracted from HTML-only messages. Demo and live modes are clearly labeled. The connected JMAP server is the source of truth for live messages and folders. Recovery drafts are local to the device until synchronized. Sending identities are managed on the connected mail server.

## Build and verify

```powershell
npm test
npm run build
```

The build embeds the web assets into `dist/server/index.js`, a Cloudflare Worker module. `.openai/hosting.json` identifies the private Sites project. Native Sites publication packages this Worker and the manifest.

The test suite covers webmail regression cases, tenant boundaries, sessions, DNS activation gates, provisioning, invitations, encryption, provider payloads, and the production HTTP entrypoint. Provider calls are simulated. Real delivery, DNS, spam handling, Stalwart startup, mail backup restoration, and provider behavior require validation on the connected mail infrastructure.

The existing private Site previews the webmail and serves the business portal's deployment guidance. Persistent business APIs require the Render/Node deployment. The Render business application is live at https://courier-mail-sa4z.onrender.com, with administration at /admin. The final domain, mail host, and mail-server credentials are still pending.

See [STATUS.md](STATUS.md) for the current readiness snapshot and [RECORD_REGISTER.md](RECORD_REGISTER.md) for the work history.
