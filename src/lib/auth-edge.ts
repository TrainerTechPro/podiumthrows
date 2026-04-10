/**
 * Edge-runtime-safe auth utilities.
 *
 * Next.js middleware runs on the Edge Runtime which does NOT support native
 * Node.js modules (bcrypt, node-gyp-build, etc.).  This file uses the
 * Web Crypto API (available in Edge Runtime) for HMAC-SHA256 JWT signature
 * verification — the same algorithm used by `jsonwebtoken` in Node.js context.
 *
 * Full signature verification happens here AND in getSession() (Node.js server
 * context). Middleware uses this to make trustworthy routing/role decisions.
 */

import type { JWTPayload } from "./auth";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Base64url decode to Uint8Array.
 */
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verify a JWT's HMAC-SHA256 signature and return its payload.
 * Returns null if the token is malformed, expired, tampered, or wrongly signed.
 *
 * Uses Web Crypto API (crypto.subtle) which is available in the Edge Runtime
 * and performs constant-time signature comparison.
 */
export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify the header specifies HS256
    const headerJson = atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"));
    const header = JSON.parse(headerJson);
    if (header.alg !== "HS256") return null;

    // Import the secret as an HMAC key
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify signature (constant-time comparison done by crypto.subtle)
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes.buffer as ArrayBuffer,
      data
    );
    if (!valid) return null;

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);

    // Validate required fields
    if (!payload.userId || !payload.email || !payload.role) return null;

    // Honour expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      ...(payload.isAdmin ? { isAdmin: true } : {}),
    } as JWTPayload;
  } catch {
    return null;
  }
}
