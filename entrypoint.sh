#!/bin/sh
set -e

cd /usr/local/searxng
export SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml

# Start SearXNG in background with all output redirected to /dev/null
/usr/local/searxng/venv/bin/uwsgi \
  --http-socket 0.0.0.0:8080 \
  --ini /etc/searxng/uwsgi.ini \
  --virtualenv /usr/local/searxng/venv \
  --disable-logging > /dev/null 2>&1 &

echo "Starting SearXNG..."
sleep 5

until curl -s http://localhost:8080 > /dev/null 2>&1; do
  sleep 1
done
echo "SearXNG started successfully"

cd /home/perplexica
echo "Starting Perplexica..."
exec node server.js