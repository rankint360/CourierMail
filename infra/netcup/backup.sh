#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")"
exec 9>.maintenance.lock
flock -n 9
destination="$(pwd)/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$destination"
running="$(docker compose ps --services --status running)"
test -n "$running"
docker pull alpine:3.22 >/dev/null
# Resolve volumes before stopping. Never assume Compose's project prefix.
for pair in app:app-data:/var/data/courier mail:mail-config:/etc/stalwart mail:mail-data:/var/lib/stalwart; do
  service="${pair%%:*}"; rest="${pair#*:}"; label="${rest%%:*}"; mount="${rest#*:}"
  cid="$(docker compose ps -aq "$service")"
  test -n "$cid"
  volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "'"$mount"'"}}{{.Name}}{{end}}{{end}}' "$cid")"
  test -n "$volume"
  printf '%s %s\n' "$volume" "$label" >> "$destination/volumes.txt"
done
restore_running() { docker compose start $running; }
trap restore_running EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
docker compose stop
while read -r volume label; do
  docker run --rm -v "$volume:/source:ro" -v "$destination:/backup" alpine:3.22 tar -czf "/backup/$label.tar.gz" -C /source .
done < "$destination/volumes.txt"
tar -czf "$destination/host-config.tar.gz" .env secrets tls caddy-data
cp compose.yaml Caddyfile "$destination/"
(cd "$destination" && sha256sum ./*.tar.gz > SHA256SUMS)
echo "Cold backup saved in $destination. Encrypt and copy it off this VPS."
