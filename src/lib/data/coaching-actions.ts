/**
 * coaching-actions.ts
 *
 * Queries 9 data sources and returns a unified CoachingAction[] for the
 * coach dashboard. Each action represents something a coach should look at
 * — injuries, overtraining risk, adaptation recommendations, sports form,
 * readiness drops, missed sessions, autoregulation suggestions, goals at
 * risk, and athletes who haven't checked in.
 *
 * Wrapped in React cache() so duplicate calls within the same server render
 * tree only fire once.
 */

import { cache } from "react";
import prisma from "@/lib/prisma";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type CoachingActionType =
  | "injury"
  | "acwr_risk"
  | "adaptation"
  | "sports_form"
  | "readiness_drop"
  | "missed_sessions"
  | "autoregulation"
  | "goal_at_risk"
  | "no_checkin";

export type CoachingActionSeverity = "critical" | "warning" | "info";

export interface CoachingAction {
  id: string;
  type: CoachingActionType;
  severity: CoachingActionSeverity;
  /** Numeric priority for sorting — lower = more urgent (1 = most urgent) */
  priority: number;
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  title: string;
  description: string;
  /** ISO string */
  timestamp: string;
  /** Optional deep-link path within the app */
  href?: string;
  /** Extra context blob — consumers decide how to render */
  meta?: Record<string, unknown>;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysAgoISO(n: number): string {
  return daysAgo(n).toISOString().slice(0, 10);
}

function athleteName(a: { firstName: string; lastName: string }): string {
  return `${a.firstName} ${a.lastName}`;
}

/* ─── 1. Injuries ───────────────────────────────────────────────────────── */

async function getInjuryActions(coachId: string): Promise<CoachingAction[]> {
  // Three injury sources — deduplicate per athlete (worst wins)
  const [throwsInjuries, injuries, readinessInjuries] = await Promise.all([
    prisma.throwsInjury.findMany({
      where: {
        recovered: false,
        athlete: { coachId },
      },
      include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { injuryDate: "desc" },
    }),
    prisma.injury.findMany({
      where: {
        recovered: false,
        athlete: { coachId },
      },
      include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { injuryDate: "desc" },
    }),
    prisma.readinessCheckIn.findMany({
      where: {
        injuryStatus: "ACTIVE",
        date: { gte: daysAgo(7) },
        athlete: { coachId },
      },
      include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  // Deduplicate: one action per athlete, prefer throws-specific injury detail
  const seen = new Map<string, CoachingAction>();

  for (const ti of throwsInjuries) {
    const name = athleteName(ti.athlete);
    const bans: string[] = [];
    if (ti.throwsBanned) bans.push("throws");
    if (ti.heavyBanned) bans.push("heavy implements");
    if (ti.strengthBanned) bans.push("strength");
    const banStr = bans.length > 0 ? ` Banned: ${bans.join(", ")}.` : "";

    if (!seen.has(ti.athleteId)) {
      seen.set(ti.athleteId, {
        id: `injury-throws-${ti.id}`,
        type: "injury",
        severity: "critical",
        priority: 1,
        athleteId: ti.athleteId,
        athleteName: name,
        athleteAvatar: ti.athlete.avatarUrl,
        title: `${name} — Active Injury`,
        description: `${ti.bodyPart}${ti.side ? ` (${ti.side})` : ""} — ${ti.severity}.${banStr}`,
        timestamp: ti.updatedAt.toISOString(),
        href: `/coach/athletes/${ti.athleteId}/injuries`,
        meta: { source: "throwsInjury", bodyPart: ti.bodyPart, severity: ti.severity },
      });
    }
  }

  for (const inj of injuries) {
    if (!seen.has(inj.athleteId)) {
      const name = athleteName(inj.athlete);
      seen.set(inj.athleteId, {
        id: `injury-general-${inj.id}`,
        type: "injury",
        severity: "critical",
        priority: 1,
        athleteId: inj.athleteId,
        athleteName: name,
        athleteAvatar: inj.athlete.avatarUrl,
        title: `${name} — Active Injury`,
        description: `${inj.bodyPart} — ${inj.severity}.`,
        timestamp: inj.updatedAt.toISOString(),
        href: `/coach/athletes/${inj.athleteId}/injuries`,
        meta: { source: "injury", bodyPart: inj.bodyPart, severity: inj.severity },
      });
    }
  }

  for (const ci of readinessInjuries) {
    if (!seen.has(ci.athleteId)) {
      const name = athleteName(ci.athlete);
      seen.set(ci.athleteId, {
        id: `injury-checkin-${ci.id}`,
        type: "injury",
        severity: "warning",
        priority: 2,
        athleteId: ci.athleteId,
        athleteName: name,
        athleteAvatar: ci.athlete.avatarUrl,
        title: `${name} — Reported Injury in Check-in`,
        description: ci.injuryNotes || "Injury flagged during readiness check-in.",
        timestamp: ci.date.toISOString(),
        href: `/coach/athletes/${ci.athleteId}/readiness`,
        meta: { source: "readinessCheckIn" },
      });
    }
  }

  return Array.from(seen.values());
}

/* ─── 2. ACWR Risk ──────────────────────────────────────────────────────── */

async function getAcwrActions(coachId: string): Promise<CoachingAction[]> {
  // Get the latest risk assessment per athlete where ACWR > 1.3
  const assessments = await prisma.riskAssessment.findMany({
    where: {
      acwr: { gt: 1.3 },
      athlete: { coachId },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { assessmentDate: "desc" },
  });

  // Keep only latest per athlete
  const latestByAthlete = new Map<string, typeof assessments[number]>();
  for (const a of assessments) {
    if (!latestByAthlete.has(a.athleteId)) {
      latestByAthlete.set(a.athleteId, a);
    }
  }

  return Array.from(latestByAthlete.values()).map((ra) => {
    const name = athleteName(ra.athlete);
    const isCritical = ra.acwr > 1.5;
    return {
      id: `acwr-${ra.id}`,
      type: "acwr_risk" as const,
      severity: isCritical ? ("critical" as const) : ("warning" as const),
      priority: isCritical ? 2 : 4,
      athleteId: ra.athleteId,
      athleteName: name,
      athleteAvatar: ra.athlete.avatarUrl,
      title: `${name} — High Training Load`,
      description: `ACWR ${ra.acwr.toFixed(2)} (${ra.riskLevel}).${ra.monotony ? ` Monotony: ${ra.monotony.toFixed(2)}.` : ""}`,
      timestamp: ra.createdAt.toISOString(),
      href: `/coach/athletes/${ra.athleteId}/load`,
      meta: { acwr: ra.acwr, riskLevel: ra.riskLevel, monotony: ra.monotony },
    };
  });
}

/* ─── 3. Adaptation Checkpoints ─────────────────────────────────────────── */

async function getAdaptationActions(coachId: string): Promise<CoachingAction[]> {
  const checkpoints = await prisma.adaptationCheckpoint.findMany({
    where: {
      applied: false,
      recommendation: { not: "CONTINUE" },
      program: {
        coachId,
        status: "ACTIVE",
      },
    },
    include: {
      program: {
        select: {
          id: true,
          event: true,
          athleteId: true,
          athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return checkpoints
    .filter((cp) => cp.program.athlete !== null)
    .map((cp) => {
      const athlete = cp.program.athlete!;
      const name = athleteName(athlete);
      const recLabel = cp.recommendation.replace(/_/g, " ").toLowerCase();
      const isCritical = cp.recommendation === "DELOAD" || cp.markTrend === "DECLINING";
      return {
        id: `adapt-${cp.id}`,
        type: "adaptation" as const,
        severity: isCritical ? ("critical" as const) : ("warning" as const),
        priority: isCritical ? 3 : 5,
        athleteId: athlete.id,
        athleteName: name,
        athleteAvatar: athlete.avatarUrl,
        title: `${name} — Adaptation: ${recLabel}`,
        description: `Week ${cp.weekNumber}, Complex ${cp.complexNumber}. Marks ${cp.markTrend.toLowerCase()}.`,
        timestamp: cp.createdAt.toISOString(),
        href: `/coach/athletes/${athlete.id}/program`,
        meta: {
          recommendation: cp.recommendation,
          markTrend: cp.markTrend,
          programId: cp.program.id,
          weekNumber: cp.weekNumber,
        },
      };
    });
}

/* ─── 4. Sports Form Entered ────────────────────────────────────────────── */

async function getSportsFormActions(coachId: string): Promise<CoachingAction[]> {
  const complexes = await prisma.throwsComplex.findMany({
    where: {
      enteredSportsForm: true,
      updatedAt: { gte: daysAgo(7) },
      athlete: { coachId },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return complexes.map((cx) => {
    const name = athleteName(cx.athlete);
    const event = cx.event.replace(/_/g, " ").toLowerCase();
    return {
      id: `form-${cx.id}`,
      type: "sports_form" as const,
      severity: "info" as const,
      priority: 6,
      athleteId: cx.athleteId,
      athleteName: name,
      athleteAvatar: cx.athlete.avatarUrl,
      title: `${name} — Entered Sports Form`,
      description: `${event}${cx.peakMark ? ` — peak ${cx.peakMark.toFixed(2)}m` : ""}.${cx.sessionsToForm ? ` Took ${cx.sessionsToForm} sessions.` : ""}`,
      timestamp: cx.updatedAt.toISOString(),
      href: `/coach/athletes/${cx.athleteId}/program`,
      meta: { event: cx.event, peakMark: cx.peakMark, sessionsToForm: cx.sessionsToForm },
    };
  });
}

/* ─── 5. Readiness Drop ─────────────────────────────────────────────────── */

async function getReadinessActions(coachId: string): Promise<CoachingAction[]> {
  // Get athletes belonging to this coach
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });

  const actions: CoachingAction[] = [];

  for (const athlete of athletes) {
    // Get last 3 check-ins for this athlete
    const recentCheckins = await prisma.readinessCheckIn.findMany({
      where: { athleteId: athlete.id },
      orderBy: { date: "desc" },
      take: 3,
      select: { overallScore: true, date: true },
    });

    // Need exactly 3 check-ins and all below 5.0
    if (
      recentCheckins.length === 3 &&
      recentCheckins.every((c) => c.overallScore < 5.0)
    ) {
      const avgScore = recentCheckins.reduce((s, c) => s + c.overallScore, 0) / 3;
      const name = athleteName(athlete);
      actions.push({
        id: `readiness-${athlete.id}`,
        type: "readiness_drop",
        severity: avgScore < 3.5 ? "critical" : "warning",
        priority: avgScore < 3.5 ? 3 : 5,
        athleteId: athlete.id,
        athleteName: name,
        athleteAvatar: athlete.avatarUrl,
        title: `${name} — Readiness Declining`,
        description: `3 consecutive check-ins below 5.0 (avg ${avgScore.toFixed(1)}).`,
        timestamp: recentCheckins[0].date.toISOString(),
        href: `/coach/athletes/${athlete.id}/readiness`,
        meta: { avgScore, scores: recentCheckins.map((c) => c.overallScore) },
      });
    }
  }

  return actions;
}

/* ─── 6. Missed Sessions ────────────────────────────────────────────────── */

async function getMissedSessionActions(coachId: string): Promise<CoachingAction[]> {
  // Get athletes belonging to this coach
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });

  const actions: CoachingAction[] = [];

  for (const athlete of athletes) {
    // Get last 5 assignments for this athlete
    const last5 = await prisma.throwsAssignment.findMany({
      where: { athleteId: athlete.id },
      orderBy: { assignedDate: "desc" },
      take: 5,
      select: { id: true, status: true, assignedDate: true, updatedAt: true },
    });

    if (last5.length < 5) continue;

    const skippedCount = last5.filter((a) => a.status === "SKIPPED").length;
    if (skippedCount >= 3) {
      const name = athleteName(athlete);
      actions.push({
        id: `missed-${athlete.id}`,
        type: "missed_sessions",
        severity: skippedCount >= 4 ? "critical" : "warning",
        priority: skippedCount >= 4 ? 3 : 5,
        athleteId: athlete.id,
        athleteName: name,
        athleteAvatar: athlete.avatarUrl,
        title: `${name} — Missed Sessions`,
        description: `${skippedCount} of last 5 sessions skipped.`,
        timestamp: last5[0].updatedAt.toISOString(),
        href: `/coach/athletes/${athlete.id}/sessions`,
        meta: { skippedCount, totalChecked: 5 },
      });
    }
  }

  return actions;
}

/* ─── 7. Autoregulation Suggestions ─────────────────────────────────────── */

async function getAutoregActions(coachId: string): Promise<CoachingAction[]> {
  // No `program` relation on AutoregulationSuggestion — manual join required
  const suggestions = await prisma.autoregulationSuggestion.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (suggestions.length === 0) return [];

  // Gather unique program IDs
  const programIds = [...new Set(suggestions.map((s) => s.programId))];

  // Fetch programs that belong to this coach
  const programs = await prisma.trainingProgram.findMany({
    where: {
      id: { in: programIds },
      coachId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      athleteId: true,
      event: true,
      athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const programMap = new Map(programs.map((p) => [p.id, p]));

  return suggestions
    .filter((s) => {
      const prog = programMap.get(s.programId);
      return prog && prog.athlete;
    })
    .map((s) => {
      const prog = programMap.get(s.programId)!;
      const athlete = prog.athlete!;
      const name = athleteName(athlete);
      const timescaleLabel = s.timescale.replace(/_/g, " ").toLowerCase();
      return {
        id: `autoreg-${s.id}`,
        type: "autoregulation" as const,
        severity: "warning" as const,
        priority: 5,
        athleteId: athlete.id,
        athleteName: name,
        athleteAvatar: athlete.avatarUrl,
        title: `${name} — Autoregulation Suggestion`,
        description: `${timescaleLabel}: ${s.reasoning.slice(0, 120)}${s.reasoning.length > 120 ? "..." : ""}`,
        timestamp: s.createdAt.toISOString(),
        href: `/coach/athletes/${athlete.id}/program`,
        meta: {
          suggestedChange: s.suggestedChange,
          timescale: s.timescale,
          programId: s.programId,
          expiresAt: s.expiresAt.toISOString(),
        },
      };
    });
}

/* ─── 8. Goal At Risk ───────────────────────────────────────────────────── */

async function getGoalAtRiskActions(coachId: string): Promise<CoachingAction[]> {
  const twentyOneDaysFromNow = new Date();
  twentyOneDaysFromNow.setDate(twentyOneDaysFromNow.getDate() + 21);

  const goals = await prisma.goal.findMany({
    where: {
      status: "ACTIVE",
      deadline: { lte: twentyOneDaysFromNow, gte: new Date() },
      athlete: { coachId },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { deadline: "asc" },
  });

  return goals
    .filter((g) => {
      if (g.targetValue === 0) return false;
      const progress = g.currentValue / g.targetValue;
      return progress < 0.95;
    })
    .map((g) => {
      const name = athleteName(g.athlete);
      const progress = Math.round((g.currentValue / g.targetValue) * 100);
      const daysLeft = g.deadline
        ? Math.ceil((g.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: `goal-${g.id}`,
        type: "goal_at_risk" as const,
        severity: (progress < 50 ? "critical" : "warning") as CoachingActionSeverity,
        priority: progress < 50 ? 4 : 6,
        athleteId: g.athleteId,
        athleteName: name,
        athleteAvatar: g.athlete.avatarUrl,
        title: `${name} — Goal at Risk`,
        description: `"${g.title}" — ${progress}% complete${daysLeft !== null ? `, ${daysLeft} days left` : ""}.`,
        timestamp: g.updatedAt.toISOString(),
        href: `/coach/athletes/${g.athleteId}/goals`,
        meta: { goalTitle: g.title, progress, targetValue: g.targetValue, currentValue: g.currentValue, daysLeft },
      };
    });
}

/* ─── 9. No Check-in ────────────────────────────────────────────────────── */

async function getNoCheckinActions(coachId: string): Promise<CoachingAction[]> {
  const fiveDaysAgo = daysAgo(5);

  // Get all athletes for this coach
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });

  if (athletes.length === 0) return [];

  // Get the latest check-in per athlete in one query
  const latestCheckins = await prisma.readinessCheckIn.findMany({
    where: {
      athleteId: { in: athletes.map((a) => a.id) },
    },
    orderBy: { date: "desc" },
    distinct: ["athleteId"],
    select: { athleteId: true, date: true },
  });

  const lastCheckinMap = new Map(latestCheckins.map((c) => [c.athleteId, c.date]));

  return athletes
    .filter((a) => {
      const lastDate = lastCheckinMap.get(a.id);
      // No check-in ever OR last check-in > 5 days ago
      return !lastDate || lastDate < fiveDaysAgo;
    })
    .map((a) => {
      const name = athleteName(a);
      const lastDate = lastCheckinMap.get(a.id);
      const daysSince = lastDate
        ? Math.ceil((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: `nocheckin-${a.id}`,
        type: "no_checkin" as const,
        severity: "info" as const,
        priority: 8,
        athleteId: a.id,
        athleteName: name,
        athleteAvatar: a.avatarUrl,
        title: `${name} — No Recent Check-in`,
        description: daysSince !== null
          ? `Last check-in ${daysSince} days ago.`
          : "No check-ins recorded.",
        timestamp: lastDate?.toISOString() ?? new Date().toISOString(),
        href: `/coach/athletes/${a.id}/readiness`,
        meta: { daysSince },
      };
    });
}

/* ─── Main Function ─────────────────────────────────────────────────────── */

/**
 * Fetches coaching actions from all 9 sources, deduplicates per athlete
 * (highest-priority action wins), and returns sorted by priority.
 */
export const getCoachingActions = cache(async (coachId: string): Promise<CoachingAction[]> => {
  const results = await Promise.allSettled([
    getInjuryActions(coachId),
    getAcwrActions(coachId),
    getAdaptationActions(coachId),
    getSportsFormActions(coachId),
    getReadinessActions(coachId),
    getMissedSessionActions(coachId),
    getAutoregActions(coachId),
    getGoalAtRiskActions(coachId),
    getNoCheckinActions(coachId),
  ]);

  // Merge all fulfilled results; log (but don't crash on) rejections
  const allActions: CoachingAction[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allActions.push(...result.value);
    } else {
      console.error("[coaching-actions] Query failed:", result.reason);
    }
  }

  // Deduplicate: one action per athlete, keeping the highest-priority (lowest number)
  const bestByAthlete = new Map<string, CoachingAction>();
  for (const action of allActions) {
    const existing = bestByAthlete.get(action.athleteId);
    if (!existing || action.priority < existing.priority) {
      bestByAthlete.set(action.athleteId, action);
    }
  }

  // Sort by priority (ascending — 1 = most urgent first)
  return Array.from(bestByAthlete.values()).sort((a, b) => a.priority - b.priority);
});
