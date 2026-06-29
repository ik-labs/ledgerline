#!/usr/bin/env bash
# Connect to Aurora DSQL with a freshly-minted IAM auth token.
#
# Usage:
#   infra/scripts/dsql.sh                      # interactive psql shell
#   infra/scripts/dsql.sh -f sql/schema.sql    # run a file
#   infra/scripts/dsql.sh -c "SELECT 1"        # run one statement
#
# Env (override as needed):
#   DSQL_ENDPOINT  DSQL cluster endpoint host
#   DSQL_DATABASE  database name (default: postgres)
#   DSQL_USER      role (default: admin)
#   AWS_REGION     region (default: us-east-1)
set -euo pipefail

DSQL_ENDPOINT="${DSQL_ENDPOINT:-ijt4jtjkn7oxftooklnuliggna.dsql.us-east-1.on.aws}"
DSQL_DATABASE="${DSQL_DATABASE:-postgres}"
DSQL_USER="${DSQL_USER:-admin}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Token is short-lived (~15 min). Mint a fresh one each invocation.
PGPASSWORD="$(aws dsql generate-db-connect-admin-auth-token \
  --hostname "$DSQL_ENDPOINT" \
  --region "$AWS_REGION")"
export PGPASSWORD

exec psql \
  "host=$DSQL_ENDPOINT port=5432 dbname=$DSQL_DATABASE user=$DSQL_USER sslmode=require" \
  "$@"
