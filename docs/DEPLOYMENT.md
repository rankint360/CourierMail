# Deploy Courier Mail

Courier Mail has two runtime components. The business application and webmail run on Render. Stalwart runs on a host that accepts public SMTP and IMAP connections. The domain can be selected after the application is deployed.

## Application on Render

1. Connect the GitHub repository to Render and create a Blueprint using the root `render.yaml`.
2. Review the paid Starter instance and persistent disk cost before creating resources. The persistent disk holds the business SQLite database. One application instance owns the disk.
3. Render generates `APP_SECRET`. Preserve that value across redeployments and save a copy in your secret manager. The application uses it to encrypt mailbox credentials stored in sessions.
4. Open the Render HTTPS URL at `/admin` and create your business account. Business registration is enabled in the Blueprint. Set `ALLOW_REGISTRATION=false` when registration should be restricted to invitations.
5. Select the final application domain later. Set `APP_ORIGIN` to the exact final HTTPS origin when using a custom domain. Otherwise `RENDER_EXTERNAL_URL` supplies it automatically.
6. The application is available before the mail server is configured. Real mailbox activation remains pending until the mail connection is supplied.

Required production values are `NODE_ENV=production`, `DATA_DIR` pointing at the persistent disk, and `APP_SECRET` containing at least 32 characters. The Blueprint supplies these. `/healthz` checks the database and is the service health-check route.

Render forwards inbound public traffic to one HTTP port per web service. It cannot expose this Compose stack's SMTP/IMAP listeners as a Render web service. Render also blocks outbound port 25. Courier's application uses HTTPS JMAP to reach the separate mail engine.

## Stalwart mail host

1. Obtain a mail-capable Linux host with a stable public IP and permitted inbound and outbound SMTP port 25. Confirm its provider permits email hosting and can set PTR/reverse DNS.
2. Install Docker Engine and Compose from Docker's official packages. Copy `infra/compose.yaml` and `infra/.env.example` to the host. Choose a tested, immutable Stalwart v1 tag or digest in `infra/.env` before production rollout. The supplied v1 major tag is a starting point for setup.
3. From `infra/`, run `docker compose up -d` and inspect `docker compose logs mail` for the bootstrap administrator information.
4. Keep port 8080 bound to loopback. Use an SSH tunnel such as `ssh -L 8080:127.0.0.1:8080 account@server` to reach the setup wizard at `http://127.0.0.1:8080` on your computer.
5. Complete Stalwart's setup wizard. Configure the mail hostname, storage, HTTPS certificate, SMTP listeners, submission, IMAPS, DKIM generation, spam filtering, outbound limits, auto-ban, and delivery queues. Configure all listeners before relying on their published ports.
6. Create a dedicated management API credential with the domain and account create/query/get/update permissions used by Courier. Configure it to allow the required management calls. Use a regular User role for customer mailboxes. Stalwart native Tenant administration requires its Enterprise edition. Courier's application enforces organization ownership independently.
7. Use Stalwart's authenticated HTTPS JMAP endpoint for management and mailbox sessions. Set the following secrets on Render and redeploy the application.

| Variable | Value |
| --- | --- |
| `MAIL_SERVER_URL` | HTTPS origin such as `https://mail.yourdomain.com` |
| `MAIL_HOSTNAME` | Mail host DNS name such as `mail.yourdomain.com` |
| `MAIL_ADMIN_TOKEN` | Dedicated Stalwart management bearer credential |

The adapter targets the Stalwart v1 `urn:stalwart:jmap` management API with `x:Domain` and `x:Account` methods. The supplied adapter has mocked tests. Real provider schema compatibility and server policy must be checked on the selected Stalwart release.

## Business domains and mailboxes

