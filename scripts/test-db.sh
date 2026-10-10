#!/usr/bin/env bash
# Applies every migration to a fresh database and runs the SQL tests.
# Needs DATABASE_URL pointing at a Postgres server where it may create and drop
# the database tailhelm_test, e.g. postgres://postgres:postgres@localhost:5432/postgres
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?Set DATABASE_URL to a Postgres server for tests}"
TEST_DB=tailhelm_test
TEST_URL="${DATABASE_URL%/*}/$TEST_DB"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$DATABASE_URL" -c "drop database if exists $TEST_DB" -c "create database $TEST_DB"
"${PSQL[@]}" "$TEST_URL" -f supabase/tests/supabase-shim.sql
for migration in supabase/migrations/*.sql; do
  "${PSQL[@]}" "$TEST_URL" -f "$migration"
done
for test in supabase/tests/*.test.sql; do
  echo "• $test"
  "${PSQL[@]}" "$TEST_URL" -c "begin" -f "$test" -c "rollback"  # each test starts from the same empty database
done
echo "✓ database tests passed"
