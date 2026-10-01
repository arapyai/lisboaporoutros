#!/usr/bin/env bash
# Run inside: nix develop ./backend --command bash scripts/test-postgres-ux.sh
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_cluster="$(mktemp -d /tmp/lisboa-ux-postgres.XXXXXXXX)"
chmod 700 "$test_cluster"
cleanup() {
  if [[ -f "$test_cluster/data/postmaster.pid" ]]; then
    pg_ctl -D "$test_cluster/data" -m fast -w stop
  fi
  # Retain only this synthetic cluster/log for diagnosis; never copy remote data.
  printf 'Synthetic test cluster retained (stopped): %s\n' "$test_cluster"
}
trap cleanup EXIT
initdb -D "$test_cluster/data" --auth=trust --no-locale -E UTF8 > "$test_cluster/init.log"
pg_ctl -D "$test_cluster/data" -l "$test_cluster/server.log" \
  -o "-F -k $test_cluster -p 55435 -c listen_addresses='' -c max_connections=20" -w start
export LISBOA_TEST_POSTGRES_SOCKET="$test_cluster"
cd "$repo_dir/backend"
uv run pytest tests/postgres --no-cov "$@"
