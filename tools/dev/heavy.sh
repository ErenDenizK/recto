#!/usr/bin/env sh
# Runs a heavy local command (a build, an e2e run, the full unit suite) under a shared lock, so
# parallel worktrees on one machine take turns instead of starving each other of CPU and memory.
# Usage: tools/dev/heavy.sh pnpm build
#        RECTO_HEAVY_SLOTS=2 tools/dev/heavy.sh pnpm exec playwright test e2e/x.spec.ts
# Slots default to 1; each slot is one lock file under the system temp directory.
set -eu
slots="${RECTO_HEAVY_SLOTS:-1}"
dir="${TMPDIR:-/tmp}/recto-heavy"
mkdir -p "$dir"
i=0
while :; do
  n=$((i % slots))
  exec 9>"$dir/slot-$n.lock"
  if flock -n 9; then
    exec "$@"
  fi
  i=$((i + 1))
  if [ "$n" -eq $((slots - 1)) ]; then
    flock 9 && exec "$@"
  fi
done
