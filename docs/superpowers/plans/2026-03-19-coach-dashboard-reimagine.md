# Coach Dashboard Reimagine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the coach dashboard from a passive activity feed into a triage-first command center with coaching action cards, mode switching, smart activity feed, PR board, training load overview, and competition/adaptation sections.

**Architecture:** Server-rendered Next.js 14.2 App Router page with cookie-based mode/depth toggles (client components) controlling which sections render. All data fetching via `Promise.allSettled` in a single server component. New data functions in two files: `coaching-actions.ts` (multi-source coaching suggestions) and `dashboard-intel.ts` (PRs, load, competitions).

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma ORM, Tailwind CSS, Lucide React icons, custom component library.

**Spec:** `docs/superpowers/specs/2026-03-19-coach-dashboard-reimagine-design.md`

**Verification:** `npx tsc --noEmit` after each task (project has no test framework).

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `src/lib/data/coaching-actions.ts` | `getCoachingActions()` — multi-source coaching suggestions |
| `src/lib/data/dashboard-intel.ts` | `getRecentTeamPRs()`, `getTeamLoadOverview()`, `getUpcomingCompetitions()` |
| `src/app/(dashboard)/coach/dashboard/_mode-selector.tsx` | Client component: Training Block / Competition Prep + Standard / Advanced toggles |
| `src/app/(dashboard)/coach/dashboard/_action-cards.tsx` | Coaching Action Cards grid (Zone 1b) |
| `src/app/(dashboard)/coach/dashboard/_pr-board.tsx` | PR Board section (Zone 3a) |
| `src/app/(dashboard)/coach/dashboard/_load-overview.tsx` | Training Load Overview rows (Zone 3b) |
| `src/app/(dashboard)/coach/dashboard/_competition-countdown.tsx` | Competition Countdown cards (Zone 2b, Competition Prep only) |
| `src/app/(dashboard)/coach/dashboard/_peaking-status.tsx` | Peaking Status rows (Zone 3c, Competition Prep only) |
| `src/app/(dashboard)/coach/dashboard/_adaptation-progress.tsx` | Adaptation Progress rows (Zone 3c, Training Block + Advanced) |

### Modified Files
| File | Changes |
|---|---|
| `src/lib/data/coach.ts` | Add `throwsThisWeek` + `prsThisWeek` to `getCoachStats()`, add `notableOnly` filter + new activity types to `getRecentActivity()` |
| `src/app/(dashboard)/coach/dashboard/page.tsx` | Full rewrite: 3-zone urgency stack, mode/depth logic, all new sections |

---

## Task 1: Data — `getCoachingActions()`

**Files:**
- Create: `src/lib/data/coaching-actions.ts`

This is the most complex data function. It queries 8 sources and merges into a unified `CoachingAction[]`.

- [ ] **Step 1: Create the coaching-actions data file with types and function skeleton**

Create `src/lib/data/coaching-actions.ts`:

