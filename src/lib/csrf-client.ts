"use client";

/**
 * Client-side CSRF utilities.
 *
 * Reads the csrf-token cookie (non-HttpOnly) and provides helpers to
 * include the X-CSRF-Token header on state-changing requests.
 */

const CSRF_COOKIE_NAME = "csrf-token";

/** Read the CSRF token from the cookie jar. */
export function getCsrfToken(): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`)
  );
  return match ? match[1] : "";
}

/** Return a headers object with the CSRF token. Spread into your fetch headers. */
export function csrfHeaders(): Record<string, string> {
  return { "X-CSRF-Token": getCsrfToken() };
}
