# Combined Netcup deployment

Zavrill, its SQLite application database, Stalwart, and Caddy run on one Linux VPS using `infra/netcup/compose.yaml`. Render remains operational until a separately planned cutover. This package requires server and domain setup before it can host live email.

## Host preparation

Use a maintained Debian or Ubuntu VPS with a dedicated static public IPv4, Docker Engine and Compose v2, Node.js 24+, Python 3, OpenSSL, util-linux (`flock`), and sufficient disk for mail plus backups. Start with 2 vCPU and 4 GB RAM, then measure actual usage. Install Docker from its official repository. Protect SSH with keys, apply security updates, and arrange encrypted off-server backups.

In Netcup SCP, remove the default SMTP mail block after reviewing the provider's policy. Permit inbound TCP 25, 465, 587, 993, 4190, 80 and 443 and UDP 443 if HTTP/3 is desired. Restrict SSH to trusted sources. Permit outbound TCP 25 and DNS. Docker-published ports require firewall rules in Docker's forwarding path or Netcup's upstream firewall. Do not rely solely on UFW rules. Port 8080 is bound to host loopback for private setup. Port 10000 has no host binding.

Choose two distinct names, such as `app.yourdomain.tld` for the app and `mail.yourdomain.tld` for mail. Point both A records to the VPS. Publish AAAA only if IPv6 is configured and tested. Set reverse DNS for the sending IP to the mail hostname in SCP, and ensure forward lookup matches.

## Prepare and boot

Clone the repository onto the VPS, then run from its root.

```sh
node infra/netcup/setup.mjs
cd infra/netcup
sudoedit .env
node preflight.mjs
docker compose up -d --build
docker compose ps
```

The setup script preserves existing encryption keys on repeated runs. Keep the directory owned by the administrator who runs these commands. Run privileged scripts using `sudo sh ...` if Docker or private certificate files require root. Never commit `.env`, secrets, mail data, certificates, or backup archives. Pin the Stalwart and Caddy image tags to tested release versions or digests before a production rollout. The initial defaults track their supported major versions.

Caddy obtains HTTPS certificates for both hostnames. The mail hostname initially returns 503 so the Stalwart bootstrap wizard stays private. The app starts with registration disabled. The placeholder management token permits app startup, but provisioning cannot work until a real token is configured.

## Initialize Stalwart privately

From your workstation, open an SSH tunnel to the VPS.

```sh
ssh -L 18080:127.0.0.1:8080 administrator@SERVER_IP
```

Read the initial credential using `docker compose logs mail` on the server. Treat those logs as sensitive. Visit `http://127.0.0.1:18080` on your workstation and complete the Stalwart v1 wizard. Use its persistent stores under `/var/lib/stalwart` and configuration under `/etc/stalwart`. Create a permanent administrator, remove temporary/recovery access, set the server hostname, and set the public URL to `https://MAIL_HOSTNAME`. Keep HTTP on container port 8080 for Caddy. Configure trusted proxy headers only for the Docker proxy network. Public HTTP is terminated by Caddy on this single-host network.

Configure SMTP 25 with STARTTLS for server delivery, authenticated submission on 465 and 587, IMAPS 993, and ManageSieve 4190 if needed. Anonymous external relay must be denied. Require authentication and TLS for submission, configure spam and abuse limits, and restart Stalwart after the wizard. HTTP setup must no longer accept the temporary bootstrap credential.

Create a Stalwart management API token with the domain/account administration permissions required by Zavrill. Enter it into `secrets/mail_admin_token` with a private editor and retain mode 0600. This is a server-side credential shared by Zavrill's tenant administration backend, so protect it as an administrative secret.

## Mail TLS and renewal

Caddy's HTTPS certificate does not automatically enable TLS on the mail protocols. Once Caddy has issued the mail hostname certificate, run on the VPS.

```sh
sudo sh sync-tls.sh
```

In Stalwart's Settings → TLS → Certificates, create a file certificate with certificate path `/etc/stalwart/tls/mail.crt` and private key path `/etc/stalwart/tls/mail.key`. Select it as the default certificate and reload TLS or restart mail. These paths are inside the container. The stock image must have permission to read the root-owned key. If configuring a non-root mail image, explicitly grant its UID read access while keeping the key private.

Install an hourly root cron entry using the absolute path to the clone. The script checks certificate validity and key pairing, copies only changed certificates, and restarts Stalwart to load them. Renewal causes a brief mail interruption. Monitor nonzero exits and certificate expiration.

```cron
17 * * * * /bin/sh /opt/CourierMail/infra/netcup/sync-tls.sh >> /var/log/courier-tls.log 2>&1
```

