#!/bin/sh
set -eu

case "${DB_HOST:-}:${DB_PORT:-}" in
    127.0.0.1:55432|localhost:55432) ;;
    *)
        printf '%s\n' 'Set DB_HOST=127.0.0.1 and DB_PORT=55432 in the root .env for mise Daemons.' >&2
        exit 1
        ;;
esac

exec bun run --cwd apps/server db:migrate
