import { randomBytes, createHash } from "crypto";

export function generateInvitationToken(): { raw: string; hashed: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hashed: hashInvitationToken(raw) };
}

export function hashInvitationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
