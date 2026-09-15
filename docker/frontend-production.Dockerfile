# Production frontend image for Climate Connect.
# Mirrors the backend Dockerfile pattern: dependency layer caching, build
# metadata baked in, no on-server install at cold start.
#
# Build-time env vars (API_HOST, WEBFLOW_API_TOKEN, etc.) are embedded into
# the client bundle by next.config.js — Phase 5 will move them to runtime.
# Until then, images must be kept private in the registry.

# ── Stage 1: install dependencies ──────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Enable Corepack so Yarn 4 (packageManager field in package.json) works
RUN corepack enable

# nodeLinker must be node-modules (matching frontend/.yarnrc.yml) —
# Next.js does not support Yarn PnP out of the box.
ENV YARN_NODE_LINKER=node-modules

COPY frontend/package.json frontend/yarn.lock ./

RUN yarn install --immutable

# ── Stage 2: devlink-sync + build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Reuse the installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full frontend source (scripts/generate-devlink-registry.js,
# public/data/wasseraktionswochen_config.js, server.js, etc.)
COPY frontend/ ./

# ── Webflow devlink credentials (needed by `yarn devlink-sync`) ────────
ARG WEBFLOW_API_TOKEN
ARG WEBFLOW_SITE_ID

# ── Values embedded into the client bundle by next.config.js `env` ────
ARG API_HOST
ARG API_URL
ARG BASE_URL
ARG BASE_URL_HOST
ARG BUILD_SHA
ARG BUILD_TIMESTAMP
ARG CLIMATEORG_ACTIVE
ARG CUSTOM_HUB_URLS
ARG DONATION_CAMPAIGN_RUNNING
ARG ENVIRONMENT=production
ARG FRONTEND_SENTRY_DSN
ARG GOOGLE_ANALYTICS_CODE
ARG LATEST_NEWSLETTER_LINK
ARG LETS_ENCRYPT_FILE_CONTENT
ARG LOCATION_HUBS
ARG SOCKET_URL
ARG WASSERAKTIONSWOCHEN_FEATURE

# ── Sentry source-map upload (build-time only, not embedded) ──────────
ARG SENTRY_AUTH_TOKEN

# Expose all build args as env vars so next.config.js reads them via
# process.env.  (dotenv.config() is a no-op when the var already exists.)
ENV WEBFLOW_API_TOKEN=$WEBFLOW_API_TOKEN
ENV WEBFLOW_SITE_ID=$WEBFLOW_SITE_ID
ENV API_HOST=$API_HOST
ENV API_URL=$API_URL
ENV BASE_URL=$BASE_URL
ENV BASE_URL_HOST=$BASE_URL_HOST
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP
ENV CLIMATEORG_ACTIVE=$CLIMATEORG_ACTIVE
ENV CUSTOM_HUB_URLS=$CUSTOM_HUB_URLS
ENV DONATION_CAMPAIGN_RUNNING=$DONATION_CAMPAIGN_RUNNING
ENV ENVIRONMENT=$ENVIRONMENT
ENV FRONTEND_SENTRY_DSN=$FRONTEND_SENTRY_DSN
ENV GOOGLE_ANALYTICS_CODE=$GOOGLE_ANALYTICS_CODE
ENV LATEST_NEWSLETTER_LINK=$LATEST_NEWSLETTER_LINK
ENV LETS_ENCRYPT_FILE_CONTENT=$LETS_ENCRYPT_FILE_CONTENT
ENV LOCATION_HUBS=$LOCATION_HUBS
ENV SOCKET_URL=$SOCKET_URL
ENV WASSERAKTIONSWOCHEN_FEATURE=$WASSERAKTIONSWOCHEN_FEATURE
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

# 1. Sync Webflow devlink components.
#    The Webflow CLI needs --site and --api-token flags; it does not pick
#    up WEBFLOW_SITE_ID / WEBFLOW_API_TOKEN from the environment.
RUN npx webflow devlink export --site "$WEBFLOW_SITE_ID" --api-token "$WEBFLOW_API_TOKEN" \
    && node scripts/generate-devlink-registry.js

# 2. Build the Next.js application (client bundle picks up env vars above)
RUN yarn build

# ── Stage 3: production runner ─────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Azure App Service sets WEBSITES_PORT; default to 3000 for standalone use.
ENV PORT=3000

# Copy node_modules from the deps stage.  This includes devDependencies
# (slightly larger image) but avoids a second yarn install and guarantees
# identical resolution.  Optimise later if image size becomes a concern.
COPY --from=deps /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js
COPY frontend/package.json ./

# Bake build metadata into the image
ARG GIT_SHA=unknown
ARG GIT_REF=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.source="https://github.com/climateconnect/climatehub"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

EXPOSE 3000

CMD ["node", "server.js"]
