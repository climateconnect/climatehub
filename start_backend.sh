
# Install spatial dependencies
apt-get update -qq && apt-get install binutils libproj-dev gdal-bin -yqq

# Install pdm
pip install pdm

# Go to backend folder
cd backend

# install dependencies
pdm install

# activate venv
$(pdm venv activate)

# Start server
gunicorn --preload --bind=0.0.0.0 climateconnect_main.asgi:application -w 4 -k uvicorn.workers.UvicornWorker &

# Worker for the `lookup` queue. CELERY_TASK_ROUTES routes
# location.tasks.fetch_autocomplete there, so without this worker nothing
# consumes location autocomplete jobs and every lookup falls back to the
# slow inline path in LocationAutocompleteView.
celery -A climateconnect_main worker -Q lookup -c 4 -l INFO &

# Default worker (+ embedded beat). Stays in the foreground so the container
# lives and dies with it, as before.
celery -A climateconnect_main worker -B -l INFO
