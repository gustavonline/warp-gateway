#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"

echo "Warp Gateway status"
for name in chatmock gateway ngrok; do
  pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name running (PID $pid)"
    else
      echo "$name pid file exists but process is not running"
    fi
  else
    echo "$name not started by run-background.sh"
  fi
done

if curl -fsS http://127.0.0.1:8320/health >/dev/null 2>&1; then
  models="$(curl -fsS http://127.0.0.1:8320/health | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s); console.log((j.models||[]).join(", "))})')"
  echo "Gateway health OK. Models: $models"
else
  echo "Gateway health failed"
fi

endpoint="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);const t=(j.tunnels||[]).find(t=>t.proto==="https"); if(t) console.log(t.public_url+"/v1");}catch{}})' || true)"
if [[ -n "$endpoint" ]]; then
  echo "ngrok endpoint: $endpoint"
else
  echo "ngrok API not reachable or no HTTPS tunnel"
fi
