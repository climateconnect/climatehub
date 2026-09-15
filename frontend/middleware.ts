import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  detectEnvironmentFromHost,
  CC_ENVIRONMENT_HEADER,
  CC_ENVIRONMENT_COOKIE,
  CcEnvironments,
} from "./public/lib/environmentOperations";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const icsMatch = url.pathname.match(/^\/hubs\/([^/]+)(?:\/([^/]+))?\/events\/feed\.ics$/);
  if (icsMatch && !url.searchParams.has("token")) {
    const hubSlug = icsMatch[2] || icsMatch[1];
    const today = new Date().toISOString().split("T")[0];

    try {
      const apiUrl = process.env.API_URL || "";
      const tokenRes = await fetch(`${apiUrl}/api/event-feed-token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hub: hubSlug, date: today }),
      });

      if (tokenRes.ok) {
        const { url: feedUrl } = await tokenRes.json();
        return NextResponse.redirect(feedUrl, 301);
      }
    } catch {
      // fall through — rewrite will proxy to Django which returns 403
    }
  }

  const host = request.headers.get("host");
  const environment = detectEnvironmentFromHost(host);

  // Rewrite request headers so getServerSideProps can read the environment
  // via context.req.headers[CC_ENVIRONMENT_HEADER]. Simply setting a response
  // header does NOT make it available in req.headers inside getServerSideProps.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CC_ENVIRONMENT_HEADER, environment);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Also set a cookie so client-side JS can read the environment without hostname
  // parsing (httpOnly: false makes it accessible from document.cookie / universal-cookie)
  response.cookies.set(CC_ENVIRONMENT_COOKIE, environment, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: environment !== CcEnvironments.Development,
    // No maxAge — session cookie; refreshed on every request by middleware
  });

  return response;
}

// Run on all routes except Next.js internals and static files
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
