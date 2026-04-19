/**
 * CSRF protection utilities (edge-runtime compatible).
 *
 * Uses the double-submit cookie pattern:
 * 1. A random token is stored in a non-HttpOnly cookie (JS-readable)
 * 2. Client reads the cookie and sends it as the X-CSRF-Token header
 * 3. Middleware compares header value to cookie value
 *
 * Security relies on:
 * - SameSite=Lax: cookie is NOT sent on cross-origin POST/PUT/PATCH/DELETE
 *   requests (blocks the real CSRF threat — auto-submitted cross-site forms)
 *   but IS sent on top-level navigations. Strict additionally blocks the
 *   cookie on top-level navigations, which breaks iOS Safari PWA launches.
 *   Lax matches the auth-token cookie policy in src/lib/auth.ts.
 * - Custom X-CSRF-Token header: cross-origin JS cannot set custom headers
 *   without a CORS preflight, which we don't serve for browser origins.
 */

export const CSRF_COOKIE_NAME = "csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Generate a cryptographically random 64-char hex token (edge-safe). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the Set-Cookie string for the CSRF token. */
export function csrfCookieString(token: string, secure: boolean): string {
  return [
    `${CSRF_COOKIE_NAME}=${token}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Path=/",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Build the Set-Cookie string that clears the CSRF cookie. */
export function clearCsrfCookieString(): string {
  return `${CSRF_COOKIE_NAME}=; SameSite=Lax; Path=/; Max-Age=0`;
}
