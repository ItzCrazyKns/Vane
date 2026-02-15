#!/bin/sh
set -e

# Ensure data directories exist and are writable
mkdir -p /home/perplexica/data /home/perplexica/uploads

# Determine target UID/GID: use PUID/PGID env vars, fall back to 1000
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

cd /home/perplexica

if [ "$(id -u)" = "0" ]; then
  # Running as root — fix ownership and drop privileges
  groupmod -o -g "$PGID" node 2>/dev/null || true
  usermod -o -u "$PUID" -g "$PGID" node 2>/dev/null || true
  chown -R "$PUID:$PGID" /home/perplexica/data /home/perplexica/uploads

  echo "Starting Perplexica as UID=$PUID GID=$PGID..."
  exec gosu "$PUID:$PGID" node server.js
else
  # Already running as non-root
  echo "Starting Perplexica..."
  exec node server.js
fi
