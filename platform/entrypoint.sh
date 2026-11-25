#!/bin/sh
set -eu
mkdir -p "${DATA_DIR:-/var/data/courier}"
chown node:node "${DATA_DIR:-/var/data/courier}"
exec su -m -s /bin/sh node -c 'exec node platform/server.mjs'
