#!/bin/sh
set -e

echo "Starting SearXNG..."

# Run SearXNG as the searxng user with a clean environment (what
# "sudo -H -u searxng" did before; sudo is no longer in the image).
(
  cd /usr/local/searxng/searxng-src
  exec setpriv --reuid=searxng --regid=searxng --init-groups \
    env -i \
      HOME=/usr/local/searxng USER=searxng LOGNAME=searxng SHELL=/bin/bash \
      PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
      ${LANG:+LANG="$LANG"} \
      SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml \
      FLASK_APP=searx/webapp.py \
    /usr/local/searxng/searx-pyenv/bin/python -m flask run --host=0.0.0.0 --port=8080
) &
SEARXNG_PID=$!

echo "Waiting for SearXNG to be ready..."

# Poll every 250 ms for up to 30 s (curl is no longer in the image).
if node -e '
  const deadline = Date.now() + 30000;
  (async function probe() {
    try {
      await fetch("http://localhost:8080");
      process.exit(0);
    } catch {}
    if (Date.now() > deadline) process.exit(1);
    setTimeout(probe, 250);
  })();
'; then
  echo "SearXNG started successfully (PID: $SEARXNG_PID)"
else
  echo "Warning: SearXNG health check timeout, but continuing..."
  echo "SearXNG may not be fully ready, but continuing (PID: $SEARXNG_PID)"
fi

cd /home/vane
echo "Starting Vane..."

exec node server.js
