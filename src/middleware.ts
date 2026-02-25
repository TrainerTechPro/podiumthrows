import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyTokenEdge as verifyToken } from "@/lib/auth-edge";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/pricing"];
const AUTH_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth-token")?.value;

  // Allow API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Parse JWT to get role (lightweight check — no DB call)
  const payload = token ? verifyToken(token) : null;

  // Redirect authenticated users away from auth pages
  if (payload && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const dashboardUrl =
      payload.role === "COACH" ? "/coach/dashboard" : "/athlete/dashboard";
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // Redirect unauthenticated users to login
  if (!payload && pathname !== "/" && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  if (payload) {
    // Coach trying to access athlete routes
    if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
      return NextResponse.redirect(new URL("/coach/dashboard", request.url));
    }

    // Athlete trying to access coach routes
    if (pathname.startsWith("/coach") && payload.role !== "COACH") {
      return NextResponse.redirect(new URL("/athlete/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