```typescript
import { cache } from "react";
import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type CoachingActionType =
  | "injury_active"
  | "acwr_high"
  | "complex_rotation"
  | "sports_form_entered"
  | "low_readiness_pattern"
  | "missed_sessions"
  | "deload_recommended"
  | "goal_at_risk"
  | "no_checkin";

export type CoachingActionSeverity = "critical" | "warning" | "info";

export interface CoachingAction {
  id: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  type: CoachingActionType;
  priority: number;
  summary: string;
  severity: CoachingActionSeverity;
  meta?: Record<string, unknown>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function athleteFullName(a: { firstName: string; lastName: string }): string {
  return `${a.firstName} ${a.lastName}`;
}

/* ─── Individual source queries ──────────────────────────────────────────── */

async function getInjuryActions(coachId: string): Promise<CoachingAction[]> {
  const actions: CoachingAction[] = [];
  const today = todayISO();

  // ThrowsInjury — throws-specific injuries
  const throwsInjuries = await prisma.throwsInjury.findMany({
    where: {
      athlete: { coachId },
      recovered: false,
      OR: [
        { returnToThrowDate: null },
        { returnToThrowDate: { gte: today } },
      ],
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });

  for (const inj of throwsInjuries) {
    const side = inj.side ? `${inj.side} ` : "";
    const daysSince = Math.floor(
      (Date.now() - new Date(inj.injuryDate).getTime()) / 86_400_000
    );
    const bans: string[] = [];
    if (inj.throwsBanned) bans.push("throws");
    if (inj.heavyBanned) bans.push("heavy");
    if (inj.strengthBanned) bans.push("strength");
    const banText = bans.length > 0 ? `No ${bans.join("/")} cleared.` : "Modified load.";

    actions.push({
      id: `injury-throws-${inj.id}`,
      athleteId: inj.athleteId,
      athleteName: athleteFullName(inj.athlete),
      avatarUrl: inj.athlete.avatarUrl,
      type: "injury_active",
      priority: 1,
      summary: `${side}${inj.bodyPart}, ${daysSince}d. ${banText}`,
      severity: "critical",
      meta: { bodyPart: inj.bodyPart, side: inj.side, severity: inj.severity },
    });
  }

  // General Injury model — only if not already covered by ThrowsInjury
  const coveredAthleteIds = new Set(throwsInjuries.map((i) => i.athleteId));
  const generalInjuries = await prisma.injury.findMany({
    where: {
      athlete: { coachId },
      recovered: false,
      athleteId: { notIn: [...coveredAthleteIds] },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });

  for (const inj of generalInjuries) {
    const daysSince = Math.floor(
      (Date.now() - new Date(inj.injuryDate).getTime()) / 86_400_000
    );
    actions.push({
      id: `injury-general-${inj.id}`,
      athleteId: inj.athleteId,
      athleteName: athleteFullName(inj.athlete),
      avatarUrl: inj.athlete.avatarUrl,
      type: "injury_active",
      priority: 1,
      summary: `${inj.bodyPart}, ${daysSince}d. ${inj.severity ?? "Active"}.`,
      severity: "critical",
      meta: { bodyPart: inj.bodyPart, severity: inj.severity },
    });
  }

  // ReadinessCheckIn — self-reported injury status (3rd source)
  const coveredAthleteIdsAll = new Set([...coveredAthleteIds, ...generalInjuries.map((i) => i.athleteId)]);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const selfReportedInjuries = await prisma.readinessCheckIn.findMany({
    where: {
      athlete: { coachId },
      injuryStatus: "ACTIVE",
      createdAt: { gte: sevenDaysAgo },
      athleteId: { notIn: [...coveredAthleteIdsAll] },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["athleteId"],
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });

  for (const ci of selfReportedInjuries) {
    actions.push({
      id: `injury-checkin-${ci.id}`,
      athleteId: ci.athleteId,
      athleteName: athleteFullName(ci.athlete),
      avatarUrl: ci.athlete.avatarUrl,
      type: "injury_active",
      priority: 1,
      summary: `Self-reported active injury. Review needed.`,
      severity: "critical",
    });
  }

  return actions;
}

async function getAcwrActions(coachId: string): Promise<CoachingAction[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const athleteIds = athletes.map((a) => a.id);
  if (athleteIds.length === 0) return [];

  const assessments = await prisma.riskAssessment.findMany({
    where: { athleteId: { in: athleteIds } },
    orderBy: { createdAt: "desc" },
  });

  // Latest per athlete
  const latest = new Map<string, typeof assessments[0]>();
  for (const a of assessments) {
    if (!latest.has(a.athleteId)) latest.set(a.athleteId, a);
  }

  const actions: CoachingAction[] = [];
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  for (const [athleteId, ra] of latest) {
    if (ra.acwr <= 1.3) continue;
    const athlete = athleteMap.get(athleteId)!;
    const monotonyNote = ra.monotony && ra.monotony > 2 ? ", monotony high" : "";
    actions.push({
      id: `acwr-${ra.id}`,
      athleteId,
      athleteName: athleteFullName(athlete),
      avatarUrl: athlete.avatarUrl,
      type: "acwr_high",
      priority: 2,
      summary: `ACWR ${ra.acwr.toFixed(2)}${monotonyNote}. Reduce volume.`,
      severity: "critical",
      meta: { acwr: ra.acwr, monotony: ra.monotony, riskLevel: ra.riskLevel },
    });
  }

  return actions;
}

async function getAdaptationActions(coachId: string): Promise<CoachingAction[]> {
  const checkpoints = await prisma.adaptationCheckpoint.findMany({
    where: {
      program: { coachId, athleteId: { not: null } },
      applied: false,
      recommendation: { notIn: ["CONTINUE"] },
    },
    include: {
      program: {
        select: {
          athleteId: true,
          athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const actions: CoachingAction[] = [];
  const seen = new Set<string>();

  for (const cp of checkpoints) {
    const athleteId = cp.program.athleteId;
    if (!athleteId || seen.has(athleteId)) continue;
    seen.add(athleteId);

    const athlete = cp.program.athlete!;
    const rec = cp.recommendation;

    if (rec === "ROTATE_COMPLEX") {
      actions.push({
        id: `adapt-${cp.id}`,
        athleteId,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "complex_rotation",
        priority: 3,
        summary: `${cp.weekNumber} weeks in Complex ${cp.complexNumber}, marks ${cp.markTrend.toLowerCase()}. Rotate?`,
        severity: "warning",
        meta: { recommendation: rec, markTrend: cp.markTrend, complexNumber: cp.complexNumber },
      });
    } else if (rec === "DELOAD" || rec === "REDUCE_VOLUME") {
      actions.push({
        id: `adapt-${cp.id}`,
        athleteId,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "deload_recommended",
        priority: 4,
        summary: `Marks ${cp.markTrend.toLowerCase()}, ${rec === "DELOAD" ? "deload" : "reduce volume"} recommended.`,
        severity: "warning",
        meta: { recommendation: rec, markTrend: cp.markTrend },
      });
    } else if (rec === "ADVANCE_PHASE") {
      actions.push({
        id: `adapt-${cp.id}`,
        athleteId,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "sports_form_entered",
        priority: 3,
        summary: `Phase advance recommended — shift to next phase.`,
        severity: "info",
        meta: { recommendation: rec },
      });
    }
  }

  return actions;
}

async function getSportsFormActions(coachId: string): Promise<CoachingAction[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const complexes = await prisma.throwsComplex.findMany({
    where: {
      athlete: { coachId },
      enteredSportsForm: true,
      updatedAt: { gte: sevenDaysAgo },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return complexes.map((c) => ({
    id: `sports-form-${c.id}`,
    athleteId: c.athleteId,
    athleteName: athleteFullName(c.athlete),
    avatarUrl: c.athlete.avatarUrl,
    type: "sports_form_entered" as const,
    priority: 3,
    summary: `Entered sports form in ${c.event.replace(/_/g, " ").toLowerCase()} — shift to realization.`,
    severity: "info" as const,
    meta: { event: c.event, peakMark: c.peakMark },
  }));
}

async function getReadinessActions(coachId: string): Promise<CoachingAction[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (athletes.length === 0) return [];

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const actions: CoachingAction[] = [];

  for (const athlete of athletes) {
    const recentCheckins = await prisma.readinessCheckIn.findMany({
      where: {
        athleteId: athlete.id,
        createdAt: { gte: threeDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (recentCheckins.length >= 3 && recentCheckins.every((c) => c.overallScore < 5)) {
      actions.push({
        id: `readiness-${athlete.id}`,
        athleteId: athlete.id,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "low_readiness_pattern",
        priority: 4,
        summary: `Readiness below 5 for ${recentCheckins.length} consecutive days.`,
        severity: "warning",
        meta: { latestScore: recentCheckins[0].overallScore },
      });
    }
  }

  return actions;
}

async function getMissedSessionActions(coachId: string): Promise<CoachingAction[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (athletes.length === 0) return [];

  const actions: CoachingAction[] = [];

  for (const athlete of athletes) {
    const recent = await prisma.throwsAssignment.findMany({
      where: { athleteId: athlete.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { status: true },
    });

    const skipped = recent.filter((a) => a.status === "SKIPPED").length;
    if (skipped >= 3) {
      actions.push({
        id: `missed-${athlete.id}`,
        athleteId: athlete.id,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "missed_sessions",
        priority: 4,
        summary: `Skipped ${skipped} of last ${recent.length} assigned sessions.`,
        severity: "warning",
      });
    }
  }

  return actions;
}

async function getAutoregActions(coachId: string): Promise<CoachingAction[]> {
  // AutoregulationSuggestion has no direct `program` relation in schema.
  // Manual join: fetch pending suggestions, then resolve programs + athletes.
  const suggestions = await prisma.autoregulationSuggestion.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (suggestions.length === 0) return [];

  // Resolve programIds to get coachId + athleteId
  const programIds = [...new Set(suggestions.map((s) => s.programId))];
  const programs = await prisma.trainingProgram.findMany({
    where: { id: { in: programIds }, coachId, athleteId: { not: null } },
    select: { id: true, athleteId: true },
  });
  const programMap = new Map(programs.map((p) => [p.id, p.athleteId!]));

  // Get athlete details
  const athleteIds = [...new Set(programs.map((p) => p.athleteId!))];
  const athletes = await prisma.athleteProfile.findMany({
    where: { id: { in: athleteIds } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  return suggestions
    .filter((s) => programMap.has(s.programId))
    .map((s) => {
      const athleteId = programMap.get(s.programId)!;
      const athlete = athleteMap.get(athleteId);
      if (!athlete) return null;
      return {
        id: `autoreg-${s.id}`,
        athleteId,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "deload_recommended" as const,
        priority: 4,
        summary: s.reasoning.length > 80 ? s.reasoning.slice(0, 77) + "..." : s.reasoning,
        severity: "warning" as const,
        meta: { timescale: s.timescale, suggestedChange: s.suggestedChange },
      };
    })
    .filter((a): a is CoachingAction => a !== null);
}

async function getGoalAtRiskActions(coachId: string): Promise<CoachingAction[]> {
  const twentyOneDaysFromNow = new Date();
  twentyOneDaysFromNow.setDate(twentyOneDaysFromNow.getDate() + 21);

  const goals = await prisma.goal.findMany({
    where: {
      athlete: { coachId },
      status: "ACTIVE",
      deadline: { not: null, lte: twentyOneDaysFromNow },
      targetValue: { gt: 0 },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });

  return goals
    .filter((g) => g.deadline && (g.currentValue / g.targetValue) * 100 < 95)
    .map((g) => {
      const pct = Math.round((g.currentValue / g.targetValue) * 100);
      const daysLeft = Math.ceil(
        (g.deadline!.getTime() - Date.now()) / 86_400_000
      );
      return {
        id: `goal-${g.id}`,
        athleteId: g.athleteId,
        athleteName: athleteFullName(g.athlete),
        avatarUrl: g.athlete.avatarUrl,
        type: "goal_at_risk" as const,
        priority: 5,
        summary: `${g.title} — ${pct}% with ${daysLeft}d left.`,
        severity: "info" as const,
        meta: { targetValue: g.targetValue, currentValue: g.currentValue, deadline: g.deadline },
      };
    });
}

async function getNoCheckinActions(coachId: string): Promise<CoachingAction[]> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (athletes.length === 0) return [];

  const actions: CoachingAction[] = [];

  for (const athlete of athletes) {
    const latest = await prisma.readinessCheckIn.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latest || latest.createdAt < fiveDaysAgo) {
      const daysSince = latest
        ? Math.floor((Date.now() - latest.createdAt.getTime()) / 86_400_000)
        : null;
      actions.push({
        id: `nocheckin-${athlete.id}`,
        athleteId: athlete.id,
        athleteName: athleteFullName(athlete),
        avatarUrl: athlete.avatarUrl,
        type: "no_checkin",
        priority: 6,
        summary: daysSince ? `No readiness check-in for ${daysSince} days.` : "Has never checked in.",
        severity: "info",
      });
    }
  }

  return actions;
}

/* ─── Main function ──────────────────────────────────────────────────────── */

export const getCoachingActions = cache(async function getCoachingActions(
  coachId: string
): Promise<CoachingAction[]> {
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

  const all: CoachingAction[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Deduplicate: one action per athlete, keep highest priority (lowest number)
  const byAthlete = new Map<string, CoachingAction>();
  for (const action of all.sort((a, b) => a.priority - b.priority)) {
    if (!byAthlete.has(action.athleteId)) {
      byAthlete.set(action.athleteId, action);
    }
  }

  return [...byAthlete.values()].sort((a, b) => a.priority - b.priority);
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors (or only pre-existing warnings)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/coaching-actions.ts
git commit -m "feat: add getCoachingActions() multi-source coaching suggestions"
```

