#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://aistatusdashboard.com"
assets=(
  "logo-mark.svg"
  "logo-wordmark.svg"
)

for asset in "${assets[@]}"; do
  url="${BASE_URL}/brand/${asset}"
  headers=$(curl -sSI "$url")
  status=$(echo "$headers" | head -n 1 | awk '{print $2}')
  if [ "$status" != "200" ]; then
    echo "Brand asset check failed: ${url} returned ${status}"
    exit 1
  fi

  content_type=$(echo "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tail -n 1)
  if [[ "$content_type" != *"image/svg"* ]]; then
    echo "Brand asset check failed: ${url} content-type ${content_type}"
    exit 1
  fi

  body_len=$(curl -sSL "$url" | wc -c | tr -d ' ')
  if [ "$body_len" -le 100 ]; then
    echo "Brand asset check failed: ${url} body length ${body_len}"
    exit 1
  fi
done

echo "Brand asset checks passed."
