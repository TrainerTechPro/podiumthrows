import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * SHA-256 hash a token before storage/lookup. Reset tokens are already
 * high-entropy random bytes, so a fast hash is appropriate (no bcrypt needed).
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Store a password reset token in the database.
 * The token is SHA-256 hashed before storage so that a database breach
 * does not expose active reset tokens.
 */
export async function storeToken(
  token: string,
  userId: string,
  expiresAt: Date
): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.passwordResetToken.create({
    data: { token: tokenHash, userId, expiresAt },
  });
}

/**
 * Retrieve a valid (unused, unexpired) password reset token.
 * The raw token is hashed before lookup to match the stored hash.
 * Returns null if the token doesn't exist, is expired, or has been used.
 */
export async function getToken(
  token: string
): Promise<{ userId: string; expiresAt: Date } | null> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    return null;
  }

  return { userId: record.userId, expiresAt: record.expiresAt };
}

/**
 * Mark a token as consumed by setting usedAt to now.
 * The raw token is hashed before lookup to match the stored hash.
 */
export async function deleteToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.passwordResetToken.update({
    where: { token: tokenHash },
    data: { usedAt: new Date() },
  });
}
