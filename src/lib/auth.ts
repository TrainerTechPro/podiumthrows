import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { generateCsrfToken, csrfCookieString, clearCsrfCookieString } from "@/lib/csrf";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
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
  return verifyToken(token);
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
