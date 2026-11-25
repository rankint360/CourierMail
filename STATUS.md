# Courier Mail Status

Updated November 24, 2026, America/Los_Angeles.

The webmail app is implemented and privately deployed. Demo mode is usable. A Fastmail account connection and real email verification are pending.

| Area | State | Evidence |
| --- | --- | --- |
| Webmail interface | Implemented | Inbox, folders, search, message reader, bulk actions, compose, replies, forwarding, Cc/Bcc, templates, and signature settings. |
| Demo persistence | Implemented and browser checked | Draft survived refresh and reopened with its original contents. Demo sending and Sent search were checked. |
| Folders and bulk actions | Browser checked in demo mode | Custom folder creation and bulk archive succeeded. |
| Responsive UI | Desktop and narrow layouts inspected | Overflow and mobile toolbar corrections applied. |
| Fastmail JMAP backend | Implemented with mocked test coverage | Mailboxes, message retrieval, search, changes, drafts, submissions, attachments, and folders. |
| Backend regression tests | Passed | Nine tests passed during the GitHub handoff verification. |
| JavaScript syntax | Passed | `web/app.js` and `server/worker.js`. |
| Worker build | Passed | `npm run build` produces `dist/server/index.js`. |
| Private Sites deployment | Succeeded | Source commit `277edd1d5655a85a64bfc4f0b2a855e266d80f24`. |
| Fastmail credentials | Pending | `FASTMAIL_API_TOKEN` has not been configured. |
| Real email delivery and provider behavior | Pending | Requires the connected Fastmail account. |
| GitHub handoff | Published and verified | All 14 project source, configuration, test, and documentation files uploaded to `main`. Remote recursive tree confirmed the complete inventory at source commit `3e46a3269727d38f8c9a5779ee8d7de3a93978e0`. |

## Locations

- Repository target is [rankint360/CourierMail](https://github.com/rankint360/CourierMail).
- Private app is [Courier Mail](https://courier-webmail-jv.stonybrioche1.chatgpt.site).
- Hosting project is `appgprj_6b067b0c6e908191b4176e4b4a8da6bd`.
- Successful deployment is `appgdep_6b067e8f559c81918c97dbbcd271bdd5`.

## Next steps

1. Configure `FASTMAIL_API_TOKEN` through server environment secrets and redeploy. Use an eligible Fastmail plan and grant Email and Email submission scopes.
2. Open Settings in Courier and select the live Fastmail mailbox.
3. Verify receipt of an external message, reply with an attachment, refresh, and confirm the reply appears in Sent.
4. Verify live search, folder moves, attachment download, draft synchronization, and interrupted-send recovery.
5. Append results to RECORD_REGISTER.md and update this snapshot.

## Current product boundaries

One Fastmail account is served by each private deployment. Recovery drafts are stored in the browser until synchronized. Email bodies are displayed as text. Authentication at the hosted boundary uses Sites identity. The local server binds to loopback.

The chosen provider, Courier branding, and green visual style were implementation decisions. The user authorized choosing the provider. No live mailbox credentials have been supplied.

## Files and commands

The repository contains the application source, tests, configuration, build scripts, setup instructions, and work records. Generated deployment output and local delivery archives can be recreated from source. Runtime secrets are configured separately.

```powershell
npm test
npm run build
npm start
```

See [README.md](README.md) for connection instructions and [RECORD_REGISTER.md](RECORD_REGISTER.md) for the chronological work history. Update this file and the register when material work or verification changes.