---

## Task 2: Data — `dashboard-intel.ts` (PRs, Load, Competitions)

**Files:**
- Create: `src/lib/data/dashboard-intel.ts`

- [ ] **Step 1: Create dashboard-intel with all three functions**

Create `src/lib/data/dashboard-intel.ts`:

```typescript
import { cache } from "react";
import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface TeamPR {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  event: string;
  implement: string;
  distance: number;
  date: string;
  source: "TRAINING" | "COMPETITION" | null;
}

export interface TeamLoadEntry {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  throwsThisWeek: number;
  acwr: number | null;
  riskLevel: "low" | "moderate" | "high" | null;
  adaptationPhase: string | null;
  deficitClassification: string | null;
  sessionsToForm: number | null;
}

export interface UpcomingCompetition {
  id: string;
  name: string;
  event: string;
  date: string;
  daysOut: number;
  priority: "A" | "B";
  athletes: { id: string; name: string; avatarUrl: string | null }[];
  taperWeek: number | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysFromNowISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

/* ─── getRecentTeamPRs ───────────────────────────────────────────────────── */

export const getRecentTeamPRs = cache(async function getRecentTeamPRs(
  coachId: string,
  days = 14
): Promise<TeamPR[]> {
  const cutoff = daysAgoISO(days);

  const [throwsPRs, drillPRs] = await Promise.all([
    prisma.throwsPR.findMany({
      where: { athlete: { coachId }, achievedAt: { gte: cutoff } },
      include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { achievedAt: "desc" },
      take: 20,
    }),
    prisma.throwsDrillPR.findMany({
      where: { athlete: { coachId }, achievedAt: { gte: cutoff } },
      include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { achievedAt: "desc" },
      take: 20,
    }),
  ]);

  const all: TeamPR[] = [
    ...throwsPRs.map((pr) => ({
      athleteId: pr.athleteId,
      athleteName: `${pr.athlete.firstName} ${pr.athlete.lastName}`,
      avatarUrl: pr.athlete.avatarUrl,
      event: pr.event,
      implement: pr.implement,
      distance: pr.distance,
      date: pr.achievedAt,
      source: (pr.source as "TRAINING" | "COMPETITION") ?? null,
    })),
    ...drillPRs.map((pr) => ({
      athleteId: pr.athleteId,
      athleteName: `${pr.athlete.firstName} ${pr.athlete.lastName}`,
      avatarUrl: pr.athlete.avatarUrl,
      event: pr.event,
      implement: pr.implement,
      distance: pr.distance,
      date: pr.achievedAt,
      source: null as "TRAINING" | "COMPETITION" | null,
    })),
  ];

  return all
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
});

/* ─── getTeamLoadOverview ────────────────────────────────────────────────── */

export const getTeamLoadOverview = cache(async function getTeamLoadOverview(
  coachId: string
): Promise<TeamLoadEntry[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  if (athletes.length === 0) return [];

  const athleteIds = athletes.map((a) => a.id);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Parallel: throw volumes, risk assessments, adaptation, deficits
  const [blockLogs, practiceAttempts, drillLogs, riskAssessments, adaptationCheckpoints, throwsProfiles, throwsTypings] =
    await Promise.all([
      prisma.throwsBlockLog.groupBy({
        by: ["assignmentId"],
        where: { assignment: { athleteId: { in: athleteIds } }, createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }).then(async (groups) => {
        // Need to map assignmentId -> athleteId
        if (groups.length === 0) return new Map<string, number>();
        const assignmentIds = groups.map((g) => g.assignmentId);
        const assignments = await prisma.throwsAssignment.findMany({
          where: { id: { in: assignmentIds } },
          select: { id: true, athleteId: true },
        });
        const assignToAthlete = new Map(assignments.map((a) => [a.id, a.athleteId]));
        const counts = new Map<string, number>();
        for (const g of groups) {
          const aid = assignToAthlete.get(g.assignmentId);
          if (aid) counts.set(aid, (counts.get(aid) ?? 0) + g._count.id);
        }
        return counts;
      }),
      prisma.practiceAttempt.groupBy({
        by: ["athleteId"],
        where: { athleteId: { in: athleteIds }, createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }),
      prisma.athleteDrillLog.groupBy({
        by: ["sessionId"],
        where: { session: { athleteId: { in: athleteIds } }, createdAt: { gte: sevenDaysAgo } },
        _sum: { throwCount: true },
      }).then(async (groups) => {
        if (groups.length === 0) return new Map<string, number>();
        const sessionIds = groups.map((g) => g.sessionId);
        const sessions = await prisma.athleteThrowsSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, athleteId: true },
        });
        const sessionToAthlete = new Map(sessions.map((s) => [s.id, s.athleteId]));
        const counts = new Map<string, number>();
        for (const g of groups) {
          const aid = sessionToAthlete.get(g.sessionId);
          if (aid) counts.set(aid, (counts.get(aid) ?? 0) + (g._sum.throwCount ?? 0));
        }
        return counts;
      }),
      prisma.riskAssessment.findMany({
        where: { athleteId: { in: athleteIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adaptationCheckpoint.findMany({
        where: { program: { coachId, athleteId: { in: athleteIds } } },
        include: { program: { select: { athleteId: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.throwsProfile.findMany({
        where: { athleteId: { in: athleteIds } },
        select: { athleteId: true, deficitStatus: true, overPowered: true, muscledOut: true },
      }),
      prisma.throwsTyping.findMany({
        where: { athleteId: { in: athleteIds } },
        select: { athleteId: true, estimatedSessionsToForm: true },
      }),
    ]);

  // Index: latest risk per athlete
  const latestRisk = new Map<string, typeof riskAssessments[0]>();
  for (const ra of riskAssessments) {
    if (!latestRisk.has(ra.athleteId)) latestRisk.set(ra.athleteId, ra);
  }

  // Index: latest adaptation per athlete
  const latestAdapt = new Map<string, typeof adaptationCheckpoints[0]>();
  for (const cp of adaptationCheckpoints) {
    const aid = cp.program.athleteId;
    if (aid && !latestAdapt.has(aid)) latestAdapt.set(aid, cp);
  }

  // Index: practice attempts per athlete
  const practiceMap = new Map(practiceAttempts.map((p) => [p.athleteId, p._count.id]));

  // Index: deficit classification
  const deficitMap = new Map<string, string | null>();
  for (const tp of throwsProfiles) {
    if (tp.muscledOut) deficitMap.set(tp.athleteId, "Muscled Out");
    else if (tp.overPowered) deficitMap.set(tp.athleteId, "Over-powered");
    else if (tp.deficitStatus) deficitMap.set(tp.athleteId, tp.deficitStatus);
    else deficitMap.set(tp.athleteId, null);
  }

  // Index: sessions to form
  const stfMap = new Map(throwsTypings.map((t) => [t.athleteId, t.estimatedSessionsToForm]));

  // Adaptation phase mapping
  function getAdaptPhase(cp: typeof adaptationCheckpoints[0] | undefined): string | null {
    if (!cp) return null;
    const rec = cp.recommendation;
    if (rec === "ADVANCE_PHASE") return "in-form";
    if (rec === "DELOAD" || rec === "REDUCE_VOLUME") return "readaptation-risk";
    if (cp.markTrend === "IMPROVING") return "adapting";
    return "loading";
  }

  return athletes.map((athlete) => {
    const blockCount = blockLogs.get(athlete.id) ?? 0;
    const practiceCount = practiceMap.get(athlete.id) ?? 0;
    const drillCount = drillLogs.get(athlete.id) ?? 0;
    const throws = blockCount + practiceCount + drillCount;

    const risk = latestRisk.get(athlete.id);
    const adapt = latestAdapt.get(athlete.id);

    return {
      athleteId: athlete.id,
      athleteName: `${athlete.firstName} ${athlete.lastName}`,
      avatarUrl: athlete.avatarUrl,
      throwsThisWeek: throws,
      acwr: risk?.acwr ?? null,
      riskLevel: risk ? (risk.acwr > 1.3 ? "high" : risk.acwr > 1.0 ? "moderate" : "low") : null,
      adaptationPhase: getAdaptPhase(adapt),
      deficitClassification: deficitMap.get(athlete.id) ?? null,
      sessionsToForm: stfMap.get(athlete.id) ?? null,
    };
  }).sort((a, b) => {
    // Red first, then amber, then green, then no data
    const riskOrder = { high: 0, moderate: 1, low: 2 };
    const aOrder = a.riskLevel ? riskOrder[a.riskLevel] : 3;
    const bOrder = b.riskLevel ? riskOrder[b.riskLevel] : 3;
    return aOrder - bOrder;
  });
});

/* ─── getUpcomingCompetitions ────────────────────────────────────────────── */

export const getUpcomingCompetitions = cache(async function getUpcomingCompetitions(
  coachId: string
): Promise<UpcomingCompetition[]> {
  const today = todayISO();
  const sixtyDaysOut = daysFromNowISO(60);

  const competitions = await prisma.throwsCompetition.findMany({
    where: {
      athlete: { coachId },
      date: { gte: today, lte: sixtyDaysOut },
      priority: { in: ["A", "B"] },
    },
    include: { athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: { date: "asc" },
  });

  // Group by competition name + date (multiple athletes may share a competition)
  const grouped = new Map<string, UpcomingCompetition>();
  for (const comp of competitions) {
    const key = `${comp.name}-${comp.date}`;
    const daysOut = daysBetween(comp.date);
    const taperWeek = daysOut <= 21 ? Math.min(3, Math.max(1, Math.ceil((21 - daysOut) / 7))) : null;

    if (grouped.has(key)) {
      grouped.get(key)!.athletes.push({
        id: comp.athlete.id,
        name: `${comp.athlete.firstName} ${comp.athlete.lastName}`,
        avatarUrl: comp.athlete.avatarUrl,
      });
    } else {
      grouped.set(key, {
        id: comp.id,
        name: comp.name,
        event: comp.event,
        date: comp.date,
        daysOut,
        priority: comp.priority as "A" | "B",
        athletes: [{
          id: comp.athlete.id,
          name: `${comp.athlete.firstName} ${comp.athlete.lastName}`,
          avatarUrl: comp.athlete.avatarUrl,
        }],
        taperWeek,
      });
    }
  }

  return [...grouped.values()];
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-intel.ts
git commit -m "feat: add dashboard-intel data functions (PRs, load, competitions)"
```

