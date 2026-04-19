import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { COMPETITION_WEIGHTS_BY_EVENT as COMPETITION_WEIGHTS } from "@/lib/throws/constants";

// Tolerance for matching implement weights (e.g. 7.3 counts as 7.26).
const WEIGHT_TOLERANCE_KG = 0.05;

export type PREventKey = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

export type PRRecord = {
  distance: number;
  date: string; // ISO timestamp
  source: "THROWLOG" | "MANUAL_COMPETITION_JSON";
  throwLogId: string | null;
  notes: string | null;
};

export type AthletePREvent = {
  event: PREventKey;
  competitionWeightKg: number;
  competitionPR: PRRecord | null;
  practiceBest: PRRecord | null;
  practiceExceedsPR: boolean;
  /** Best competition throw ever logged, BEFORE the manual-override merge.
   *  Use this to surface a "Best logged competition throw" badge when the
   *  manual competitionPRs JSON override is higher than any logged throw. */
  bestLoggedCompThrow: PRRecord | null;
};

export type AthletePRs = {
  athleteId: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  events: AthletePREvent[];
};

/**
 * Resolve the gender-correct competition weight for an event.
 * Defaults to male weights if gender is OTHER or null (documented choice).
 */
function getCompetitionWeight(event: string, gender: string | null): number {
  const weights = COMPETITION_WEIGHTS[event];
  if (!weights) return 0;
  return gender === "FEMALE" ? weights.female : weights.male;
}

/**
 * Canonical PR source for the entire app.
 *
 * Returns one AthletePREvent per event the athlete competes in.
 * Each entry contains:
 * - competitionPR: the best "competition weight" throw where isCompetition=true,
 *   OR the manual competitionPRs JSON value if it's larger (max wins).
 * - practiceBest: the best "competition weight" throw where isCompetition=false.
 * - practiceExceedsPR: true if practiceBest.distance > competitionPR.distance.
 *
 * Heavy/light implement throws are intentionally NOT surfaced here. The
 * canonical view is "one PR per event, competition weight only."
 *
 * Wrapped in React.cache for per-request deduplication.
 */
export const getAthletePRs = cache(async (athleteId: string): Promise<AthletePRs> => {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      gender: true,
      events: true,
      competitionPRs: true,
      updatedAt: true,
    },
  });

  if (!profile) {
    return { athleteId, gender: null, events: [] };
  }

  const events = (profile.events as unknown as PREventKey[]) ?? [];
  const manualPRs =
    (profile.competitionPRs as Record<string, number | null> | null) ?? {};
  const profileGender = profile.gender as "MALE" | "FEMALE" | "OTHER" | null;

  // Single query for all throws across all events the athlete competes in.
  // Distance-present filter excludes quick-log throws without measured distance.
  const allThrows = await prisma.throwLog.findMany({
    where: {
      athleteId,
      event: { in: events },
      distance: { not: null },
    },
    select: {
      id: true,
      event: true,
      implementWeight: true,
      distance: true,
      date: true,
      isCompetition: true,
      notes: true,
    },
  });

  const eventResults: AthletePREvent[] = events.map((event) => {
    const competitionWeightKg = getCompetitionWeight(event, profileGender);

    // Filter to this event + implement weight within tolerance.
    const eventThrows = allThrows.filter(
      (t) =>
        t.event === event &&
        Math.abs(t.implementWeight - competitionWeightKg) < WEIGHT_TOLERANCE_KG
    );

    // Best row: max distance, ties broken by most recent date.
    function pickBest<
      T extends { distance: number | null; date: Date }
    >(rows: T[]): T | null {
      if (rows.length === 0) return null;
      return rows.reduce((best, current) => {
        if (current.distance == null) return best;
        if (best.distance == null) return current;
        if (current.distance > best.distance) return current;
        if (current.distance === best.distance && current.date > best.date) {
          return current;
        }
        return best;
      });
    }

    const competitionRow = pickBest(eventThrows.filter((t) => t.isCompetition));
    const competitionPRCandidate: PRRecord | null = competitionRow
      ? {
          distance: competitionRow.distance!,
          date: competitionRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: competitionRow.id,
          notes: competitionRow.notes,
        }
      : null;

    const practiceRow = pickBest(eventThrows.filter((t) => !t.isCompetition));
    const practiceBest: PRRecord | null = practiceRow
      ? {
          distance: practiceRow.distance!,
          date: practiceRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: practiceRow.id,
          notes: practiceRow.notes,
        }
      : null;

    // Max wins: compare ThrowLog competition PR candidate against manual JSON value.
    let competitionPR: PRRecord | null = competitionPRCandidate;
    const manualValue = manualPRs[event];
    if (typeof manualValue === "number" && manualValue > 0) {
      if (!competitionPR || manualValue > competitionPR.distance) {
        competitionPR = {
          distance: manualValue,
          date: profile.updatedAt.toISOString(),
          source: "MANUAL_COMPETITION_JSON",
          throwLogId: null,
          notes: null,
        };
      }
    }

    const practiceExceedsPR =
      practiceBest !== null &&
      (competitionPR === null || practiceBest.distance > competitionPR.distance);

    return {
      event,
      competitionWeightKg,
      competitionPR,
      practiceBest,
      practiceExceedsPR,
      bestLoggedCompThrow: competitionPRCandidate, // best ThrowLog comp row, independent of manual merge
    };
  });

  return {
    athleteId,
    gender: profileGender,
    events: eventResults,
  };
});
