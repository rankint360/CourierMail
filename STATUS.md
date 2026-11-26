# Zavrill Status

Updated November 25, 2026, America/Los_Angeles.

Version 2 expands the webmail app into a deployable business email platform. The application and API tests pass locally. Live email hosting still requires a mail-capable host, a selected domain, DNS, TLS, and mail-server credentials.

## Readiness

| Area | State | Evidence or dependency |
| --- | --- | --- |
| Business platform | Implemented and tested locally | Persistent organizations, accounts, roles, invitations, branding, domains, mailboxes, audit history, sessions, and password management. |
| Tenant boundaries | Tested | Cross-organization mutations and member administration rejected. Mailbox sessions are limited to assigned active users. |
| Domain onboarding | Implemented | DNS ownership verification gates provisioning. Includes MX/SPF/DMARC checks and generated DKIM zone display. |
| Mailbox administration | Implemented | Reservation, activation, assignment, aliases, quotas, suspension, encrypted sign-in, and provisioning recovery. |
| Webmail | Implemented | Inbox, folders, search, bulk actions, compose, replies, forwarding, Cc/Bcc, attachments, templates, and recovery drafts. |
| Desktop/mobile access | Installable PWA implemented | Manifest, icons, service worker shell cache, and installation controls. Mail APIs are excluded from caching. |
| Stalwart adapter | Mocked tests passed | Targets v1 management API and standard JMAP mail. Real server acceptance testing remains pending. |
| Test suite | Passed | 20 tests, including the production Node HTTP entrypoint with an isolated database. |
| Build and syntax | Passed | Worker build and modified JavaScript entrypoints checked. |
| Admin browser QA | Passed for checked flows | Registration, domain reservation, DNS instructions, branding, Apps screen, and branded webmail. Mobile document width matches viewport. |
| Docker and mail-stack QA | Application container deployed | Render built and started the app container. Stalwart startup, real mail, and mail-volume restoration remain pending. |
| Render account | Connected | User confirmed the Rankint360 workspace for deployment preparation. |
| Render application | Live and verified | https://courier-mail-sa4z.onrender.com. User approved the reviewed plan. Deployment dep-dc3gpkuq1p3s738qlft0 is live, with database health and public routes verified. |
| SMTP/IMAP host | Pending | A separate mail-capable host is required. Render public web services expose HTTP. |
| Domain and DNS | Pending | User will select the domain after the build. |
| Live mail | Pending | Mail host, credentials, DNS, TLS, and external send/receive verification required. |
| GitHub expansion update | Published and verified | All 41 files matched the local source at commit eae80374369b4da7e29543e411ddb41f232cf902. Follow-up records capture deployment planning. |

## Deliverables

