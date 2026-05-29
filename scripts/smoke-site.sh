#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://aistatusdashboard.com}"

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

curl -fsSL "$BASE_URL/" -o "$tmpfile"
grep -q "Is your AI working\?" "$tmpfile"
grep -q "Updated" "$tmpfile"
grep -q "Developer? Use the API / MCP / Datasets" "$tmpfile"

curl -fsS "$BASE_URL/changelog" -o /dev/null
curl -fsS "$BASE_URL/og.png" -o /dev/null
curl -fsS "$BASE_URL/favicon.ico" -o /dev/null

echo "Smoke checks passed for $BASE_URL"
