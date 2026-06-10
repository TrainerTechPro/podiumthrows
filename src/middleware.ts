import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTokenEdge as verifyToken } from "@/lib/auth-edge";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";
import { getFlags } from "@/lib/flags";
import { FLAG_GATED_ROUTES } from "@/lib/flag-gated-routes";
import { rateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/app", // SaaS marketing home (relocated from "/") — marketing surface, must be public
  "/pricing",
  "/deficit-finder",
  "/throw-breakdown", // lead-magnet squeeze page — public
  "/privacy",
  "/terms", // marketing surface per CLAUDE.md §"Marketing Routes — Always-Dark"
  "/changelog", // marketing surface per CLAUDE.md §"Marketing Routes — Always-Dark"
  "/goodbye", // post-account-deletion landing — user is logged out by then
  "/availability", // public read-only share links /availability/[token]
  "/athletes/claim", // public athlete-invite preview /athletes/claim/[token]
  "/api/whoop/callback",
  "/api/oura/callback",
  "/dev", // dev-only component harnesses (pages 404 in production)
];
const AUTH_PATHS = ["/login", "/register"];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Phone-class user agents (excludes iPad in tablet/desktop UA modes). Used
// to gate the coach sideline redirect — sideline is for the actual field
// device, not iPad-on-the-bench. See CLAUDE.md §Dual Product Identity.
const PHONE_UA_RE = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;

function isPhoneUA(ua: string | null): boolean {
  return ua ? PHONE_UA_RE.test(ua) : false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth-token")?.value;

  // ── API routes: rate limiting + CSRF validation then pass through ───
  if (pathname.startsWith("/api/")) {
    if (STATE_CHANGING_METHODS.has(request.method)) {
      // Skip CSRF only for routes that use their own auth mechanism:
      // - Webhooks: verified by signature/HMAC from the provider
      // - Cron: verified by Bearer $CRON_SECRET
      // The previous quick-log bypass was a workaround for an iOS Safari
      // issue caused by SameSite=Strict on the CSRF cookie. Fixed at its
      // root in src/lib/csrf.ts (now SameSite=Lax, matching the auth-token
      // cookie), so quick-log no longer needs a bypass.
      const skipExternal =
        pathname.startsWith("/api/webhooks/") ||
        pathname.startsWith("/api/cron/") ||
        pathname.startsWith("/api/whoop/webhook") ||
        // Modal pose-service callback: verified by HMAC signature in the route
        pathname.startsWith("/api/analysis/webhooks/");

      if (!skipExternal) {
        // CSRF check
        const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
        const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
          return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
        }

        // Global rate limit for mutations — auth routes have their own stricter limits
        const skipRateLimit = pathname.startsWith("/api/auth/");
        if (!skipRateLimit) {
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
          const payload = token ? await verifyToken(token) : null;
          const rlKey = payload ? `api:${payload.userId}` : `api:ip:${ip}`;
          const rl = await rateLimit(rlKey, { maxAttempts: 60, windowMs: 60_000 });
          if (!rl.success) {
            return NextResponse.json(
              { error: "Too many requests. Please try again later." },
              { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
            );
          }
        }
      }
    }
    return NextResponse.next();
  }

  // ── Static files and Next.js internals ─────────────────────────────
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // ── Auth routing logic ─────────────────────────────────────────────
  const payload = token ? await verifyToken(token) : null;
  let response: NextResponse;

  // Redirect authenticated users away from auth pages and landing page
  if (payload && (pathname === "/" || AUTH_PATHS.some((p) => pathname.startsWith(p)))) {
    const dashboardUrl = payload.role === "COACH" ? "/coach/dashboard" : "/athlete/dashboard";
    response = NextResponse.redirect(new URL(dashboardUrl, request.url));
  }
  // Redirect unauthenticated users to login
  else if (
    !payload &&
    pathname !== "/" &&
    !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    response = NextResponse.redirect(loginUrl);
  }
  // Role-based route protection (admins bypass)
  else if (payload && !payload.isAdmin) {
    // Use a trailing slash so `/athlete/` matches /athlete and /athlete/...
    // but does NOT accidentally match unrelated prefixes like /athletes/.
    if (
      (pathname === "/athlete" || pathname.startsWith("/athlete/")) &&
      payload.role !== "ATHLETE"
    ) {
      const activeMode = request.cookies.get("active-mode")?.value;
      if (payload.role !== "COACH" || activeMode !== "TRAINING") {
        response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
      } else {
        response = NextResponse.next();
      }
    } else if (pathname.startsWith("/coach") && payload.role !== "COACH") {
      response = NextResponse.redirect(new URL("/athlete/dashboard", request.url));
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // ── Coach sideline redirect (mobile-only) ────────────────────────────
  // Per CLAUDE.md §Dual Product Identity, the coach desktop is "research
  // software" — the editorial dashboard isn't the right home on a phone in
  // the field. Phone-class UAs landing on /coach/dashboard get sent to the
  // sideline-optimized home unless they've explicitly opted into the full
  // dashboard via the `coach_mobile_view=full` cookie.
  if (
    payload?.role === "COACH" &&
    !payload.isAdmin &&
    pathname === "/coach/dashboard" &&
    isPhoneUA(request.headers.get("user-agent"))
  ) {
    const view = request.cookies.get("coach_mobile_view")?.value;
    if (view !== "full") {
      // MVP cut (2026-05-15): only redirect if the coachSideline flag is on.
      // Without this guard the FLAG_GATED_ROUTES check below would send the
      // request right back to /coach/dashboard — a redirect loop.
      const flags = await getFlags();
      if (flags.coachSideline?.enabled) {
        response = NextResponse.redirect(new URL("/coach/sideline", request.url));
      }
    }
  }

  // ── Feature flag gating ───────────────────────────────────────────
  const gatedRoute = FLAG_GATED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (gatedRoute) {
    const flags = await getFlags();
    const flag = flags[gatedRoute.flag];
    if (!flag?.enabled) {
      const dashboardUrl = payload?.role === "ATHLETE" ? "/athlete/dashboard" : "/coach/dashboard";
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
  }

  // ── Default active-mode cookie for coaches ────────────────────────
  if (payload?.role === "COACH" && !request.cookies.has("active-mode")) {
    response.cookies.set("active-mode", "COACH", {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  // ── Set CSRF cookie on page responses if not already present ───────
  if (!request.cookies.has(CSRF_COOKIE_NAME)) {
    const csrfToken = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      // Lax matches the auth-token cookie in src/lib/auth.ts and the
      // helper in src/lib/csrf.ts (csrfCookieString). Strict here caused
      // the CSRF cookie to appear stale during top-level nav from
      // cross-site referrers while the auth-token was already present,
      // producing spurious 403s on the first mutation after sign-in.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
