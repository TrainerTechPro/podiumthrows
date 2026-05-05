import "server-only";
import {
  safeLifestyle,
  safeStrengthNumbers,
  safeTrainingHistory,
} from "@/app/(dashboard)/athlete/profile/_types";

/**
 * "Complete" = the athlete has touched the four Master Profile sections that
 * are athlete-writable AND drive engine output or coaching judgment:
 *
 *   • Core Info — turn direction + class standing + grad year
 *   • Training History — at least years training filled
 *   • Lifestyle — at least sleep hours filled
 *   • Strength Numbers — at least one lift with a current number
 *
 * Body composition and competition goals are intentionally optional —
 * sensitive / aspirational, not required to unlock a useful program.
 *
 * The bar is a tripwire, not a perfect-score: the athlete only sees a
 * "complete profile" nudge while ANY of the four are missing.
 */
export type AthleteMasterProfileFields = {
  turnDirection: string | null;
  classStanding: string | null;
  gradYear: number | null;
  // Prisma's Json column maps to `unknown` here — we route through the
  // existing safe parsers to avoid duplicating shape knowledge.
  trainingHistory: unknown;
  lifestyle: unknown;
  strengthNumbers: unknown;
};

export const MASTER_PROFILE_COMPLETION_FIELDS = {
  turnDirection: true,
  classStanding: true,
  gradYear: true,
  trainingHistory: true,
  lifestyle: true,
  strengthNumbers: true,
} as const;

export function isMasterProfileComplete(p: AthleteMasterProfileFields): boolean {
  if (!p.turnDirection || !p.classStanding || p.gradYear == null) return false;

  const history = safeTrainingHistory(p.trainingHistory);
  if (!history || history.yearsTraining == null) return false;

  const lifestyle = safeLifestyle(p.lifestyle);
  if (!lifestyle || lifestyle.sleepHours == null) return false;

  const strength = safeStrengthNumbers(p.strengthNumbers);
  if (!strength) return false;
  const hasAnyLift = Object.values(strength.lifts).some(
    (entry) => entry && typeof entry.current === "number" && entry.current > 0
  );
  if (!hasAnyLift) return false;

  return true;
}
