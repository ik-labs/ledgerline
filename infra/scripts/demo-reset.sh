#!/usr/bin/env bash
# Reset the ledger to a clean demo baseline between recording takes:
#   - clears all usage_events and invoices
#   - re-seeds the rate card + customers (idempotent)
#   - re-seeds the current-cycle baseline events
#
# Usage:  infra/scripts/demo-reset.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DSQL="$HERE/dsql.sh"

echo "Clearing usage_events + invoices…"
"$DSQL" -q -c "DELETE FROM invoices; DELETE FROM usage_events;" >/dev/null

echo "Re-seeding rate card + customers…"
"$DSQL" -q -f "$ROOT/sql/seed.sql" >/dev/null

echo "Re-seeding current-cycle baseline events…"
"$DSQL" -q -f "$ROOT/sql/seed-events.sql" >/dev/null

echo "Done. Current state:"
"$DSQL" -c "SELECT (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM usage_events) AS events, (SELECT count(*) FROM invoices) AS invoices;"