- [Live business application](https://courier-mail-sa4z.onrender.com/admin)
- [Source repository](https://github.com/rankint360/CourierMail)
- [Private webmail preview](https://courier-webmail-jv.stonybrioche1.chatgpt.site)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Render Blueprint](render.yaml)
- [Mail-host Compose stack](infra/compose.yaml)
- [Record Register](RECORD_REGISTER.md)

The private Sites preview serves the webmail/PWA and business portal deployment guidance. Persistent business APIs run on the Render/Node server with its own SQLite database. Standalone Fastmail compatibility remains available in the private preview.

## Live activation

1. Create the business owner account at the deployed application /admin screen.
2. Review the deployed business portal and install Zavrill on the desired devices.
3. Choose the domain and obtain a mail-capable host with a stable public IP and mail-port access.
4. Configure Stalwart, TLS, inbound/outbound rules, spam protection, and a management credential.
5. Set MAIL_SERVER_URL, MAIL_HOSTNAME, and MAIL_ADMIN_TOKEN on Render.
6. Verify domain ownership, activate hosting, publish MX/SPF/DKIM/DMARC and PTR, invite the team, and activate mailboxes.
7. Verify external mail, attachments, Sent placement, suspension, quotas, abuse limits, retries, backups, and restores.

## Current limits

Desktop/mobile delivery uses an installable web app. Signed native installers and app-store releases are not included. Automatic billing, account email verification, and MFA are not implemented. Mail engine initialization and backup restoration require the future live environment. This build has not been verified as a complete production email hosting service.

## Local commands

Requires Node.js 24+. Run npm start, npm test, and npm run build from the project root. Open /admin for business administration and / for webmail. Development state is stored in ignored .data/. Keep APP_SECRET stable in production.

Update this snapshot and the Record Register when deployment or verification advances.

## Deployment verification

Service srv-dc3gpkeq1p3s738qlehg runs in Ohio with a 1 GB persistent disk. Application commit eae80374369b4da7e29543e411ddb41f232cf902 is live. The public app, admin page, platform configuration/session routes, manifest, and icon returned HTTP 200. The health endpoint returned status ok with database true after one transient edge 520 response. The live admin sign-in screen was verified in the browser. Render log retrieval recovered after a temporary 503, and the error-log query returned no matching entries. Automatic Blueprint synchronization is disabled, while the service deploys code commits automatically. Documentation-only publication uses the skip-render marker.

## Combined Netcup preparation — 2026-11-26

Added infra/netcup with a single-host Docker Compose stack for Zavrill, Stalwart, and Caddy. It includes persistent application/mail storage, HTTPS routing, private bootstrap access, file-based secrets, setup and preflight tools, certificate synchronization, and cold backups. docs/NETCUP.md covers host preparation, DNS/PTR, mail TLS renewal, Stalwart setup, restore rehearsal, and preserving existing Render accounts during migration.

Local verification passed all 21 tests, the application build, shell syntax checks for the deployment scripts, and git diff checks. Docker is unavailable on this workstation. Added a Linux GitHub Actions workflow to validate Compose, both Caddy routes, and a built production container with mounted secrets. Its remote result is recorded separately when available.

Netcup deployment has not been applied. The server, final domain, DNS, certificate issuance, external mail delivery, and backup restoration still require live setup. Existing Render resources remain running. Registration defaults to disabled, and the public Stalwart route remains closed until initialization is complete.

## Netcup verification result

Published the combined deployment package in GitHub commit 56685d72b6699b8b6e29e1bed0f7a396319748d5. Linux Actions run 45814231972 completed successfully. All tests, Compose validation, shell syntax, both Caddy route modes, and the built production container with private mounted secrets passed. Certificate issuance, Stalwart initialization, external mail delivery, and full backup restoration require the actual host and domain.

## Zavrill brand selection — 2026-11-26

The user selected Zavrill as the platform brand. Updated webmail, administration, page metadata, PWA naming, hosted-provider display, new-organization branding defaults, package metadata, and current deployment guides. docs/BRAND.md records the display name, Business email descriptor, intended domain, and compatibility choices.

Existing database files, browser storage, sessions, Compose volumes, and DNS verification identifiers retain their established names. This preserves existing state during the rebrand. New shell caches use Zavrill naming and retire old shell caches on service-worker activation. Existing custom organization branding is preserved.

All 21 tests passed, the production build succeeded, JavaScript syntax checks passed, and git diff checks passed. Preview and GitHub publication verification are recorded below when complete. The selected domain has not been registered or connected by this work.

Zavrill preview publication succeeded. The existing owner-private preview URL is https://courier-webmail-jv.stonybrioche1.chatgpt.site. Deployment appgdep_6b08736d0400819188f0ed5cb3d9c3a9 serves source commit 9081b616f037298731e8c49c6c9a6c399930b869. Its display title is Zavrill. The repository and service URL identifiers retain their existing names.

## Zavrill live verification

GitHub application commit 53e9125aecfb8a454e6511e2fce945cb39a942e8 is live on Render deployment dep-dc4774i9lscs73dvoddg. Root webmail and /admin return HTTP 200 with Zavrill titles. The PWA manifest returns name Zavrill. /healthz returns HTTP 200, status ok, and database true. The live administration screen was visually verified in the browser.

Linux Actions run 45872319241 passed all tests, Compose and shell validation, both Caddy route modes, and production-container startup with file-mounted secrets. The owner-private Sites preview also published successfully. Domain registration, DNS connection, final Netcup activation, and live mail-delivery testing remain pending.
