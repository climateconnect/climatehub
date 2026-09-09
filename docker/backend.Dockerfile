FROM python:3.12-slim-bookworm

# Install runtime spatial dependencies (bookworm packages).
# These are the shared objects that django.contrib.gis loads via ctypes.
# No -dev packages — keeps the image small and avoids cold-start apt entirely.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgdal32 \
        libgeos-c1v5 \
        libproj25 \
        gdal-bin \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pdm

WORKDIR /app

# Dependency files first — Docker layer caching means this layer is reused
# as long as pyproject.toml and pdm.lock don't change.
COPY backend/pyproject.toml backend/pdm.lock backend/pdm.toml ./

# Install production dependencies into .venv (skip dev group, don't install
# the project itself as a package).
RUN pdm install --prod --no-self --no-editable

# Now copy the actual backend source code.
COPY backend/ ./

# Bake build metadata into the image so /api/version/ works without a
# build_info.json in the repo.
ARG GIT_SHA=unknown
ARG GIT_REF=unknown
ARG BUILD_TIME=unknown
ARG GIT_MESSAGE=unknown
RUN printf '{"sha":"%s","ref":"%s","built_at":"%s"}\n' \
      "$GIT_SHA" "$GIT_REF" "$BUILD_TIME" > build_info.json

LABEL org.opencontainers.image.source="https://github.com/climateconnect/climatehub"
LABEL org.opencontainers.image.description="${GIT_MESSAGE}"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

EXPOSE 8000

COPY docker/backend-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
