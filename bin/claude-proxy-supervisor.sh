#!/bin/bash
# Auto-restart supervisor for claude-max-proxy
# Restarts the proxy if it crashes (e.g., after concurrent request cleanup)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

while true; do
  echo "[supervisor] Starting proxy..."
  CLAUDE_PROXY_PASSTHROUGH="${CLAUDE_PROXY_PASSTHROUGH:-1}" bun run ./bin/claude-proxy.ts
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[supervisor] Proxy exited cleanly."
    break
  fi
  
  echo "[supervisor] Proxy exited with code $EXIT_CODE. Restarting in 1s..."
  sleep 1
done
