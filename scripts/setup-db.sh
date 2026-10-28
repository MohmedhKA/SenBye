#!/usr/bin/env bash
set -e

echo "Setting up local PostgreSQL databases for SenBye..."
psql -U mohmedh -d postgres -c "CREATE DATABASE senbye;" 2>/dev/null || true
psql -U mohmedh -d postgres -c "CREATE DATABASE senbye_test;" 2>/dev/null || true
psql -U mohmedh -d senbye -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true
psql -U mohmedh -d senbye_test -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true
echo "SenBye PostgreSQL setup complete."
