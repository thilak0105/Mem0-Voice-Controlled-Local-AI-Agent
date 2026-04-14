#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Checking Ollama service..."
if curl -sS "http://localhost:11434/api/tags" >/dev/null 2>&1; then
  echo "Ollama is already running on port 11434"
  OLLAMA_STARTED_BY_SCRIPT=0
else
  echo "Starting Ollama in background..."
  ollama serve > "$ROOT_DIR/.ollama.log" 2>&1 &
  OLLAMA_PID=$!
  OLLAMA_STARTED_BY_SCRIPT=1
  echo "Ollama PID: $OLLAMA_PID"
fi

cleanup() {
  echo "Stopping services..."
  if [[ -n "${UVICORN_PID:-}" ]]; then
    kill "$UVICORN_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${VITE_PID:-}" ]]; then
    kill "$VITE_PID" >/dev/null 2>&1 || true
  fi
  if [[ "${OLLAMA_STARTED_BY_SCRIPT:-0}" -eq 1 ]] && [[ -n "${OLLAMA_PID:-}" ]]; then
    kill "$OLLAMA_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "[2/3] Starting FastAPI backend on port 8000..."
uvicorn backend.main:app --reload --port 8000 > "$ROOT_DIR/.backend.log" 2>&1 &
UVICORN_PID=$!
echo "Backend PID: $UVICORN_PID"

echo "[3/3] Starting Vite frontend on port 5173..."
(
  cd "$ROOT_DIR/frontend"
  npm run dev
) > "$ROOT_DIR/.frontend.log" 2>&1 &
VITE_PID=$!
echo "Frontend PID: $VITE_PID"

echo "Services started."
echo "Backend logs: $ROOT_DIR/.backend.log"
echo "Frontend logs: $ROOT_DIR/.frontend.log"
if [[ "${OLLAMA_STARTED_BY_SCRIPT:-0}" -eq 1 ]]; then
  echo "Ollama logs: $ROOT_DIR/.ollama.log"
fi

echo "Press Ctrl+C to stop all services."
wait
