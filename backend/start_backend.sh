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
# deb.debian.org still serves the bullseye *indexes*, but the security pool has
# been purged: installs die with 404s on files like
# debian-security/pool/updates/main/i/icu/libicu-dev_67.1-7+deb11u1_amd64.deb.
# archive.debian.org has no bullseye-security suite at all, but its `main`
# carries the complete pool including libgdal28 3.2.2+dfsg-2+deb11u2, i.e. the
# exact build that ran here until 2026-09-07. So: archive.debian.org main only,
# no security suite, and skip the Valid-Until check on those frozen indexes.
#
# We also install only the runtime shared objects instead of the -dev packages:
# django.contrib.gis resolves libraries through ctypes.util.find_library(),
# which reads `ldconfig -p` and matches sonames (libgdal.so.28), so the
# unversioned .so symlinks from -dev are unnecessary. That drops the cold-start
# apt from ~165 packages / 648 MB to a handful, and avoids every package that
# 404'd above (they were all -dev dependencies).
#
# This is a stopgap for a dead distro -- see
# doc/spec/20260826_1138_container_based_deployment_pipeline.md for the
# container-based deployment that removes cold-start apt entirely.
# ---------------------------------------------------------------------------
if [ -r /etc/os-release ] && grep -q 'VERSION_CODENAME=bullseye' /etc/os-release; then
  echo "start_backend: Debian bullseye (EOL) detected, using archive.debian.org main"
  printf '%s\n' 'deb http://archive.debian.org/debian bullseye main' > /etc/apt/sources.list \
    || die "could not rewrite /etc/apt/sources.list"
  APT_OPTS="-o Acquire::Check-Valid-Until=false"
  SPATIAL_PKGS="libgdal28 libgeos-c1v5 libproj19"
else
  APT_OPTS=""
  SPATIAL_PKGS="binutils libproj-dev gdal-bin libgdal-dev"
fi

# A failing update is not necessarily fatal (install can still succeed from
# whatever lists were fetched), so warn here and let the libgdal/libgeos
# assertions below be the real gate.
# shellcheck disable=SC2086
apt-get $APT_OPTS update -qq || echo "WARN(start_backend): apt-get update reported errors, continuing" >&2
# shellcheck disable=SC2086
apt-get $APT_OPTS install -yqq $SPATIAL_PKGS \
  || die "apt-get install of spatial dependencies ($SPATIAL_PKGS) failed"

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