1. In Business Admin, add a domain.
2. Publish the unique `_courier` TXT record. Choose Check DNS to verify ownership. Each domain is globally unique in the application.
3. Activate domain hosting. Courier creates or recovers the domain on Stalwart and displays the server-generated DNS zone, including its DKIM public records.
4. Publish the mail host A/AAAA record and the business domain MX record. Configure PTR at the IP provider so it matches the mail hostname. Publish SPF, DKIM, and DMARC records. An IPv6 address should be advertised only after IPv6 delivery and reverse DNS are configured.
5. Begin with DMARC monitoring, inspect legitimate senders, and then select the appropriate enforcement policy. Courier's DNS checklist checks ownership, expected MX, the presence of a single SPF record, and a DMARC record. Its SPF and DMARC indicators check record presence, with delivery-policy validation remaining an operational task.
6. Invite your team. Courier generates an invitation link with a 48-hour expiry. Share it with the intended recipient. The app does not automatically send invitation emails.
7. Create mailboxes and assign them to active team members. Mailboxes on verified but inactive domains can be reserved. Activate them after domain hosting is active. Passwords are supplied during activation and sent to Stalwart without being stored in the mailbox record.
8. Team members sign in to Business Admin and open their assigned mailbox using its password. The session stores the mailbox authorization encrypted with `APP_SECRET`. Opening webmail then uses that mailbox's JMAP credentials.

Suspending a mailbox stops account sign-in, sending, and receipt while retaining mail. Suspending a team member's business access revokes their Courier sessions. Manage the mailbox separately when terminating its external IMAP access.

## Desktop and mobile apps

Courier is an installable progressive web app using the same HTTPS application origin.

- On Windows, macOS, Linux, and Android, use a browser's Install app command. Business Admin → Apps also offers an install prompt when supported.
- On iOS/iPadOS, open the app in Safari, choose Share, then Add to Home Screen.
- The service worker caches the app shell. Mail API responses are excluded. Recovery drafts are persisted locally, with per-user browser databases when the business session is available. Offline viewing and editing require an app shell previously loaded on that device. Live mail needs connectivity.
- The repository contains the PWA, with no App Store, Play Store, or signed native installer distribution configured.

## Backups and recovery

Run `node scripts/backup-app.mjs /path/to/backups` from the application checkout with its production `DATA_DIR` available. It uses SQLite's online backup API. Back up `APP_SECRET` separately in a secret manager. Copy backups to a separate encrypted off-host destination and test restores on a separate deployment.

On the mail host, `sh infra/backup.sh` briefly stops Stalwart, archives both named volumes, and starts it again through a shell trap. The script requires Docker access and pulls Alpine from its official registry image. Keep the backup directory private and move backups off-host. The mail configuration can contain credentials and private key material.

To restore, stop the destination services, restore the application database or both mail volumes from a known consistent backup into a fresh recovery deployment, restore the corresponding secret values, start the services, and verify account and mail access before switching DNS. Recovery has not been exercised against a real mail host in this environment.

To reset a business account password from a trusted application shell, set `NEW_PASSWORD` in the process environment and run `node scripts/reset-password.mjs owner@example.com`. All sessions for that account are revoked. Mailbox credential recovery is administered through Stalwart.

## Launch verification

Before accepting customer mail, verify external receive, reply with attachment, Sent placement, folder changes, identity restrictions, quota enforcement, spam filtering, outbound abuse limits, DKIM signing, SPF/DMARC alignment, queue retries, backup restoration, and certificate renewal. Account and provider behavior need end-to-end validation on the chosen infrastructure.

Automatic subscription charging, public account email verification, MFA, native app-store distribution, and an automated global mail-cluster rollout are further product work. Current business account authentication, organization ownership, mail provisioning, and webmail flows are implemented and tested locally, with external deployment and real email acceptance pending.

## Official references

- [Render web service networking](https://render.com/docs/web-services)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render networking restrictions](https://render.com/docs/free)
- [Stalwart Docker installation](https://stalw.art/docs/install/platform/docker/)
- [Stalwart account management](https://stalw.art/docs/auth/accounts/manage/)
- [Stalwart Domain API](https://stalw.art/docs/ref/object/domain/)
- [Stalwart Account API](https://stalw.art/docs/ref/object/account/)
