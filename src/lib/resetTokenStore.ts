import prisma from "@/lib/prisma";

/**
 * Store a password reset token in the database.
 */
export async function storeToken(
  token: string,
  userId: string,
  expiresAt: Date
): Promise<void> {
  await prisma.passwordResetToken.create({
    data: { token, userId, expiresAt },
  });
}

/**
 * Retrieve a valid (unused, unexpired) password reset token.
 * Returns null if the token doesn't exist, is expired, or has been used.
 */
export async function getToken(
  token: string
): Promise<{ userId: string; expiresAt: Date } | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    return null;
  }

  return { userId: record.userId, expiresAt: record.expiresAt };
}

/**
 * Mark a token as consumed by setting usedAt to now.
 */
export async function deleteToken(token: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });
}
