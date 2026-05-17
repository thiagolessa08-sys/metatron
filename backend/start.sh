#!/bin/sh
set -e

echo "[start.sh] Python version: $(python --version)"
echo "[start.sh] DATABASE_URL prefix: $(echo $DATABASE_URL | cut -c1-20)..."
echo "[start.sh] PORT: $PORT"

echo "[start.sh] Running alembic upgrade head..."
alembic upgrade head 2>&1
echo "[start.sh] Migrations complete."

echo "[start.sh] Starting uvicorn on port $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info 2>&1
