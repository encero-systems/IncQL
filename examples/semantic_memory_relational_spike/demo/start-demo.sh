#!/bin/sh
set -eu

port="${1:-8794}"
root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$root"
