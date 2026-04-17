import type { CompFormat } from "@prisma/client";

type ThrowSlot = { round: "PRELIM" | "FINALS"; attemptInRound: number };

export function isMeetComplete(
  format: CompFormat,
  madeFinals: boolean | null,
  throws: ThrowSlot[]
): boolean {
  const hasPrelim = (n: number) =>
    throws.some((t) => t.round === "PRELIM" && t.attemptInRound === n);
  const hasFinals = (n: number) =>
    throws.some((t) => t.round === "FINALS" && t.attemptInRound === n);

  if (format === "FOUR_STRAIGHT") {
    return hasPrelim(1) && hasPrelim(2) && hasPrelim(3) && hasPrelim(4);
  }
  const prelimsComplete = hasPrelim(1) && hasPrelim(2) && hasPrelim(3);
  if (!prelimsComplete) return false;
  if (madeFinals) return hasFinals(1) && hasFinals(2) && hasFinals(3);
  return true;
}
