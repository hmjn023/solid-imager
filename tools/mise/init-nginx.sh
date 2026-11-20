#!/bin/sh
set -eu

config="${NGINX_CONFIG:-nginx.dev.conf.example}"
if [ ! -f "$config" ]; then
    printf 'nginx config file missing: %s\n' "$config" >&2
    exit 1
fi

# mise container volumes need fixed mount source paths.
mkdir -p .data/mise-nginx/empty-certs
ln -sfnT "$(realpath "$config")" .data/mise-nginx/nginx.conf

certs="$HOME/.config/letsencrypt"
if [ -z "${NGINX_CONFIG:-}" ] || [ ! -d "$certs" ]; then
    certs="$PWD/.data/mise-nginx/empty-certs"
fi
ln -sfnT "$certs" .data/mise-nginx/letsencrypt