---

## Task 3: Data — Enhance `getCoachStats()` and `getRecentActivity()`

**Files:**
- Modify: `src/lib/data/coach.ts`

- [ ] **Step 1: Add `throwsThisWeek` and `prsThisWeek` to `CoachStats` and `getCoachStats()`**

In `src/lib/data/coach.ts`:

1. Update the `CoachStats` type (around line 154) to add two fields:
```typescript
export type CoachStats = {
  totalAthletes: number;
  lowReadiness: number;
  sessionsToday: number;
  injured: number;
  complianceRate: number | null;
  throwsThisWeek: number;
  prsThisWeek: number;
};
```

2. Inside `getCoachStats()` function (around line 216-272), add queries for 7-day throw count and PR count after the existing queries. Add the results to the return object.

The throw count comes from `ThrowsBlockLog` + `PracticeAttempt` + `AthleteDrillLog` (sum `throwCount`) in the last 7 days scoped to the coach's roster athletes.

The PR count comes from `ThrowsPR` + `ThrowsDrillPR` where `achievedAt >= daysAgoISO(7)` scoped to roster athletes.

- [ ] **Step 2: Add `notableOnly` parameter and new activity types to `getRecentActivity()`**

In `src/lib/data/coach.ts`:

1. Update the `ActivityItem` type (around line 33) to add new types:
```typescript
export type ActivityItem = {
  id: string;
  type: "check_in" | "personal_best" | "session_complete" | "streak_break" | "injury_change" | "missed_session" | "sports_form" | "autoregulation";
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  date: string;
  score?: number;
  event?: string;
  distance?: number;
  rpe?: number | null;
  detail?: string;       // new — extra context for new types
};
```

