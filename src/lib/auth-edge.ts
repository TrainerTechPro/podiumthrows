/**
 * Edge-runtime-safe auth utilities.
 *
 * Next.js middleware runs on the Edge Runtime which does NOT support native
 * Node.js modules (bcrypt, node-gyp-build, etc.).  This file contains only
 * Web-API-compatible code so it can be safely imported from middleware.
 *
 * NOTE: This performs a decode-only check (expiry + shape), NOT cryptographic
 * signature verification.  Full signature verification happens in getSession()
 * (Node.js server context) before any data is accessed.  Middleware only needs
 * the role claim for routing/redirect decisions.
 */

import type { JWTPayload } from "./auth";

/**
 * Decode a JWT and return its payload without cryptographic verification.
 * Returns null if the token is malformed or expired.
 */
export function verifyTokenEdge(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json);

    if (!payload.userId || !payload.email || !payload.role) return null;

    // Honour expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload as JWTPayload;
  } catch {
    return null;
  }
}
