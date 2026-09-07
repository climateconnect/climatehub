const pick = require("lodash/pick");

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

require("dotenv").config();

const {
  isWasseraktionswochenEnabled,
  WASSERAKTIONSWOCHEN_PATH,
  WASSERAKTIONSWOCHEN_PARENT_SLUG,
} = require("./public/data/wasseraktionswochen_config");

const LOCATION_HUBS = (process.env.LOCATION_HUBS || "").split(",").filter(Boolean);

module.exports = withBundleAnalyzer({
  generateBuildId: async () => process.env.BUILD_SHA || "dev",
  // Workaround for Next 15 pages-router dev HMR crash when receiving malformed
  // `isrManifest` payloads (data can be `{}` before router is ready).
  devIndicators: false,
  // Disable ESLint during build - it's already run separately in CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Read set variables from `.env` file
  //For CUSTOM_HUB_URLS use a string of urls split by commas, e.g. CUSTOM_HUB_URLS=url1,url2,url3
  env: pick(process.env, [
    "API_HOST",
    "API_URL",
    "BASE_URL",
    "BASE_URL_HOST",
    "BUILD_SHA",
    "BUILD_TIMESTAMP",
    "CUSTOM_HUB_URLS",
    "DONATION_CAMPAIGN_RUNNING",
    "ENVIRONMENT",
    "GOOGLE_ANALYTICS_CODE",
    "LATEST_NEWSLETTER_LINK",
    "LOCATION_HUBS",
    "LETS_ENCRYPT_FILE_CONTENT",
    "SOCKET_URL",
    "WASSERAKTIONSWOCHEN_FEATURE",
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_SITE_ID",
    "FRONTEND_SENTRY_DSN",
  ]),
  i18n: {
    locales: ["en", "de"],
    defaultLocale: "en",
  },
  exportPathMap: async function (defaultPathMap) {
    return defaultPathMap;
  },
  async redirects() {
    const existingRedirects = [
      {
        source: "/",
        destination: "/browse",
        has: [
          {
            type: "cookie",
            key: "auth_token",
          },
        ],
        permanent: false,
      },
      {
        source: "/spenden",
        destination: "/de/donate",
        permanent: true,
      },
      {
        source: "/spendenwald",
        destination: "/de/donate",
        // disabled redirect to donorforest for now
        // as the donorforest is not up to date
        // destination: "/de/donorforest",
        permanent: true,
      },
      {
        source: "/klimakuechen-erlangen",
        destination: "/de/projects/klimakuechen?hub=erlangen",
        permanent: true,
      },
      {
        source: "/blog/weihnachten",
        destination: "/post/es-ist-weihnachtszeit-auf-climate-connect",
        permanent: true,
      },
      {
        source: "/klimapuzzle",
        destination: "/de/projects/workshop-klimapuzzle?hub=marburg",
        permanent: true,
      },
      {
        source: "/balkonien-em",
        destination: "/de/projects/balkonien-26-in-kenzingen?hub=em",
        permanent: true,
      },
      {
        source: "/balkonien-ks",
        destination: "/de/projects/balkonien-26-in-kassel?hub=kassel",
        permanent: true,
      },
      {
        source: "/hitzefrei",
        destination: "/de/projects/wurzburg-entsiegeln?hub=wuerzburg",
        permanent: true,
      },
      {
        source: "/hubs/prio1",
        destination: "/hubs/prio1/browse",
        permanent: false,
      },
    ];

    // Conditionally add Wasseraktionswochen redirect
    if (isWasseraktionswochenEnabled()) {
      existingRedirects.push({
        source: `/projects/${WASSERAKTIONSWOCHEN_PARENT_SLUG}`,
        destination: WASSERAKTIONSWOCHEN_PATH,
        permanent: false,
      });
    }

    const domainRedirects = [
      // 1. Potsdam project shortcuts on potsdam.climateconnect.earth
      {
        source: "/balkonsolar",
        has: [{ type: "host", value: "potsdam.climateconnect.earth" }],
        destination: `https://climatehub.org/de/projects/potsdam-balkon-solar?hub=potsdam&utm_source=subdomain&utm_medium=redirect&utm_campaign=potsdam&utm_content=balkonsolar`,
        permanent: true,
      },
      {
        source: "/stadtacker",
        has: [{ type: "host", value: "potsdam.climateconnect.earth" }],
        destination: `https://climatehub.org/de/projects/stadtacker-eine-bildungsgartnerei-der-zukunft-fur-potsdam?hub=potsdam&utm_source=subdomain&utm_medium=redirect&utm_campaign=potsdam&utm_content=stadtacker`,
        permanent: true,
      },
      {
        source: "/fassadenbegrünung",
        has: [{ type: "host", value: "potsdam.climateconnect.earth" }],
        destination: `https://climatehub.org/de/projects/stadtgrun-fassadenbegrunung?hub=potsdam&utm_source=subdomain&utm_medium=redirect&utm_campaign=potsdam&utm_content=fassadenbegruenung`,
        permanent: true,
      },
      // 2. Cross-domain subdomain redirects (German first, then English fallback)
      // Must be permanent: false (302) — 301s are cached by browsers, breaking language switching.
      ...LOCATION_HUBS.map((hubSlug) => ({
        source: "/:path*",
        has: [
          { type: "host", value: `${hubSlug}.climateconnect.earth` },
          { type: "header", key: "Accept-Language", value: "de.*" },
        ],
        destination: `https://climatehub.org/de/hubs/${hubSlug}?utm_source=subdomain&utm_medium=redirect&utm_campaign=${hubSlug}`,
        permanent: false,
      })),
      ...LOCATION_HUBS.map((hubSlug) => ({
        source: "/:path*",
        has: [{ type: "host", value: `${hubSlug}.climateconnect.earth` }],
        destination: `https://climatehub.org/hubs/${hubSlug}?utm_source=subdomain&utm_medium=redirect&utm_campaign=${hubSlug}`,
        permanent: false,
      })),
      // 3. New-domain subdomain redirects (potsdam.climatehub.org → climatehub.org/hubs/potsdam)
      // Must be permanent: false (302) — 301s are cached by browsers, breaking language switching.
      ...LOCATION_HUBS.map((hubSlug) => ({
        source: "/:path*",
        has: [
          { type: "host", value: `${hubSlug}.climatehub.org` },
          { type: "header", key: "Accept-Language", value: "de.*" },
        ],
        destination: `https://climatehub.org/de/hubs/${hubSlug}?utm_source=subdomain&utm_medium=redirect&utm_campaign=${hubSlug}`,
        permanent: false,
      })),
      ...LOCATION_HUBS.map((hubSlug) => ({
        source: "/:path*",
        has: [{ type: "host", value: `${hubSlug}.climatehub.org` }],
        destination: `https://climatehub.org/hubs/${hubSlug}?utm_source=subdomain&utm_medium=redirect&utm_campaign=${hubSlug}`,
        permanent: false,
      })),
      // 4. Subdomain aliases (e.g. wue → wuerzburg)
      // Must be permanent: false (302) — 301s are cached by browsers, breaking language switching.
      {
        source: "/:path*",
        has: [
          { type: "host", value: "wue.climateconnect.earth" },
          { type: "header", key: "Accept-Language", value: "de.*" },
        ],
        destination: `https://climatehub.org/de/hubs/wuerzburg?utm_source=subdomain&utm_medium=redirect&utm_campaign=wue`,
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "wue.climateconnect.earth" }],
        destination: `https://climatehub.org/hubs/wuerzburg?utm_source=subdomain&utm_medium=redirect&utm_campaign=wue`,
        permanent: false,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "wue.climatehub.org" },
          { type: "header", key: "Accept-Language", value: "de.*" },
        ],
        destination: `https://climatehub.org/de/hubs/wuerzburg?utm_source=subdomain&utm_medium=redirect&utm_campaign=wue`,
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "wue.climatehub.org" }],
        destination: `https://climatehub.org/hubs/wuerzburg?utm_source=subdomain&utm_medium=redirect&utm_campaign=wue`,
        permanent: false,
      },
      // 5. Main domain catch-all (locale: false to preserve /de prefix in external redirect)
      {
        source: "/de/:path*",
        has: [{ type: "host", value: "climateconnect.earth" }],
        destination: `https://climatehub.org/de/:path*`,
        permanent: true,
        locale: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "climateconnect.earth" }],
        destination: `https://climatehub.org/:path*`,
        permanent: true,
      },
    ];

    return [...domainRedirects, ...existingRedirects];
  },
  async rewrites() {
    const djangoBackend = process.env.API_URL || "";
    return [
      {
        source: "/events/feed.ics",
        destination: `${djangoBackend}/api/events/feed.ics/`,
      },
      {
        source: "/hubs/:hubUrl/events/feed.ics",
        destination: `${djangoBackend}/api/events/feed.ics/`,
      },
      {
        source: "/hubs/:hubUrl/:subHub/events/feed.ics",
        destination: `${djangoBackend}/api/events/feed.ics/`,
      },
    ];
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
});

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "climate-connect-ggmbh",
  project: "climatehub-frontend",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
