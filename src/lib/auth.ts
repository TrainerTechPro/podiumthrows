import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { generateCsrfToken, csrfCookieString, clearCsrfCookieString } from "@/lib/csrf";

if ((!process.env.JWT_SECRET?.trim()) && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set and non-empty in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SALT_ROUNDS = 12;

export interface JWTPayload {
  userId: string;
  email: string;
  role: "COACH" | "ATHLETE";
  isAdmin?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // Reject blacklisted tokens (logged-out sessions)
  const { isBlacklisted } = await import("@/lib/token-blacklist");
  if (await isBlacklisted(token)) return null;

  return payload;
}

/**
 * Check if the current session can act as an athlete.
 * True for ATHLETE role, or COACH role in training mode (active-mode cookie = TRAINING).
 */
export async function canActAsAthlete(session: JWTPayload | null): Promise<boolean> {
  if (!session) return false;
  if (session.role === "ATHLETE") return true;
  if (session.role === "COACH") {
    const cookieStore = await cookies();
    return cookieStore.get("active-mode")?.value === "TRAINING";
  }
  return false;
}

export function setAuthCookie(token: string): string {
  return `auth-token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

/** Build a Set-Cookie string for a fresh CSRF token (rotated on login/register). */
export function setCsrfCookie(): string {
  const csrfToken = generateCsrfToken();
  return csrfCookieString(csrfToken, process.env.NODE_ENV === "production");
}

export function clearAuthCookie(): string {
  return "auth-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

/** Build a Set-Cookie string that clears the CSRF cookie. */
export function clearCsrfCookie(): string {
  return clearCsrfCookieString();
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  return getSession();
}
