#!/bin/bash
set -e

# PDM installs into .venv — put it on PATH so gunicorn / celery / python
# resolve from the virtualenv without needing `pdm run`.
export PATH="/app/.venv/bin:$PATH"

# Decide whether this instance runs Celery (RUN_CELERY, issue #2352). Same
# helper and log line as backend/start_backend.sh.
. /app/run_celery.sh

echo "backend-entrypoint: running database migrations…"
python manage.py migrate --noinput

echo "backend-entrypoint: starting gunicorn (HTTP + WebSocket) on :8000…"
gunicorn --preload --bind=0.0.0.0:8000 \
    climateconnect_main.asgi:application \
    -w 4 -k uvicorn.workers.UvicornWorker &
GUNICORN_PID=$!

if [ "$RUN_CELERY_ENABLED" = 1 ]; then
    # Lookup-queue worker: exactly one process (see
    # doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md).
    echo "backend-entrypoint: starting celery lookup worker (queue=lookup)…"
    celery -A climateconnect_main worker -Q lookup -c 4 -l INFO &

    # Default worker + embedded beat scheduler.  Runs in the foreground so the
    # container lives and dies with this process.
    echo "backend-entrypoint: starting celery default worker + beat…"
    exec celery -A climateconnect_main worker -B -l INFO
fi

# RUN_CELERY=false: no Celery worker and no beat, because the broker and the DB
# are shared with the instance that runs Celery. The container lives and dies
# with the web server instead. Bash as PID 1 does not pass the stop signal on,
# so forward it to gunicorn. The signal interrupts `wait`, so keep waiting while
# gunicorn is still alive: exiting early would kill it mid graceful shutdown.
echo "backend-entrypoint: Celery disabled (RUN_CELERY=false)"
trap 'kill -TERM "$GUNICORN_PID" 2>/dev/null' TERM INT
status=0
wait "$GUNICORN_PID" || status=$?
while kill -0 "$GUNICORN_PID" 2>/dev/null; do
    status=0
    wait "$GUNICORN_PID" || status=$?
done
exit "$status"
