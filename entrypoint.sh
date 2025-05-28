#!/bin/sh
set -e

node migrate.js

exec node server.js