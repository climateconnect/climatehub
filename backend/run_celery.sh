# Shared RUN_CELERY handling, sourced (not executed) by backend/start_backend.sh
# and docker/backend-entrypoint.sh. Keep it POSIX sh: start_backend.sh runs
# under dash.
#
# RUN_CELERY decides whether this instance starts the Celery workers and beat.
# The App Service slots share the broker and the DB, so only production may run
# them; slot2 has a slot-sticky RUN_CELERY=false and only serves the web app
# (issue #2352, doc/spec/20261026_1130_issue_2352_no_celery_on_backend_slot2.md).
#
#   true  -> the Celery workers (lookup and default) and beat
#   false -> no Celery at all; gunicorn runs as usual
#
# Values are case-insensitive and trimmed. A missing or unknown value runs
# Celery (an unknown one with a warning), so a typo can never leave production
# without its workers.
#
# Sets RUN_CELERY_ENABLED (1|0) and prints the single "RUN_CELERY: celery=..."
# line that the runbook greps for.

RUN_CELERY_RAW=${RUN_CELERY-}
RUN_CELERY_VALUE=$(printf '%s' "$RUN_CELERY_RAW" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

case $RUN_CELERY_VALUE in
  true)
    RUN_CELERY_ENABLED=1
    RUN_CELERY_REASON="value '$RUN_CELERY_RAW'"
    ;;
  false)
    RUN_CELERY_ENABLED=0
    RUN_CELERY_REASON="value '$RUN_CELERY_RAW'"
    ;;
  "")
    RUN_CELERY_ENABLED=1
    RUN_CELERY_REASON="not set, default"
    ;;
  *)
    RUN_CELERY_ENABLED=1
    RUN_CELERY_REASON="unknown value '$RUN_CELERY_RAW', treated as true"
    echo "WARN(RUN_CELERY): unknown value '$RUN_CELERY_RAW' (expected true or false), starting Celery" >&2
    ;;
esac

if [ "$RUN_CELERY_ENABLED" = 1 ]; then
  echo "RUN_CELERY: celery=on ($RUN_CELERY_REASON)"
else
  echo "RUN_CELERY: celery=off ($RUN_CELERY_REASON)"
fi
