/**
 * CSRF protection utilities (edge-runtime compatible).
 *
 * Uses the double-submit cookie pattern:
 * 1. A random token is stored in a non-HttpOnly cookie (JS-readable)
 * 2. Client reads the cookie and sends it as the X-CSRF-Token header
 * 3. Middleware compares header value to cookie value
 *
 * Security relies on:
 * - SameSite=Strict prevents the cookie from being sent on cross-origin requests
 * - CORS prevents cross-origin JS from setting custom headers
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
    "SameSite=Strict",
    secure ? "Secure" : "",
    "Path=/",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Build the Set-Cookie string that clears the CSRF cookie. */
export function clearCsrfCookieString(): string {
  return `${CSRF_COOKIE_NAME}=; SameSite=Strict; Path=/; Max-Age=0`;
}
