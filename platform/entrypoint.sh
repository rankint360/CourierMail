#!/bin/sh
set -eu
mkdir -p "${DATA_DIR:-/var/data/courier}"
chown node:node "${DATA_DIR:-/var/data/courier}"
# Compose file secrets may be root-owned bind mounts. Copy only the two
# application secrets into a private runtime directory before dropping root.
mkdir -p /run/courier-secrets
chmod 700 /run/courier-secrets
chown node:node /run/courier-secrets
if [ -n "${APP_SECRET_FILE:-}" ]; then
  install -o node -g node -m 0400 "$APP_SECRET_FILE" /run/courier-secrets/app_secret
  export APP_SECRET_FILE=/run/courier-secrets/app_secret
fi
if [ -n "${MAIL_ADMIN_TOKEN_FILE:-}" ]; then
  install -o node -g node -m 0400 "$MAIL_ADMIN_TOKEN_FILE" /run/courier-secrets/mail_admin_token
  export MAIL_ADMIN_TOKEN_FILE=/run/courier-secrets/mail_admin_token
fi
exec su -m -s /bin/sh node -c 'exec node platform/server.mjs'