2. Change signature to `getRecentActivity(coachId: string, limit = 20, notableOnly = false)`
3. When `notableOnly = true`:
   - For check-ins: only include where `overallScore < 4.0`
   - For PRs: keep all (they're always notable)
   - For sessions: exclude routine completions entirely
   - Add: missed sessions query: `prisma.throwsAssignment.findMany({ where: { athlete: { coachId }, status: "SKIPPED", updatedAt: { gte: cutoff48h } } })` — map to `ActivityItem` with `type: "missed_session"`, `detail: skipReason`
   - Add: sports form query: `prisma.throwsComplex.findMany({ where: { athlete: { coachId }, enteredSportsForm: true, updatedAt: { gte: cutoff48h } } })` — map to `ActivityItem` with `type: "sports_form"`, `event: complex.event`
   - Add: autoregulation query: `prisma.autoregulationSuggestion.findMany({ where: { status: "PENDING", createdAt: { gte: cutoff48h } } })` — manual join through `TrainingProgram` (same pattern as coaching-actions), map to `ActivityItem` with `type: "autoregulation"`, `detail: reasoning`

4. In `page.tsx`, add corresponding `ActivityIcon` and `ActivityDescription` cases:
   - `missed_session`: icon = `XCircle` (lucide), red bg, description = "{name} skipped an assigned session"
   - `sports_form`: icon = `Sparkles` (lucide), amber bg, description = "{name} entered sports form in {event}"
   - `autoregulation`: icon = `Settings` (lucide), blue bg, description = "{name} — autoregulation: {detail}"
   - `streak_break`: icon = `AlertTriangle` (lucide), orange bg, description = "{name}'s streak ended"
   - `injury_change`: icon = `Heart` (lucide, same as check_in), red bg, description = "{name} reported an injury"

- [ ] **Step 3: Update the default return value in `page.tsx` to include new stats fields**

In `src/app/(dashboard)/coach/dashboard/page.tsx` (around line 386-387), update the fallback CoachStats to include:
```typescript
{ totalAthletes: 0, lowReadiness: 0, sessionsToday: 0, injured: 0, complianceRate: null, throwsThisWeek: 0, prsThisWeek: 0 }
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/coach.ts src/app/(dashboard)/coach/dashboard/page.tsx
git commit -m "feat: enhance coach stats with weekly throws/PRs and smart activity filter"
```

---

## Task 4: Component — Mode Selector + Depth Toggle

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_mode-selector.tsx`

- [ ] **Step 1: Create the mode selector client component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardMode = "training" | "competition";
export type DashboardDepth = "standard" | "advanced";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365}`;
}

