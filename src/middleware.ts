import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTokenEdge as verifyToken } from "@/lib/auth-edge";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";
import { getFlags, type FlagKey } from "@/lib/flags";
import { rateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/deficit-finder",
  "/privacy",
  "/availability",         // public read-only share links /availability/[token]
  "/api/whoop/callback",
  "/api/oura/callback",
];
const AUTH_PATHS = ["/login", "/register"];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Route prefixes gated by feature flags
const FLAG_GATED_ROUTES: { prefix: string; flag: FlagKey }[] = [
  { prefix: "/athlete/self-program", flag: "selfProgram" },
  { prefix: "/coach/videos", flag: "videoAnnotator" },
  { prefix: "/athlete/throws/analysis", flag: "throwsAnalysis" },
  { prefix: "/athlete/oura", flag: "ouraIntegration" },
  { prefix: "/athlete/whoop", flag: "whoopIntegration" },
  { prefix: "/coach/questionnaires", flag: "questionnaireBuilder" },
  { prefix: "/athlete/questionnaires", flag: "questionnaireBuilder" },
  { prefix: "/coach/throws/practice", flag: "practiceMode" },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth-token")?.value;

  // ── API routes: rate limiting + CSRF validation then pass through ───
  if (pathname.startsWith("/api/")) {
    if (STATE_CHANGING_METHODS.has(request.method)) {
      // Skip CSRF for webhook & cron routes (they use their own auth)
      const skipExternal =
        pathname.startsWith("/api/webhooks/") ||
        pathname.startsWith("/api/cron/") ||
        pathname.startsWith("/api/whoop/webhook");

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
  else if (!payload && pathname !== "/" && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    response = NextResponse.redirect(loginUrl);
  }
  // Role-based route protection (admins bypass)
  else if (payload && !payload.isAdmin) {
    if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
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

  // ── Feature flag gating ───────────────────────────────────────────
  const gatedRoute = FLAG_GATED_ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (gatedRoute) {
    const flags = await getFlags();
    const flag = flags[gatedRoute.flag];
    if (!flag?.enabled) {
      const dashboardUrl =
        payload?.role === "ATHLETE" ? "/athlete/dashboard" : "/coach/dashboard";
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
      sameSite: "strict",
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
