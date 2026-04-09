#!/bin/sh
set -e
# Named volume is often root-owned; worker runs as node and needs HF/transformers cache.
mkdir -p /app/.cache
chown -R node:node /app/.cache
exec runuser -u node -- "$@"