export function ModeSelector({
  mode,
  depth,
}: {
  mode: DashboardMode;
  depth: DashboardDepth;
}) {
  const router = useRouter();

  function setMode(m: DashboardMode) {
    setCookie("dashboard-mode", m);
    router.refresh();
  }

  function setDepth(d: DashboardDepth) {
    setCookie("dashboard-depth", d);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Mode toggle */}
      <div className="inline-flex rounded-lg bg-surface-100 dark:bg-surface-800 p-0.5">
        <button
          onClick={() => setMode("training")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "training"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          Training Block
        </button>
        <button
          onClick={() => setMode("competition")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === "competition"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          Competition Prep
        </button>
      </div>

      {/* Depth toggle */}
      <button
        onClick={() => setDepth(depth === "standard" ? "advanced" : "standard")}
        className="text-[10px] font-medium text-surface-400 hover:text-[var(--foreground)] transition-colors"
      >
        {depth === "standard" ? "Show Advanced" : "Hide Advanced"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/coach/dashboard/_mode-selector.tsx
git commit -m "feat: add dashboard mode selector (training/competition + depth toggle)"
```

---

## Task 5: Component — Action Cards

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_action-cards.tsx`

- [ ] **Step 1: Create the action cards component**

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import type { CoachingAction } from "@/lib/data/coaching-actions";
import type { DashboardDepth } from "./_mode-selector";

interface ActionCardsProps {
  actions: CoachingAction[];
  depth: DashboardDepth;
}

// Severity → left border color
const borderColorMap: Record<CoachingAction["severity"], string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
};

// Severity → Badge variant
const badgeVariantMap: Record<CoachingAction["severity"], "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export function ActionCards({ actions, depth }: ActionCardsProps) {
  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
        <CheckCircle2 size={16} strokeWidth={1.75} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          All clear — no actions needed
        </span>
      </div>
    );
  }

  const visible = actions.slice(0, 6);
  const overflow = actions.length - 6;

  return (
    <section>
      <h2 className="text-sm font-bold text-[var(--foreground)]">
        Coaching Actions
        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold align-middle">
          {actions.length}
        </span>
      </h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {visible.map((action) => (
          <Link
            key={action.id}
            href={`/coach/athletes/${action.athleteId}`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl",
              "bg-[var(--card-bg)] border border-[var(--card-border)]",
              "border-l-[3px]", borderColorMap[action.severity],
              "hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            )}
          >
            <Avatar name={action.athleteName} src={action.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {action.athleteName}
              </p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">{action.summary}</p>
              {depth === "advanced" && action.meta && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {action.meta.acwr != null && (
                    <Badge variant="neutral">ACWR {Number(action.meta.acwr).toFixed(2)}</Badge>
                  )}
                  {action.meta.adaptationPhase && (
                    <Badge variant="neutral">{String(action.meta.adaptationPhase)}</Badge>
                  )}
                  {action.meta.deficitClassification && (
                    <Badge variant="neutral">{String(action.meta.deficitClassification)}</Badge>
                  )}
                </div>
              )}
            </div>
            <ChevronRight size={16} strokeWidth={1.75} className="text-surface-400 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
      {overflow > 0 && (
        <div className="mt-2 pl-1">
          <Link href="/coach/athletes" className="text-xs text-primary-500 hover:underline">
            View all {actions.length} items &rarr;
          </Link>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_action-cards.tsx
git commit -m "feat: add coaching action cards component"
```

---

## Task 6: Component — PR Board

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_pr-board.tsx`

- [ ] **Step 1: Create the PR board component**

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { Award } from "lucide-react";
import type { TeamPR } from "@/lib/data/dashboard-intel";

interface PRBoardProps {
  prs: TeamPR[];
}

function formatEventName(event: string): string {
  return event.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PRBoard({ prs }: PRBoardProps) {
  if (prs.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
          <Award size={14} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
          Recent PRs
          <span className="text-xs font-normal normal-case text-surface-400">last 14 days</span>
        </h2>
        <Link href="/coach/throws" className="text-xs text-primary-500 hover:underline">View all</Link>
      </div>

      {/* Desktop: table layout */}
      <div className="card overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[var(--card-border)]">
            {prs.map((pr) => (
              <Link
                key={`${pr.athleteId}-${pr.event}-${pr.date}`}
                href={`/coach/athletes/${pr.athleteId}`}
                className="table-row hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <td className="px-4 py-3 flex items-center gap-2">
                  <Avatar name={pr.athleteName} src={pr.avatarUrl} size="xs" />
                  <span className="font-medium text-[var(--foreground)] truncate">{pr.athleteName}</span>
                </td>
                <td className="px-4 py-3 text-muted">{formatEventName(pr.event)}</td>
                <td className="px-4 py-3 text-muted">{pr.implement}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-amber-600 dark:text-amber-400">{pr.distance.toFixed(2)}m</td>
                <td className="px-4 py-3 text-muted text-xs">{pr.date}</td>
                <td className="px-4 py-3">
                  {pr.source && <Badge variant={pr.source === "COMPETITION" ? "primary" : "neutral"}>{pr.source.toLowerCase()}</Badge>}
                </td>
              </Link>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-2">
        {prs.map((pr) => (
          <Link
            key={`${pr.athleteId}-${pr.event}-${pr.date}-m`}
            href={`/coach/athletes/${pr.athleteId}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <Avatar name={pr.athleteName} src={pr.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">{pr.athleteName}</p>
              <p className="text-xs text-muted">{formatEventName(pr.event)} &middot; {pr.implement}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{pr.distance.toFixed(2)}m</p>
              <p className="text-[10px] text-muted">{pr.date}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_pr-board.tsx
git commit -m "feat: add PR board component"
```

---

## Task 7: Component — Training Load Overview

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_load-overview.tsx`

- [ ] **Step 1: Create the load overview component**

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import type { TeamLoadEntry } from "@/lib/data/dashboard-intel";
import type { DashboardDepth } from "./_mode-selector";

interface LoadOverviewProps {
  entries: TeamLoadEntry[];
  depth: DashboardDepth;
}

// ACWR color mapping
function acwrColor(acwr: number | null): string {
  if (acwr === null) return "text-muted";
  if (acwr > 1.3) return "text-red-600 dark:text-red-400";
  if (acwr > 1.0) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

// Risk → Badge variant
function riskVariant(level: string | null): "success" | "warning" | "danger" | "neutral" {
  if (level === "high") return "danger";
  if (level === "moderate") return "warning";
  if (level === "low") return "success";
  return "neutral";
}

export function LoadOverview({ entries, depth }: LoadOverviewProps) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Training Load
        <span className="ml-2 text-xs font-normal normal-case text-surface-400">7-day overview</span>
      </h2>

      {/* Desktop rows */}
      <div className="card overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--muted-bg)]">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Athlete</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">Throws</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">ACWR</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Risk</th>
              {depth === "advanced" && (
                <>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Phase</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Deficit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">STF</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--card-border)]">
            {entries.map((e) => (
              <tr key={e.athleteId} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/coach/athletes/${e.athleteId}`} className="flex items-center gap-2">
                    <Avatar name={e.athleteName} src={e.avatarUrl} size="xs" />
                    <span className="font-medium text-[var(--foreground)] truncate">{e.athleteName}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--foreground)]">{e.throwsThisWeek}</td>
                <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", acwrColor(e.acwr))}>
                  {e.acwr !== null ? e.acwr.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">
                  {e.riskLevel ? <Badge variant={riskVariant(e.riskLevel)}>{e.riskLevel}</Badge> : <span className="text-muted">—</span>}
                </td>
                {depth === "advanced" && (
                  <>
                    <td className="px-4 py-3 text-xs text-muted">{e.adaptationPhase ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{e.deficitClassification ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted">{e.sessionsToForm ?? "—"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: compact cards */}
      <div className="sm:hidden space-y-2">
        {entries.map((e) => (
          <Link
            key={`${e.athleteId}-m`}
            href={`/coach/athletes/${e.athleteId}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]"
          >
            <Avatar name={e.athleteName} src={e.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">{e.athleteName}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-xs text-muted tabular-nums">{e.throwsThisWeek} throws</span>
                {e.acwr !== null && (
                  <span className={cn("text-xs font-semibold tabular-nums", acwrColor(e.acwr))}>
                    ACWR {e.acwr.toFixed(2)}
                  </span>
                )}
                {e.riskLevel && <Badge variant={riskVariant(e.riskLevel)}>{e.riskLevel}</Badge>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_load-overview.tsx
git commit -m "feat: add training load overview component"
```

---

## Task 8: Component — Competition Countdown

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_competition-countdown.tsx`

- [ ] **Step 1: Create the competition countdown component**

```typescript
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import type { UpcomingCompetition } from "@/lib/data/dashboard-intel";

interface CompetitionCountdownProps {
  competitions: UpcomingCompetition[];
}

function formatEventName(event: string): string {
  return event.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CompetitionCountdown({ competitions }: CompetitionCountdownProps) {
  if (competitions.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Upcoming Competitions
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {competitions.map((comp) => (
          <div
            key={comp.id}
            className={cn(
              "shrink-0 w-56 p-4 rounded-xl",
              "bg-[var(--card-bg)] border border-[var(--card-border)]"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <Badge variant={comp.priority === "A" ? "primary" : "neutral"}>{comp.priority}</Badge>
              {comp.taperWeek && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Taper Wk {comp.taperWeek}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
              {comp.daysOut}<span className="text-sm font-normal text-muted ml-1">days</span>
            </p>
            <p className="text-sm font-medium text-[var(--foreground)] mt-1 truncate">{comp.name}</p>
            <p className="text-xs text-muted">{formatEventName(comp.event)}</p>
            {/* Avatar stack */}
            <div className="flex items-center mt-3 -space-x-2">
              {comp.athletes.slice(0, 4).map((a) => (
                <Avatar key={a.id} name={a.name} src={a.avatarUrl} size="xs" />
              ))}
              {comp.athletes.length > 4 && (
                <span className="ml-1 text-[10px] text-muted">+{comp.athletes.length - 4}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_competition-countdown.tsx
git commit -m "feat: add competition countdown component"
```

---

## Task 9: Component — Peaking Status

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_peaking-status.tsx`

- [ ] **Step 1: Create the peaking status component**

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { generateTaperPlan } from "@/lib/throws/profile-utils";
import type { UpcomingCompetition } from "@/lib/data/dashboard-intel";
import type { TeamReadinessEntry } from "@/lib/data/coach";

interface PeakingStatusProps {
  competitions: UpcomingCompetition[];
  readiness: TeamReadinessEntry[];
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" | null }) {
  if (trend === "up") return <TrendingUp size={14} strokeWidth={1.75} className="text-emerald-500" aria-hidden="true" />;
  if (trend === "down") return <TrendingDown size={14} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />;
  if (trend === "stable") return <Minus size={14} strokeWidth={1.75} className="text-surface-400" aria-hidden="true" />;
  return null;
}

export function PeakingStatus({ competitions, readiness }: PeakingStatusProps) {
  // Build per-athlete peaking rows from competition data
  const athleteRows: {
    athleteId: string;
    athleteName: string;
    avatarUrl: string | null;
    competitionName: string;
    daysOut: number;
    taperWeek: number | null;
    volumeReduction: number | null;
    readinessScore: number | null;
    readinessTrend: "up" | "down" | "stable" | null;
  }[] = [];

  for (const comp of competitions) {
    const taper = generateTaperPlan(comp.daysOut);
    const volumeReduction = taper ? Math.round((1 - taper.volumeMultiplier) * 100) : null;

    for (const athlete of comp.athletes) {
      const readinessEntry = readiness.find((r) => r.athleteId === athlete.id);
      athleteRows.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        avatarUrl: athlete.avatarUrl,
        competitionName: comp.name,
        daysOut: comp.daysOut,
        taperWeek: comp.taperWeek,
        volumeReduction,
        readinessScore: readinessEntry?.latestScore ?? null,
        readinessTrend: readinessEntry?.trend ?? null,
      });
    }
  }

  if (athleteRows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Peaking Status
      </h2>
      <div className="card overflow-hidden">
        <div className="divide-y divide-[var(--card-border)]">
          {athleteRows.map((row) => (
            <Link
              key={`${row.athleteId}-${row.competitionName}`}
              href={`/coach/athletes/${row.athleteId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <Avatar name={row.athleteName} src={row.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{row.athleteName}</p>
                <p className="text-xs text-muted truncate">{row.competitionName} &middot; {row.daysOut}d</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                {row.taperWeek && <Badge variant="warning">Taper {row.taperWeek}</Badge>}
                {row.volumeReduction !== null && row.volumeReduction > 0 && (
                  <span className="text-muted tabular-nums">-{row.volumeReduction}% vol</span>
                )}
                <div className="flex items-center gap-1">
                  <TrendIcon trend={row.readinessTrend} />
                  <span className={cn(
                    "font-semibold tabular-nums",
                    row.readinessScore !== null && row.readinessScore >= 7
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.readinessScore !== null && row.readinessScore >= 4
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {row.readinessScore?.toFixed(1) ?? "—"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_peaking-status.tsx
git commit -m "feat: add peaking status component (competition prep mode)"
```

---

## Task 10: Component — Adaptation Progress

**Files:**
- Create: `src/app/(dashboard)/coach/dashboard/_adaptation-progress.tsx`

- [ ] **Step 1: Create the adaptation progress component**

This component needs data from `AdaptationCheckpoint` + `ThrowsComplex`. The data fetch happens in `page.tsx` and is passed as props.

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AdaptationRow {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  complexNumber: number;
  sessionsInComplex: number;
  sessionsToForm: number | null;
  markSlope: number | null;
  markTrend: string;
  recommendation: string;
}

interface AdaptationProgressProps {
  rows: AdaptationRow[];
}

// markSlope: positive = up, negative = down, abs < 0.05 = flat
function MarkTrendIcon({ slope }: { slope: number | null }) {
  if (slope === null) return <Minus size={14} strokeWidth={1.75} className="text-surface-400" aria-hidden="true" />;
  if (Math.abs(slope) < 0.05) return <Minus size={14} strokeWidth={1.75} className="text-surface-400" aria-hidden="true" />;
  if (slope > 0) return <TrendingUp size={14} strokeWidth={1.75} className="text-emerald-500" aria-hidden="true" />;
  return <TrendingDown size={14} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />;
}

// Phase badge color mapping
function phaseVariant(rec: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (rec === "ADVANCE_PHASE") return "success";
  if (rec === "DELOAD" || rec === "REDUCE_VOLUME") return "danger";
  if (rec === "ROTATE_COMPLEX") return "warning";
  return "neutral";
}

function phaseLabel(rec: string, markTrend: string): string {
  if (rec === "ADVANCE_PHASE") return "In Form";
  if (rec === "DELOAD" || rec === "REDUCE_VOLUME") return "Readapt Risk";
  if (markTrend === "IMPROVING") return "Adapting";
  return "Loading";
}

export function AdaptationProgress({ rows }: AdaptationProgressProps) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Adaptation Progress
      </h2>
      <div className="card overflow-hidden">
        <div className="divide-y divide-[var(--card-border)]">
          {rows.map((row) => (
            <Link
              key={row.athleteId}
              href={`/coach/athletes/${row.athleteId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <Avatar name={row.athleteName} src={row.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{row.athleteName}</p>
                <p className="text-xs text-muted">
                  Complex {row.complexNumber} &middot; {row.sessionsInComplex}
                  {row.sessionsToForm ? ` / ${row.sessionsToForm}` : ""} sessions
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <MarkTrendIcon slope={row.markSlope} />
                <Badge variant={phaseVariant(row.recommendation)}>
                  {phaseLabel(row.recommendation, row.markTrend)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/(dashboard)/coach/dashboard/_adaptation-progress.tsx
git commit -m "feat: add adaptation progress component (training block + advanced)"
```

---

## Task 11: Rewrite — Main Dashboard Page

**Files:**
- Modify: `src/app/(dashboard)/coach/dashboard/page.tsx`

This is the largest task — rewriting the page layout to the 3-zone urgency stack.

- [ ] **Step 1: Read cookies for mode and depth**

At the top of the server component, read cookies:
```typescript
import { cookies } from "next/headers";

// Inside the component:
const cookieStore = cookies();
const mode = (cookieStore.get("dashboard-mode")?.value ?? "training") as DashboardMode;
const depth = (cookieStore.get("dashboard-depth")?.value ?? "standard") as DashboardDepth;
```

- [ ] **Step 2: Update data fetching to include new sources**

Add to `Promise.allSettled`:
- `getCoachingActions(coach.id)` from `@/lib/data/coaching-actions`
- `getRecentTeamPRs(coach.id)` from `@/lib/data/dashboard-intel`
- `getTeamLoadOverview(coach.id)` from `@/lib/data/dashboard-intel`
- `getUpcomingCompetitions(coach.id)` from `@/lib/data/dashboard-intel` (only when mode === "competition")
- Pass `notableOnly: true` to `getRecentActivity()`

Remove the inline `recentAthleteLogsResult` Prisma query (absorbed into smart activity feed).

- [ ] **Step 3: Rewrite the JSX layout**

Replace the current layout with the 3-zone structure:

**Header area:**
- Left: greeting + date (keep)
- Right: `<ModeSelector mode={mode} depth={depth} />` (replaces "+ Invite Athlete" button)
- Below: enhanced `<StatBar>` with `throwsThisWeek` and `prsThisWeek`

**Zone 1 — Triage:**
- Alert bar (keep existing injury alert)
- `<ActionCards actions={coachingActions} depth={depth} />`

**Zone 2 — Team Pulse:**
- Competition Countdown (only when `mode === "competition"` and competitions exist)
- Two-column grid: Smart Activity Feed (left, lg:col-span-3) + Team Readiness (right, lg:col-span-2)

**Zone 3 — Intel:**
- PR Board
- Load Overview
- Context section: Adaptation Progress (training + advanced) OR Peaking Status (competition)

Keep: `<CheckoutTrigger />`, `<OnboardingChecklist>`, `<UpgradeBanner>`, `<FirstVisitHints />`
Remove: `<FlaggedCard>` component, `<RecentAthleteLogs>` section, "All athletes healthy" banner (replaced by ActionCards empty state)

- [ ] **Step 4: Clean up removed inline components**

Remove from `page.tsx` the components that are no longer used:
- `FlaggedCard` function
- The `recentAthleteLogs` rendering section

Keep in `page.tsx`:
- `formatRelativeTime` helper
- `formatEventName` helper
- `StatBar` component (enhanced)
- `ActivityIcon`, `ActivityDescription`, `ActivityFeed` components
- `TrendIcon`, `ReadinessWidget` components

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/coach/dashboard/page.tsx
git commit -m "feat: rewrite coach dashboard to 3-zone triage command center"
```

---

## Task 12: Verification + Cleanup

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: 0 errors (warnings acceptable)

- [ ] **Step 3: Visual review — start dev server and check the dashboard**

Run: `npm run dev`

Verify:
- Mode selector toggles between Training Block / Competition Prep
- Depth toggle shows/hides advanced columns
- Action cards render with correct border colors and suggestions
- Activity feed shows only notable events
- Stat bar includes throws and PRs this week
- PR board shows recent PRs with gold accent
- Training Load Overview shows ACWR colors
- Competition Countdown shows in Competition Prep mode (if competition data exists)
- Adaptation Progress shows in Training Block + Advanced mode (if adaptation data exists)
- Dark mode renders correctly
- Mobile layout stacks properly

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "fix: dashboard cleanup after visual review"
```
