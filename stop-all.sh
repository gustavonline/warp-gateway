#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"

if [[ ! -d "$RUN_DIR" ]]; then
  echo "No .run directory found. Nothing to stop."
  exit 0
fi

for name in ngrok gateway chatmock; do
  pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 0.3
      kill -9 "$pid" >/dev/null 2>&1 || true
      echo "Stopped $name (PID $pid)"
    else
      echo "$name was not running"
    fi
    rm -f "$pid_file"
  fi
done
rm -f "$RUN_DIR/endpoint.txt"
echo "Done."
