#!/bin/sh
set -eu

case "${DB_HOST:-${PGHOST:-}}" in
    127.0.0.1|localhost) ;;
    *)
        printf '%s\n' 'Set DB_HOST=127.0.0.1 in the root .env for mise Daemons.' >&2
        exit 1
        ;;
esac

exec bun run --cwd apps/server db:migrate
