#!/bin/bash
set -euo pipefail # http://redsymbol.net/articles/unofficial-bash-strict-mode/

# installs deps and creates the .env files with the minimal configuration for development
# this script is automatically run in VS Code Dev Containers via `postCreateCommand`

cd "$(dirname "$0")" # go to dir this script is in

./install_deps.sh

if [[ ! -f frontend/.env ]]; then
    cat >frontend/.env <<EOF
API_HOST="localhost"
API_URL="http://127.0.0.1:8000"
BASE_URL_HOST="localhost"
SOCKET_URL="ws://localhost"
ENVIRONMENT="development"
EOF
else
    echo frontend/.env already exists
fi

SECRET_KEY="$(openssl rand -base64 32)"

if [[ ! -f backend/.backend_env ]]; then
    cat > backend/.backend_env <<EOF
FRONTEND_URL=http://localhost:3000
SECRET_KEY=$SECRET_KEY

ALLOWED_HOSTS=http://localhost:8000
ENVIRONMENT=development

MEDIA_ROOT=/workspaces/climateconnect/backend/media
DEBUG=True
AUTO_VERIFY=True
LOCATION_SERVICE_BASE_URL=https://nominatim.openstreetmap.org
CELERY_BROKER_URL=redis://redis

# LocationIQ autocomplete
LOCATIONIQ_API_KEY=

CACHE_BACHED_RANK_REQUEST=true

DATABASE_NAME=backend
DATABASE_USER=backend
DATABASE_PASSWORD=backend
DATABASE_HOST=db
DATABASE_PORT=5432

# REDIS_HOST=redis
# REDIS_PORT=6379
# REDIS_PASSWORD=''
REDIS_URL=redis://redis:6379
EOF
else
    echo backend/.backend_env already exists
fi

pushd backend
source .venv/bin/activate
make migrate
make test-data
popd
