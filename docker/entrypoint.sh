#!/bin/sh
# node_modules lives in a named volume so it survives restarts and stays out of the
# host bind mount. A volume created from an older image keeps its old contents even
# after a rebuild, so reconcile it against the lockfile before handing over.
set -e

hash_file="node_modules/.deps-hash"
current="$(md5sum package.json pnpm-lock.yaml | md5sum | cut -d' ' -f1)"

if [ ! -f "$hash_file" ] || [ "$(cat "$hash_file")" != "$current" ]; then
  echo "==> node_modules is out of date with the lockfile, installing"
  pnpm install --frozen-lockfile
  printf '%s' "$current" > "$hash_file"
fi

exec "$@"
