#!/bin/sh
set -e

echo "Starting Perplexica..."
cd /home/perplexica
exec npx next start
