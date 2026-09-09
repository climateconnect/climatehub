#!/bin/bash
# Production startup script for the Azure App Service backend.
# Runs on EVERY cold start, inside the App Service "blessed" Python image.

# NOTE: Azure runs this via `sh backend/start_backend.sh` (see the site's
# appCommandLine), and /bin/sh is dash, which has no `pipefail` -- using it
# aborts the whole script with "Illegal option -o pipefail" (exit 2). Keep
# everything in here POSIX sh compatible.
set -u

die() { echo "FATAL(start_backend): $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# System (spatial) dependencies
#
# Debian 11 (bullseye), the base of the App Service Python 3.12 image, is
# end-of-life: the bullseye-security Release file stopped being refreshed and
# expired on 2026-09-07. `apt-get update` then exits non-zero, and because the
# old script chained update && install, the GDAL install was silently skipped
# and Django's contrib.gis died at import time with "Could not find the GDAL
# library" (container exit 1, startup probe timeout).
#
# Both bullseye repos are still served by deb.debian.org, and bullseye `main`
# (where gdal/proj live) carries no Valid-Until at all -- only the security
# suite is expired. So disabling the Valid-Until check is enough. Do NOT
# repoint at archive.debian.org: it has no debian-security/bullseye-security
# suite (HTTP 404), which makes `apt-get update` fail outright.
#
# This is a stopgap for a dead distro -- see
# doc/spec/20260826_1138_container_based_deployment_pipeline.md for the
# container-based deployment that removes cold-start apt entirely.
# ---------------------------------------------------------------------------
if [ -r /etc/os-release ] && grep -q 'VERSION_CODENAME=bullseye' /etc/os-release; then
  echo "start_backend: Debian bullseye (EOL) detected, ignoring expired Release stamps"
  APT_OPTS="-o Acquire::Check-Valid-Until=false"
else
  APT_OPTS=""
fi

# A failing update is not necessarily fatal (install can still succeed from
# whatever lists were fetched), so warn here and let the libgdal/libgeos
# assertions below be the real gate.
# shellcheck disable=SC2086
apt-get $APT_OPTS update -qq || echo "WARN(start_backend): apt-get update reported errors, continuing" >&2
# shellcheck disable=SC2086
apt-get $APT_OPTS install -yqq \
  binutils \
  libproj-dev \
  gdal-bin \
  libgdal-dev \
  || die "apt-get install of spatial dependencies failed"

# Fail fast and loudly here rather than 40s later inside django.setup().
ldconfig -p | grep -q libgdal   || die "libgdal not present after apt install"
ldconfig -p | grep -q libgeos_c || die "libgeos_c not present after apt install"
echo "start_backend: spatial libraries OK"

# ---------------------------------------------------------------------------
# Python dependencies
#
# Oryx has already created and activated the virtualenv named "antenv" and put
# it on PATH/PYTHONPATH. pdm detects it ("Inside an active virtualenv ...,
# reusing it") and installs into it, so there is no venv to activate here.
# ---------------------------------------------------------------------------
# Newer Debian bases mark the system Python as externally managed (PEP 668),
# where a plain `pip install` is refused; the fallback keeps this working if
# the App Service image is ever rolled forward.
pip install --quiet pdm \
  || pip install --quiet --break-system-packages pdm \
  || die "pip install pdm failed"

cd backend || die "backend/ not found (cwd=$(pwd))"
pdm install || die "pdm install failed"

# Smoke-test the spatial stack with the interpreter that will actually serve
# traffic, so a broken GDAL/GEOS never reaches gunicorn.
python -c "from django.contrib.gis.gdal.libgdal import GDAL_VERSION; print('GDAL', GDAL_VERSION)" \
  || die "django.contrib.gis cannot load GDAL"

# ---------------------------------------------------------------------------
# Processes
# ---------------------------------------------------------------------------

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
