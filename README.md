# Courier Mail

A responsive webmail app with a Fastmail JMAP backend and a device-local demo mailbox. Requires Node.js 22 or later. It has no npm dependencies.

## Run locally

```powershell
npm start
```

Open http://127.0.0.1:4173. The local server binds to the loopback interface. Demo messages, attachments, settings, and recovery drafts are retained in IndexedDB in this browser. Demo sending adds a message to the demo Sent folder.

## Connect real email

Create a Fastmail JMAP API token with **Email** and **Email submission** scopes. Fastmail Basic plans do not support API tokens. See https://www.fastmail.help/hc/en-us/articles/5254602856719-API-tokens.

For local use, set `FASTMAIL_API_TOKEN` in the process environment, then run `npm start`. `.env.example` documents the variables. The application does not automatically load `.env` files. Node's built-in `--env-file` can load a local ignored file, for example `node --env-file=.env local.mjs`.

For the hosted private Site, set `FASTMAIL_API_TOKEN` as a secret using Sites runtime environment settings, then redeploy. In Courier, open Settings and select **Open live Fastmail mailbox**. The token stays server-side.

Keep the hosted Site owner-private. This version serves a single Fastmail account. Each deployment should have its own account token. Optional `OWNER_ID` restricts mailbox operations to one Sites authenticated user ID. Public signup, a tenant administration system, billing, and domain provisioning require a separate product layer.

## Included workflows

- Inbox, Sent, Drafts, Starred, Archive, Spam, Trash, and custom folders.
- Live mailbox search and pagination. Demo search covers its local messages.
- Read, unread, star, archive, folder move, and bulk actions.
- Compose, reply, reply all, forward, Cc, Bcc, signatures, and reusable reply templates.
- Attachments up to a combined 10 MB, upload, download, and forwarding.
- Immediate browser draft recovery. Close the live composer to sync a draft to Fastmail. Open Settings → Recovered drafts after a browser restart or connection failure.
- Provider submission retries retain the same draft ID. A pending submission locks message contents until its outcome is resolved. JMAP submission state guards concurrent submission attempts.
- Responsive layout, keyboard focus, labeled controls, and Ctrl/Cmd K to search.

Mail content is rendered as plain text, including text extracted from HTML-only messages. Demo and live modes are clearly labeled. Fastmail is the source of truth for live messages and folders. Recovery drafts are local to the device until synchronized. Fastmail signatures and identities are managed in Fastmail itself.

## Build and verify

```powershell
npm test
npm run build
```

The build embeds the web assets into `dist/server/index.js`, a Cloudflare Worker module. `.openai/hosting.json` identifies the private Sites project. Native Sites publication packages this Worker and the manifest.

Backend tests simulate JMAP responses. Real delivery, DNS configuration, provider limits, and provider behavior require validation with the connected Fastmail account. A token has not been configured in the delivered deployment.
