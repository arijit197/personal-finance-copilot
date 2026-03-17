#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/arijidas/Documents/Project/some"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

echo "[1/3] Running backend end-to-end automated tests..."
cd "$ROOT_DIR"
"$PYTHON_BIN" -m unittest -v tests.test_full_project

echo "[2/3] Running frontend production build check..."
cd "$ROOT_DIR/frontend"
npm run build

echo "[3/3] Automated checks completed successfully ✅"
