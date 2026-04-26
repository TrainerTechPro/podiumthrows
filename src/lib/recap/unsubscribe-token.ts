import { createHmac, timingSafeEqual } from "crypto";

const PURPOSE = "weekly-recap-unsubscribe";

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.CRON_SECRET;
  if (!s) {
    throw new Error("Missing signing secret: set UNSUBSCRIBE_SECRET, JWT_SECRET, or CRON_SECRET");
  }
  return s;
}

/**
 * Sign an athlete-scoped unsubscribe token. Stable per-athlete (does not
 * include a timestamp) so a single emailed link continues to work — the
 * link only carries authority to flip the weekly-recap preferences off.
 */
export function signUnsubscribeToken(athleteId: string): string {
  return createHmac("sha256", secret()).update(`${PURPOSE}:${athleteId}`).digest("hex");
}

export function verifyUnsubscribeToken(athleteId: string, token: string): boolean {
  const expected = signUnsubscribeToken(athleteId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
