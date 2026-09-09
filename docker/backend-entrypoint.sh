#!/bin/bash
set -e

# PDM installs into .venv — put it on PATH so gunicorn / celery / python
# resolve from the virtualenv without needing `pdm run`.
export PATH="/app/.venv/bin:$PATH"

echo "backend-entrypoint: running database migrations…"
python manage.py migrate --noinput

echo "backend-entrypoint: starting gunicorn (HTTP + WebSocket) on :8000…"
gunicorn --preload --bind=0.0.0.0:8000 \
    climateconnect_main.asgi:application \
    -w 4 -k uvicorn.workers.UvicornWorker &

# Lookup-queue worker: exactly one process (see
# doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md).
echo "backend-entrypoint: starting celery lookup worker (queue=lookup)…"
celery -A climateconnect_main worker -Q lookup -c 4 -l INFO &

# Default worker + embedded beat scheduler.  Runs in the foreground so the
# container lives and dies with this process.
echo "backend-entrypoint: starting celery default worker + beat…"
exec celery -A climateconnect_main worker -B -l INFO
