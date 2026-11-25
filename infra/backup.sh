#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")"
backup_dir="$(pwd)/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
container_id="$(docker compose ps -q mail)"
test -n "$container_id"
config_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/stalwart"}}{{.Name}}{{end}}{{end}}' "$container_id")"
data_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/stalwart"}}{{.Name}}{{end}}{{end}}' "$container_id")"
test -n "$config_volume"
test -n "$data_volume"
# Stop the mail engine so its embedded database files form a consistent snapshot.
docker compose stop mail
trap 'docker compose start mail' EXIT HUP INT TERM
docker run --rm -v "$config_volume:/source:ro" -v "$backup_dir:/backup" alpine:3.22 tar -czf /backup/config.tar.gz -C /source .
docker run --rm -v "$data_volume:/source:ro" -v "$backup_dir:/backup" alpine:3.22 tar -czf /backup/data.tar.gz -C /source .
printf 'Mail backup saved to %s\n' "$backup_dir"
