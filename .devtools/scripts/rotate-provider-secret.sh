#!/bin/sh
# Adds the next PROVIDER_KEY_SECRET_V<n> to a Worker. New keys are sealed with it at once, and the
# older versions keep opening what they sealed, so nobody loses their key (ADR-0008).
set -eu

case "${1:-}" in
    development | production) worker="lineup-$1" ;;
    *)
        echo "usage: $0 development|production" >&2
        exit 1
        ;;
esac

cd "$(dirname "$0")/../../apps/web"

# In two steps, as a failed list inside a pipeline would read as no versions and overwrite V1.
secrets=$(pnpm --silent exec wrangler secret list --name "$worker" --format json)
latest=$(printf '%s' "$secrets" | grep -o 'PROVIDER_KEY_SECRET_V[0-9]*' | sed 's/.*V//' | sort -n | tail -1)
next=$((${latest:-0} + 1))

# AES-256 takes exactly 32 bytes, so a longer value would stop the Worker sealing anything.
secret=$(openssl rand -base64 32)
printf '%s' "$secret" | pnpm exec wrangler secret put "PROVIDER_KEY_SECRET_V$next" --name "$worker"

echo "$worker now seals with V$next."
[ -z "${latest:-}" ] || echo "Delete V$latest in 30 days, when the last cookie it sealed has expired."
