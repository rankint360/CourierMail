#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")"
# flock prevents a renewal job racing a cold backup.
exec 9>.maintenance.lock
flock -n 9
host="$(docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["proxy"]["environment"]["MAIL_HOSTNAME"])')"
case "$host" in ''|*[!a-z0-9.-]*) echo 'Invalid mail hostname' >&2; exit 1;; esac
source="caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$host/$host"
test -s "$source.crt"
test -s "$source.key"
# Validate expiration and key pairing before replacing the deployed pair.
openssl x509 -in "$source.crt" -checkend 604800 -noout
cert_key="$(openssl x509 -in "$source.crt" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum)"
private_key="$(openssl pkey -in "$source.key" -pubout -outform DER | sha256sum)"
test "$cert_key" = "$private_key"
if cmp -s "$source.crt" tls/mail.crt && cmp -s "$source.key" tls/mail.key; then exit 0; fi
# Mail is stopped while the pair changes. A failed copy stays stopped for operator recovery.
docker compose stop mail
install -m 0644 "$source.crt" tls/mail.crt
install -m 0600 "$source.key" tls/mail.key
docker compose start mail
echo 'Mail TLS pair refreshed and Stalwart restarted.'
