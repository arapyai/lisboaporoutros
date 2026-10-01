#!/usr/bin/env bash
# Uses the existing private PostgreSQL runner; no production data or paid providers.
set -euo pipefail
export LISBOA_TEST_BROWSER_JOURNEY=1
exec bash "$(dirname -- "${BASH_SOURCE[0]}")/test-postgres-ux.sh" "$@"
