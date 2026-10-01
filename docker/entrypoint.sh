#!/bin/sh
# Make sure the data volume is writable (v1 created it as root), then drop
# root privileges and run the app as the unprivileged "node" user.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}" 2>/dev/null || true
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
