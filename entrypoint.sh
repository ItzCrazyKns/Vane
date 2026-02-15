#!/bin/sh
set -e

# Ensure data directories exist and are writable
mkdir -p /home/perplexica/data /home/perplexica/uploads

# Determine target UID/GID: use PUID/PGID env vars, fall back to 1000
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Create/update the perplexica group and user if not running as that UID already
if [ "$(id -u)" = "0" ]; then
  # Running as root — fix ownership and drop privileges
  groupmod -o -g "$PGID" node 2>/dev/null || true
  usermod -o -u "$PUID" -g "$PGID" node 2>/dev/null || true
  chown -R "$PUID:$PGID" /home/perplexica/data /home/perplexica/uploads

  echo "Starting SearXNG..."
  sudo -H -u searxng bash -c "cd /usr/local/searxng/searxng-src && export SEARXNG_SETTINGS_PATH='/etc/searxng/settings.yml' && export FLASK_APP=searx/webapp.py && /usr/local/searxng/searx-pyenv/bin/python -m flask run --host=0.0.0.0 --port=8080" &
  SEARXNG_PID=$!

  echo "Waiting for SearXNG to be ready..."
  sleep 5

  COUNTER=0
  MAX_TRIES=30
  until curl -s http://localhost:8080 > /dev/null 2>&1; do
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -ge $MAX_TRIES ]; then
      echo "Warning: SearXNG health check timeout, but continuing..."
      break
    fi
    sleep 1
  done

  if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "SearXNG started successfully (PID: $SEARXNG_PID)"
  else
    echo "SearXNG may not be fully ready, but continuing (PID: $SEARXNG_PID)"
  fi

  cd /home/perplexica
  echo "Starting Perplexica as UID=$PUID GID=$PGID..."
  exec gosu "$PUID:$PGID" node server.js
else
  # Already running as non-root (e.g. docker compose user: directive)
  cd /home/perplexica
  echo "Starting Perplexica..."
  exec node server.js
fi
