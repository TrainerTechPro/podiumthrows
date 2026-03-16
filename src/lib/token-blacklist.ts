import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** SHA-256 hash the raw JWT so we never store plaintext tokens. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Extract the `exp` claim from a JWT without full verification.
 * Returns a Date, or 7 days from now as a fallback.
 */
function extractExpiry(token: string): Date {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (typeof payload.exp === "number") {
      return new Date(payload.exp * 1000);
    }
  } catch {
    // fall through
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/** Add a token to the blacklist. Fire-and-forget safe. */
export async function blacklistToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = extractExpiry(token);

  await prisma.tokenBlacklist.create({
    data: { tokenHash, expiresAt },
  });
}

/** Check whether a token has been blacklisted. */
export async function isBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const entry = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash },
    select: { id: true },
  });
  return entry !== null;
}

/** Delete expired blacklist entries. Returns the count of deleted rows. */
export async function cleanupExpired(): Promise<number> {
  const result = await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  logger.info("Token blacklist cleanup", { context: "auth", metadata: { deleted: result.count } });
  return result.count;
}
