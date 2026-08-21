import { NextRequest } from "next/server";
import { handlers } from "@/auth";

// Workaround for a next-auth v5 beta issue: behind the CloudPanel/Nginx
// reverse proxy, X-Forwarded-Host/Proto arrive correctly (verified), and
// the server-action-initiated sign-in (src/app/auth/actions.ts) already
// resolves the right origin via AUTH_URL — but Auth.js's route-handler code
// path for the OAuth callback still derives redirect_uri from the raw
// request (http://localhost:7777) during the token exchange with Google,
// which then rejects it as redirect_uri_mismatch. Forcing the request's own
// URL to the canonical public origin before handing off to Auth.js makes
// every internal code path see the same value the initial redirect used.
//
// AUTH_URL is read lazily (inside the function, not at module top level) —
// Next.js evaluates this module during its build-time "collect page data"
// step too, where env vars aren't necessarily populated yet, and a
// top-level `new URL(process.env.AUTH_URL)` would throw and fail the build.
function withCanonicalOrigin(request: NextRequest): NextRequest {
  const authOrigin = new URL(process.env.AUTH_URL!);
  const url = new URL(request.url);
  url.protocol = authOrigin.protocol;
  url.host = authOrigin.host;

  const init: Record<string, unknown> = {
    method: request.method,
    headers: request.headers,
  };
  if (request.body) {
    init.body = request.body;
    init.duplex = "half";
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

export async function GET(request: NextRequest) {
  return handlers.GET(withCanonicalOrigin(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(withCanonicalOrigin(request));
}