Adjust `/opt/CourierMail` to the actual clone. Keep Caddy data persistent. After renewal, test the presented certificate on both HTTPS and IMAPS. The maintenance lock serializes certificate copying with the backup script.

## Open the service

Set `MAIL_ROUTE=mail_ready` and temporarily `ALLOW_REGISTRATION=true` in `.env`, then run `node preflight.mjs` and `docker compose up -d`. Open the app's `/admin`, create the owner account, then set `ALLOW_REGISTRATION=false` and run `docker compose up -d` again. Public registration is an organization signup facility, so minimize this initial window.

Add the business domain, verify the Zavrill TXT challenge, and activate hosting. Publish the actual Stalwart-generated DKIM selector and public key. Publish MX pointing to the mail hostname, SPF authorizing the sending IP, and DMARC with a monitored reporting address. Start with a reporting policy and tighten it after inspecting legitimate traffic. Add abuse@ and postmaster@ handling. Additional customer domains require their own ownership checks, DNS, and DKIM configuration.

Check `https://APP_HOSTNAME/healthz` and `https://MAIL_HOSTNAME/.well-known/jmap`. The app reaches mail over HTTPS using Caddy's Docker network alias and the publicly trusted certificate. JMAP discovery must advertise the public mail hostname for API, upload, and download URLs.

## Backups and restore

```sh
sudo sh backup.sh
```

This makes a cold snapshot of SQLite, Stalwart configuration and data, `.env`, secrets, TLS files, and Caddy data. It briefly stops all services and restarts only those previously running, including after a backup error. Archive checksums are included. Backups contain passwords, private keys, and messages. Encrypt and transfer them off the VPS, restrict access, and set retention. A backup on this server alone is insufficient.

For a restore rehearsal, use an isolated replacement VPS with no live DNS or public mail access. Check `sha256sum -c SHA256SUMS`. Use the same source revision and image versions as the backup. Extract `host-config.tar.gz` into its `infra/netcup` directory, preserving ownership and permissions. Inspect the archives before extraction and use only backups you control. Run `docker compose create` to create empty volumes. Use `docker inspect` on those containers to find the NEW named volumes for `/var/data/courier`, `/etc/stalwart`, and `/var/lib/stalwart`. Restore their corresponding `app-data.tar.gz`, `mail-config.tar.gz`, and `mail-data.tar.gz` archives only into empty volumes.

Follow the archive names present in the backup rather than assuming old Docker volume names. Never overwrite an existing production volume during a rehearsal. Preserve APP_SECRET exactly or encrypted mailbox sessions cannot be recovered. Recreate containers, verify users, mailboxes, message counts, authentication, queues, and TLS before pointing DNS at a restored host.

## Moving existing Render data

Keep Render running while preparing this server. If it contains real accounts, arrange a maintenance window and stop writes before the final transfer. Use the SQLite online-backup API from `scripts/backup-app.mjs` against Render's persistent DATA_DIR. Copy the resulting backup securely to the stopped Netcup app volume as `courier.sqlite`, with ownership matching the container's `node` user. Do not copy only a live WAL database file. Transfer the existing APP_SECRET securely into `secrets/app_secret` before starting the app. Preserve any existing Stalwart stores separately if migrating mail too.

Set the new HTTPS origins and provider URLs, restart, test existing sign-in and mailbox access, then switch DNS. Retain a verified rollback backup. Stop paid Render resources only after successful cutover and explicit approval for that separate action.

## Launch verification

- Confirm SMTP inbound and outbound connectivity from external hosts and verify PTR, SPF, DKIM, and DMARC results.
- Send and receive with Gmail and Outlook, including attachments, replies, Sent placement, and delivery retries.
- Verify an unauthenticated external relay attempt is rejected and authenticated submission succeeds with TLS.
- Check tenant isolation, invitations, mailbox quotas, suspension, and password changes through Zavrill.
- Test ports 465, 587 and 993 with `openssl s_client`, checking hostname, certificate chain, and expiration.
- Verify bootstrap access is disabled, secrets remain private, the backup restores successfully, and renewal runs automatically.
- Monitor disk space, the mail queue, failed authentication, abuse rates, container health, certificate expiry, and off-server backups.

This is deployment preparation. A Netcup runtime, certificate issuance, DNS, real mail delivery, and restore rehearsal remain unverified until the server and domain exist. Desktop and mobile remain installable web apps.

References include [Stalwart Docker installation](https://stalw.art/docs/install/platform/docker/), [Caddy and Stalwart certificate sharing](https://stalw.art/docs/server/reverse-proxy/caddy/), and [Netcup firewall documentation](https://www.netcup.com/en/helpcenter/documentation/server/firewall).
