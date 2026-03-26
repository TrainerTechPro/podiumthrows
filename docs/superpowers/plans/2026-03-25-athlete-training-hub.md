# Athlete Training Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat athlete sessions list with a context-aware Training Hub that renders 3 states (active, between-sessions, cold-start) and lets athletes request programming from their coach.

**Architecture:** Server Component page fetches all data in `src/lib/data/training-hub.ts`, computes the current state, then passes serialized data to a client component `_training-hub.tsx` which renders the correct state. A new `POST /api/athlete/request-programming` endpoint handles coach notifications with 48h cooldown. All UI uses existing design system components (no new dependencies).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma, Tailwind CSS, Lucide icons, existing custom component library.

**Spec:** `docs/superpowers/specs/2026-03-25-athlete-training-hub-design.md`

---

### Task 1: Add PROGRAMMING_REQUESTED notification type + creator function

**Files:**
- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Add the new type to NotificationType union**

In `src/lib/notifications.ts`, add `"PROGRAMMING_REQUESTED"` to the `NotificationType` union (after `"INVITATION_EXPIRED"`):

```typescript
export type NotificationType =
  | "WORKOUT_ASSIGNED"
  | "WORKOUT_COMPLETED"
  | "WORKOUT_SKIPPED"
  | "PR_ALERT"
  | "LOW_READINESS"
  | "QUESTIONNAIRE_ASSIGNED"
  | "QUESTIONNAIRE_COMPLETE"
  | "STREAK_BROKEN"
  | "ATHLETE_JOINED"
  | "PROGRAM_CHECKPOINT"
  | "COMPLEX_ROTATED"
  | "COMMENT_ADDED"
  | "VIDEO_SHARED"
  | "COMPETITION_REMINDER"
  | "INVITATION_EXPIRED"
  | "PROGRAMMING_REQUESTED";
```

- [ ] **Step 2: Add the convenience creator function**

Add this function at the bottom of `src/lib/notifications.ts`, before the legacy exports section:

```typescript
/**
 * Athlete requests programming from their coach.
 * Replaces any existing PROGRAMMING_REQUESTED notification for this athlete
 * to prevent duplicate spam.
 */
export async function notifyCoachProgrammingRequested(
  coachId: string,
  athleteProfileId: string,
  athleteName: string,
  context: {
    events: string[];
    lastSessionDate: string | null;
    daysSinceLastSession: number | null;
    readinessScore: number | null;
    recentPRs: Array<{ event: string; distance: number; implement: string }>;
    goals: Array<{ title: string; progress: number }>;
    bondarchukType: string | null;
  }
): Promise<void> {
  // Delete any existing PROGRAMMING_REQUESTED for this athlete to prevent dupes
  await prisma.notification.deleteMany({
    where: {
      coachId,
      type: "PROGRAMMING_REQUESTED",
      athleteProfileId,
    },
  });

  // Build summary body
  const parts: string[] = [];
  if (context.daysSinceLastSession != null) {
    parts.push(`Last session ${context.daysSinceLastSession} day${context.daysSinceLastSession !== 1 ? "s" : ""} ago`);
  } else {
    parts.push("No sessions yet");
  }
  if (context.readinessScore != null) {
    parts.push(`Readiness ${context.readinessScore.toFixed(1)}`);
  }
  if (context.recentPRs.length > 0) {
    const best = context.recentPRs[0];
    parts.push(`${formatEventType(best.event)} PR ${best.distance.toFixed(2)}m`);
  }

  await createNotification({
    type: "PROGRAMMING_REQUESTED",
    coachId,
    athleteProfileId,
    title: `${athleteName} is requesting programming`,
    body: parts.join(" | "),
    metadata: {
      ...context,
      athleteName,
      link: `/coach/programming?athlete=${athleteProfileId}`,
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `notifications.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add PROGRAMMING_REQUESTED notification type + creator"
```

---

### Task 2: Create training hub data fetcher

**Files:**
- Create: `src/lib/data/training-hub.ts`

This file computes the hub state and fetches all data needed for all 3 states.

- [ ] **Step 1: Create the types and main fetcher**

Create `src/lib/data/training-hub.ts`:

```typescript
/**
 * Server-side data-fetching for the Athlete Training Hub.
 * Computes state (active | between | cold-start) and returns all data
 * needed for the corresponding UI.
 */

import prisma from "@/lib/prisma";
import {
  fetchTodayWorkoutData,
  fetchReadinessData,
  type TodaySession,
} from "@/lib/data/dashboard";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type WeekDay = {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue", ...
  dayNum: number; // 25
  isToday: boolean;
  sessionType: "throws" | "lift" | "mixed" | "rest";
  sessionCount: number;
};

export type SessionPreview = {
  id: string;
  name: string;
  sessionType: "throws" | "lift" | "mixed";
  href: string;
};

export type WeekRecap = {
  completed: number;
  total: number;
  totalThrows: number;
  avgRpe: number | null;
  prsHit: number;
};

export type NextSessionInfo = {
  date: string; // YYYY-MM-DD
  name: string;
  daysUntil: number;
};

export type OnboardingItem = {
  key: string;
  label: string;
  href: string;
  completed: boolean;
};

export type TrainingHubData = {
  state: "active" | "between" | "cold-start";
  todaySessions: TodaySession[];
  weekDays: WeekDay[];
  weekRecap: WeekRecap | null;
  nextSession: NextSessionInfo | null;
  lastProgrammingRequest: string | null; // ISO date or null
  onboardingItems: OnboardingItem[] | null;
  coachName: string;
  coachAvatarUrl: string | null;
  readinessCheckedInToday: boolean;
  pendingQuestionnaires: number;
  recentCompletions: Array<{
    id: string;
    date: string;
    name: string;
    rpe: number | null;
    throwCount: number | null;
    status: string;
    href: string;
  }>;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function todayYMD(): string {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the Monday of the week containing a YYYY-MM-DD date string. */
function getMondayOf(ymd: string): Date {
  const d = new Date(ymd + "T12:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Main Fetcher ────────────────────────────────────────────────────────── */

export async function fetchTrainingHubData(
  athleteId: string
): Promise<TrainingHubData> {
  const today = todayYMD();
  const monday = getMondayOf(today);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  // Generate 7 date strings for the week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toYMD(d);
  });

  // ── Parallel fetches ──────────────────────────────────────────────────
  const [
    todaySessions,
    readiness,
    athlete,
    allProgramSessions,
    throwsAssignments,
    legacySessions,
    lastRequest,
    throwsProfile,
    goalsCount,
    pendingQuestionnaires,
    recentCompleted,
  ] = await Promise.all([
    // Today's sessions (reuse dashboard fetcher)
    fetchTodayWorkoutData(athleteId),

    // Readiness check-in today
    fetchReadinessData(athleteId),

    // Athlete + coach info
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        createdAt: true,
        coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),

    // ProgramSessions for the current week + upcoming (14 days)
    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        status: { notIn: ["SKIPPED"] },
      },
      select: {
        id: true,
        focusLabel: true,
        status: true,
        scheduledDate: true,
        weekNumber: true,
        dayOfWeek: true,
        throwsPrescription: true,
        strengthPrescription: true,
        totalThrowsTarget: true,
        completedAt: true,
        rpe: true,
        bestMark: true,
        program: {
          select: {
            event: true,
            startDate: true,
            selfProgramConfig: { select: { id: true } },
          },
        },
      },
    }),

    // ThrowsAssignments (for week + upcoming)
    prisma.throwsAssignment.findMany({
      where: {
        athleteId,
        status: { notIn: ["SKIPPED"] },
      },
      select: {
        id: true,
        assignedDate: true,
        status: true,
        rpe: true,
        completedAt: true,
        session: { select: { name: true, sessionType: true } },
      },
    }),

    // Legacy TrainingSessions
    prisma.trainingSession.findMany({
      where: { athleteId },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        rpe: true,
        plan: { select: { name: true } },
      },
      orderBy: { scheduledDate: "desc" },
      take: 50,
    }),

    // Last PROGRAMMING_REQUESTED notification from this athlete
    prisma.notification.findFirst({
      where: {
        type: "PROGRAMMING_REQUESTED",
        athleteProfileId: athleteId,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),

    // ThrowsProfile existence (for onboarding checklist)
    prisma.throwsProfile.findFirst({
      where: { athleteId },
      select: { id: true },
    }),

    // Active goals count
    prisma.goal.count({
      where: { athleteId, status: "ACTIVE" },
    }),

    // Pending questionnaires
    prisma.questionnaireAssignment.count({
      where: { athleteId, completedAt: null },
    }),

    // Recent completed sessions (any source) for recap
    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        focusLabel: true,
        scheduledDate: true,
        completedAt: true,
        status: true,
        rpe: true,
        totalThrowsActual: true,
        bestMark: true,
        program: {
          select: {
            event: true,
            selfProgramConfig: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  // ── Resolve dates for all program sessions ────────────────────────────
  type ResolvedSession = {
    id: string;
    date: string;
    name: string;
    sessionType: "throws" | "lift" | "mixed";
    status: string;
    rpe: number | null;
    throwCount: number | null;
    href: string;
    completedAt: Date | null;
  };

  const allResolved: ResolvedSession[] = [];

  for (const ps of allProgramSessions) {
    let dateStr = ps.scheduledDate;
    if (!dateStr && ps.program.startDate) {
      const start = new Date(ps.program.startDate);
      start.setDate(start.getDate() + (ps.weekNumber - 1) * 7 + (ps.dayOfWeek - 1));
      dateStr = toYMD(start);
    }
    if (!dateStr) continue;

    const hasThrows = !!ps.throwsPrescription;
    const hasLifts = !!ps.strengthPrescription;
    const sType: "throws" | "lift" | "mixed" = hasThrows && hasLifts ? "mixed" : hasLifts ? "lift" : "throws";
    const selfConfigId = ps.program.selfProgramConfig?.id;

    allResolved.push({
      id: ps.id,
      date: dateStr,
      name: ps.focusLabel || `${ps.program.event} Session`,
      sessionType: sType,
      status: ps.status,
      rpe: ps.rpe as number | null,
      throwCount: ps.totalThrowsTarget,
      href: selfConfigId
        ? `/athlete/self-program/${selfConfigId}/session/${ps.id}`
        : `/athlete/sessions/${ps.id}`,
      completedAt: ps.completedAt,
    });
  }

  for (const ta of throwsAssignments) {
    const sType = ta.session.sessionType?.toLowerCase() as "throws" | "lift" | "mixed" ?? "throws";
    allResolved.push({
      id: ta.id,
      date: ta.assignedDate,
      name: ta.session.name,
      sessionType: sType === "lift" || sType === "mixed" ? sType : "throws",
      status: ta.status,
      rpe: ta.rpe as number | null,
      throwCount: null,
      href: `/athlete/sessions/assignment/${ta.id}`,
      completedAt: ta.completedAt,
    });
  }

  for (const ls of legacySessions) {
    allResolved.push({
      id: ls.id,
      date: toYMD(ls.scheduledDate),
      name: ls.plan?.name ?? "Training Session",
      sessionType: "mixed",
      status: ls.status as string,
      rpe: ls.rpe as number | null,
      throwCount: null,
      href: `/athlete/sessions/${ls.id}`,
      completedAt: null,
    });
  }

  // ── Build week strip ──────────────────────────────────────────────────
  const weekDays: WeekDay[] = weekDates.map((date, i) => {
    const sessionsOnDay = allResolved.filter((s) => s.date === date && s.status !== "COMPLETED" && s.status !== "SKIPPED");
    const completedOnDay = allResolved.filter((s) => s.date === date && s.status === "COMPLETED");
    const allOnDay = [...sessionsOnDay, ...completedOnDay];

    let sessionType: WeekDay["sessionType"] = "rest";
    if (allOnDay.length > 0) {
      const types = allOnDay.map((s) => s.sessionType);
      if (types.includes("mixed") || (types.includes("throws") && types.includes("lift"))) sessionType = "mixed";
      else if (types.includes("lift")) sessionType = "lift";
      else if (types.includes("throws")) sessionType = "throws";
    }

    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayNum: new Date(date + "T12:00:00").getDate(),
      isToday: date === today,
      sessionType,
      sessionCount: allOnDay.length,
    };
  });

  // ── Find next upcoming session ────────────────────────────────────────
  const futureUpcoming = allResolved
    .filter((s) => s.date > today && ["SCHEDULED", "PLANNED", "ASSIGNED", "NOTIFIED"].includes(s.status))
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextSession: NextSessionInfo | null = futureUpcoming.length > 0
    ? {
        date: futureUpcoming[0].date,
        name: futureUpcoming[0].name,
        daysUntil: Math.ceil(
          (new Date(futureUpcoming[0].date + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      }
    : null;

  // ── Week recap (completed this week) ──────────────────────────────────
  const completedThisWeek = allResolved.filter(
    (s) => s.status === "COMPLETED" && s.date >= weekDates[0] && s.date <= weekDates[6]
  );
  const scheduledThisWeek = allResolved.filter(
    (s) => s.date >= weekDates[0] && s.date <= weekDates[6] && s.status !== "SKIPPED"
  );

  const weekRecap: WeekRecap | null =
    completedThisWeek.length > 0
      ? {
          completed: completedThisWeek.length,
          total: scheduledThisWeek.length,
          totalThrows: completedThisWeek.reduce((sum, s) => sum + (s.throwCount ?? 0), 0),
          avgRpe:
            completedThisWeek.filter((s) => s.rpe != null).length > 0
              ? completedThisWeek.filter((s) => s.rpe != null).reduce((sum, s) => sum + s.rpe!, 0) /
                completedThisWeek.filter((s) => s.rpe != null).length
              : null,
          prsHit: recentCompleted.filter(
            (s) => s.bestMark != null && s.bestMark > 0 && s.completedAt &&
              toYMD(s.completedAt) >= weekDates[0] && toYMD(s.completedAt) <= weekDates[6]
          ).length,
        }
      : null;

  // ── Recent completions (last 5) ───────────────────────────────────────
  const recentCompletions = allResolved
    .filter((s) => s.status === "COMPLETED")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      date: s.date,
      name: s.name,
      rpe: s.rpe,
      throwCount: s.throwCount,
      status: s.status,
      href: s.href,
    }));

  // ── Determine state ───────────────────────────────────────────────────
  const hasUpcomingWithin7Days =
    todaySessions.length > 0 ||
    futureUpcoming.some((s) => {
      const days = Math.ceil(
        (new Date(s.date + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return days <= 7;
    });

  const hasAnyCompletedSessions = allResolved.some((s) => s.status === "COMPLETED");

  let state: TrainingHubData["state"];
  if (hasUpcomingWithin7Days) {
    state = "active";
  } else if (hasAnyCompletedSessions) {
    state = "between";
  } else {
    state = "cold-start";
  }

  // ── Onboarding checklist (cold-start only) ────────────────────────────
  const readinessExists = readiness.checkedIn;
  const typingExists = throwsProfile !== null;
  const goalsExist = goalsCount > 0;

  const onboardingItems: OnboardingItem[] | null =
    state === "cold-start"
      ? [
          { key: "readiness", label: "Complete your Readiness Check-in", href: "/athlete/wellness", completed: readinessExists },
          { key: "typing", label: "Take the Bondarchuk Typing Quiz", href: "/athlete/throws/quiz", completed: typingExists },
          { key: "goals", label: "Set your Goals", href: "/athlete/goals", completed: goalsExist },
          { key: "questionnaires", label: "Fill out Questionnaires", href: "/athlete/questionnaires", completed: pendingQuestionnaires === 0 && goalsExist },
          { key: "log-session", label: "Log a Session", href: "/athlete/log-session", completed: false },
          { key: "drill-videos", label: "Browse Drill Videos", href: "/athlete/drill-videos", completed: false },
        ]
      : null;

  // ── Cooldown check ────────────────────────────────────────────────────
  const lastRequestDate = lastRequest
    ? lastRequest.createdAt.toISOString()
    : null;

  return {
    state,
    todaySessions,
    weekDays,
    weekRecap,
    nextSession,
    lastProgrammingRequest: lastRequestDate,
    onboardingItems,
    coachName: athlete
      ? `${athlete.coach.firstName} ${athlete.coach.lastName}`
      : "Your Coach",
    coachAvatarUrl: athlete?.coach.avatarUrl ?? null,
    readinessCheckedInToday: readiness.checkedIn,
    pendingQuestionnaires,
    recentCompletions,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/training-hub.ts
git commit -m "feat: add training hub data fetcher with state computation"
```

---

### Task 3: Create the request-programming API endpoint

**Files:**
- Create: `src/app/api/athlete/request-programming/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/athlete/request-programming/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyCoachProgrammingRequested } from "@/lib/notifications";
import { formatEventType } from "@/lib/utils";

const COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coachId: true,
      events: true,
    },
  });

  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  // Check cooldown — find last PROGRAMMING_REQUESTED notification
  const lastRequest = await prisma.notification.findFirst({
    where: {
      type: "PROGRAMMING_REQUESTED",
      athleteProfileId: athlete.id,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (lastRequest) {
    const elapsed = Date.now() - lastRequest.createdAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const cooldownUntil = new Date(lastRequest.createdAt.getTime() + COOLDOWN_MS).toISOString();
      return NextResponse.json({
        success: false,
        error: "Cooldown active",
        cooldownUntil,
      }, { status: 429 });
    }
  }

  // Gather context data for the notification
  const [lastSession, latestReadiness, recentPRs, activeGoals, throwsProfile] =
    await Promise.all([
      // Most recent completed session (any source)
      prisma.programSession.findFirst({
        where: { program: { athleteId: athlete.id }, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, scheduledDate: true },
      }),

      // Latest readiness check-in
      prisma.readinessCheckIn.findFirst({
        where: { athleteId: athlete.id },
        orderBy: { date: "desc" },
        select: { overallScore: true },
      }),

      // Recent PRs
      prisma.throwsPR.findMany({
        where: { athleteId: athlete.id },
        orderBy: { distance: "desc" },
        take: 3,
        select: { event: true, distance: true, implement: true },
      }),

      // Active goals
      prisma.goal.findMany({
        where: { athleteId: athlete.id, status: "ACTIVE" },
        take: 3,
        select: { title: true, targetValue: true, currentValue: true },
      }),

      // Bondarchuk typing
      prisma.throwsProfile.findFirst({
        where: { athleteId: athlete.id },
        select: { primaryType: true },
      }),
    ]);

  // Compute days since last session
  let lastSessionDate: string | null = null;
  let daysSince: number | null = null;
  if (lastSession) {
    const dateStr = lastSession.scheduledDate ?? lastSession.completedAt?.toISOString().slice(0, 10);
    if (dateStr) {
      lastSessionDate = typeof dateStr === "string" ? dateStr : null;
      const lastDate = new Date(dateStr + "T12:00:00");
      daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const athleteName = `${athlete.firstName} ${athlete.lastName}`;

  await notifyCoachProgrammingRequested(athlete.coachId, athlete.id, athleteName, {
    events: athlete.events as string[],
    lastSessionDate,
    daysSinceLastSession: daysSince,
    readinessScore: latestReadiness?.overallScore ?? null,
    recentPRs: recentPRs.map((pr) => ({
      event: pr.event,
      distance: pr.distance,
      implement: pr.implement,
    })),
    goals: activeGoals.map((g) => ({
      title: g.title,
      progress: g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
    })),
    bondarchukType: (throwsProfile as { primaryType?: string } | null)?.primaryType ?? null,
  });

  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  return NextResponse.json({ success: true, cooldownUntil });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/athlete/request-programming/route.ts
git commit -m "feat: add POST /api/athlete/request-programming endpoint"
```

---

### Task 4: Create the Week Strip component

**Files:**
- Create: `src/app/(dashboard)/athlete/sessions/_week-strip.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/athlete/sessions/_week-strip.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { WeekDay } from "@/lib/data/training-hub";

const DOT_COLORS: Record<WeekDay["sessionType"], string> = {
  throws: "bg-amber-500",
  lift: "bg-blue-500",
  mixed: "bg-emerald-500",
  rest: "",
};

export function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <div className="card p-3">
      <div className="flex gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
              day.isToday
                ? "bg-primary-500/10 ring-1 ring-primary-500/30"
                : "bg-surface-50 dark:bg-surface-800/50"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                day.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-muted"
              )}
            >
              {day.dayLabel}
            </span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                day.isToday
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-[var(--foreground)]"
              )}
            >
              {day.dayNum}
            </span>
            {day.sessionType !== "rest" && (
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  DOT_COLORS[day.sessionType]
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/_week-strip.tsx
git commit -m "feat: add WeekStrip component for training hub"
```

---

### Task 5: Create the Request Programming component

**Files:**
- Create: `src/app/(dashboard)/athlete/sessions/_request-programming.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/athlete/sessions/_request-programming.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Send, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const COOLDOWN_MS = 48 * 60 * 60 * 1000;

interface RequestProgrammingProps {
  lastRequestDate: string | null; // ISO date
  coachName: string;
  variant: "cold-start" | "between";
}

export function RequestProgramming({
  lastRequestDate,
  coachName,
  variant,
}: RequestProgrammingProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(() => {
    if (!lastRequestDate) return null;
    const until = new Date(new Date(lastRequestDate).getTime() + COOLDOWN_MS);
    return until.getTime() > Date.now() ? until.toISOString() : null;
  });

  const isOnCooldown = cooldownUntil != null && new Date(cooldownUntil).getTime() > Date.now();

  async function handleRequest() {
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/request-programming", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setCooldownUntil(data.cooldownUntil);
        toast.success("Request sent!", {
          description: `${coachName} has been notified with your training context.`,
        });
      } else if (res.status === 429) {
        setCooldownUntil(data.cooldownUntil);
        toast.warning("Already requested", {
          description: "Your coach was already notified. Please wait before requesting again.",
        });
      } else {
        toast.error("Failed to send request");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const requestedDate = cooldownUntil
    ? new Date(new Date(cooldownUntil).getTime() - COOLDOWN_MS).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={cn(
        "card p-5 border-l-4",
        isOnCooldown
          ? "border-l-emerald-500/50"
          : "border-l-primary-500/50"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            isOnCooldown
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-primary-500/10 text-primary-500"
          )}
        >
          {isOnCooldown ? (
            <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Send size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isOnCooldown ? (
            <>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Request sent
              </h3>
              <p className="text-xs text-muted mt-1">
                {coachName} was notified on {requestedDate}. They&apos;ll program your next sessions soon.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {variant === "cold-start"
                  ? "Let your coach know you're ready to start training"
                  : "Your coach hasn't scheduled your next sessions yet"}
              </h3>
              <p className="text-xs text-muted mt-1">
                {variant === "cold-start"
                  ? `Send ${coachName} your profile data so they can build your first program.`
                  : `Request programming from ${coachName} — they'll receive your readiness, PRs, and goals to build your next sessions.`}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleRequest}
                disabled={loading}
                leftIcon={
                  loading ? (
                    <Clock size={14} strokeWidth={1.75} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={1.75} aria-hidden="true" />
                  )
                }
              >
                {loading ? "Sending..." : "Request Programming"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/_request-programming.tsx
git commit -m "feat: add RequestProgramming component with 48h cooldown"
```

---

### Task 6: Create the Week Recap component

**Files:**
- Create: `src/app/(dashboard)/athlete/sessions/_week-recap.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/athlete/sessions/_week-recap.tsx`:

```typescript
import { Trophy, Target, Gauge } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { WeekRecap } from "@/lib/data/training-hub";

export function WeekRecapCard({ recap }: { recap: WeekRecap }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Trophy size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Week Complete
          </h3>
          <p className="text-xs text-muted">
            You completed{" "}
            <span className="font-semibold text-primary-500">
              <AnimatedNumber value={recap.completed} decimals={0} />/{recap.total}
            </span>{" "}
            sessions this week
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {recap.totalThrows > 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted mb-1">
              <Target size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Throws</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              <AnimatedNumber value={recap.totalThrows} decimals={0} />
            </p>
          </div>
        )}

        {recap.avgRpe != null && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted mb-1">
              <Gauge size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Avg RPE</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              <AnimatedNumber value={recap.avgRpe} decimals={1} />
            </p>
          </div>
        )}

        {recap.prsHit > 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Trophy size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">PRs</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-amber-500">
              <AnimatedNumber value={recap.prsHit} decimals={0} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/_week-recap.tsx
git commit -m "feat: add WeekRecapCard for between-sessions state"
```

---

### Task 7: Create the Onboarding Checklist component

**Files:**
- Create: `src/app/(dashboard)/athlete/sessions/_onboarding-checklist.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/athlete/sessions/_onboarding-checklist.tsx`:

```typescript
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { ProgressBar, StaggeredList } from "@/components";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { OnboardingItem } from "@/lib/data/training-hub";

interface OnboardingChecklistProps {
  items: OnboardingItem[];
  coachName: string;
  coachAvatarUrl: string | null;
}

export function OnboardingChecklist({
  items,
  coachName,
  coachAvatarUrl,
}: OnboardingChecklistProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Coach connection */}
      <div className="card p-4 flex items-center gap-3">
        <Avatar
          src={coachAvatarUrl}
          name={coachName}
          size="md"
        />
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Connected to {coachName}
          </p>
          <p className="text-xs text-muted">
            Complete these steps to help your coach build your program
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {completedCount < items.length && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Profile Completion
            </span>
            <span className="text-xs font-bold tabular-nums text-primary-500">
              {completedCount}/{items.length}
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {/* Checklist items */}
      <StaggeredList className="space-y-2" staggerDelay={60}>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "card card-interactive flex items-center gap-3 p-4",
              item.completed && "opacity-60"
            )}
          >
            {item.completed ? (
              <CheckCircle2
                size={20}
                strokeWidth={1.75}
                className="text-emerald-500 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Circle
                size={20}
                strokeWidth={1.75}
                className="text-primary-500 shrink-0"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "text-sm font-medium flex-1",
                item.completed
                  ? "text-muted line-through"
                  : "text-[var(--foreground)]"
              )}
            >
              {item.label}
            </span>
            {!item.completed && (
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                className="text-muted shrink-0"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
      </StaggeredList>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/_onboarding-checklist.tsx
git commit -m "feat: add OnboardingChecklist for cold-start state"
```

---

### Task 8: Create the main Training Hub client component

**Files:**
- Create: `src/app/(dashboard)/athlete/sessions/_training-hub.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/(dashboard)/athlete/sessions/_training-hub.tsx`:

```typescript
"use client";

import Link from "next/link";
import {
  PenLine,
  Heart,
  Video,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge, Button, StaggeredList } from "@/components";
import { TodayWorkoutWidget } from "../dashboard/_widgets/today-workout";
import { WeekStrip } from "./_week-strip";
import { RequestProgramming } from "./_request-programming";
import { WeekRecapCard } from "./_week-recap";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { cn } from "@/lib/utils";
import type { TrainingHubData } from "@/lib/data/training-hub";
import type { TodaySession } from "@/lib/data/dashboard";

/* ─── Quick Action Pills ─────────────────────────────────────────────────── */

function QuickActions({
  readinessCheckedIn,
  pendingQuestionnaires,
}: {
  readinessCheckedIn: boolean;
  pendingQuestionnaires: number;
}) {
  const actions = [
    { label: "Log Session", href: "/athlete/log-session", icon: PenLine },
    ...(!readinessCheckedIn
      ? [{ label: "Check-in", href: "/athlete/wellness", icon: Heart }]
      : []),
    { label: "Drill Videos", href: "/athlete/drill-videos", icon: Video },
    ...(pendingQuestionnaires > 0
      ? [{ label: `Questionnaires (${pendingQuestionnaires})`, href: "/athlete/questionnaires", icon: Calendar }]
      : []),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-800 text-xs font-medium text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors whitespace-nowrap shrink-0"
        >
          <a.icon size={13} strokeWidth={1.75} aria-hidden="true" />
          {a.label}
        </Link>
      ))}
    </div>
  );
}

/* ─── Next Session Countdown ─────────────────────────────────────────────── */

function NextSessionCard({
  date,
  name,
  daysUntil,
}: {
  date: string;
  name: string;
  daysUntil: number;
}) {
  const formatted = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-lg font-bold tabular-nums text-primary-500 leading-none">
          {daysUntil}
        </span>
        <span className="text-[9px] font-semibold text-primary-500/70 uppercase">
          {daysUntil === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted">Next Session</p>
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {name}
        </p>
        <p className="text-xs text-muted">{formatted}</p>
      </div>
      <ChevronRight size={16} strokeWidth={1.75} className="text-muted shrink-0" aria-hidden="true" />
    </div>
  );
}

/* ─── Recent Completions ─────────────────────────────────────────────────── */

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  COMPLETED: { label: "Done", variant: "success" },
};

function RecentCompletions({
  sessions,
}: {
  sessions: TrainingHubData["recentCompletions"];
}) {
  const [expanded, setExpanded] = useState(false);
  // Show expanded by default on desktop via CSS, collapsed on mobile
  if (sessions.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left sm:pointer-events-none"
      >
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Recent Sessions
        </h2>
        <span className="sm:hidden text-muted">
          {expanded ? (
            <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
      </button>

      <div className={cn("card divide-y divide-[var(--card-border)] overflow-hidden", !expanded && "hidden sm:block")}>
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {s.name}
              </p>
              <p className="text-xs text-muted">
                {new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {s.rpe != null && ` · RPE ${s.rpe.toFixed(1)}`}
                {s.throwCount != null && s.throwCount > 0 && ` · ${s.throwCount} throws`}
              </p>
            </div>
            <Badge variant="success" size="sm">Done</Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Main Training Hub ──────────────────────────────────────────────────── */

export function TrainingHub({ data }: { data: TrainingHubData }) {
  if (data.state === "active") {
    return (
      <div className="space-y-5">
        {/* Today's sessions hero */}
        {data.todaySessions.length > 0 ? (
          <TodayWorkoutWidget data={data.todaySessions} />
        ) : data.nextSession ? (
          <NextSessionCard
            date={data.nextSession.date}
            name={data.nextSession.name}
            daysUntil={data.nextSession.daysUntil}
          />
        ) : null}

        {/* Week strip */}
        <WeekStrip days={data.weekDays} />

        {/* Quick actions */}
        <QuickActions
          readinessCheckedIn={data.readinessCheckedInToday}
          pendingQuestionnaires={data.pendingQuestionnaires}
        />

        {/* Recent completions */}
        <RecentCompletions sessions={data.recentCompletions} />
      </div>
    );
  }

  if (data.state === "between") {
    return (
      <div className="space-y-5">
        {/* Week recap */}
        {data.weekRecap && <WeekRecapCard recap={data.weekRecap} />}

        {/* Next session countdown or request programming */}
        {data.nextSession && data.nextSession.daysUntil <= 14 ? (
          <NextSessionCard
            date={data.nextSession.date}
            name={data.nextSession.name}
            daysUntil={data.nextSession.daysUntil}
          />
        ) : (
          <RequestProgramming
            lastRequestDate={data.lastProgrammingRequest}
            coachName={data.coachName}
            variant="between"
          />
        )}

        {/* Quick actions */}
        <QuickActions
          readinessCheckedIn={data.readinessCheckedInToday}
          pendingQuestionnaires={data.pendingQuestionnaires}
        />

        {/* Recent completions */}
        <RecentCompletions sessions={data.recentCompletions} />
      </div>
    );
  }

  // cold-start
  return (
    <div className="space-y-5">
      {/* Request programming */}
      <RequestProgramming
        lastRequestDate={data.lastProgrammingRequest}
        coachName={data.coachName}
        variant="cold-start"
      />

      {/* Onboarding checklist */}
      {data.onboardingItems && (
        <OnboardingChecklist
          items={data.onboardingItems}
          coachName={data.coachName}
          coachAvatarUrl={data.coachAvatarUrl}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/_training-hub.tsx
git commit -m "feat: add TrainingHub client component with 3-state rendering"
```

---

### Task 9: Replace the sessions page with the Training Hub

**Files:**
- Modify: `src/app/(dashboard)/athlete/sessions/page.tsx`

- [ ] **Step 1: Rewrite page.tsx as a server component that fetches hub data**

Replace the entire contents of `src/app/(dashboard)/athlete/sessions/page.tsx` with:

```typescript
import { requireAthleteSession } from "@/lib/data/athlete";
import { fetchTrainingHubData } from "@/lib/data/training-hub";
import { TrainingHub } from "./_training-hub";

export default async function AthleteTrainingPage() {
  const { athlete } = await requireAthleteSession();
  const data = await fetchTrainingHubData(athlete.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Training
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {data.state === "active"
            ? "Here's what's on deck"
            : data.state === "between"
              ? "Great work this week"
              : "Welcome to Podium Throws"}
        </p>
      </div>

      {/* Hub */}
      <TrainingHub data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
```

Note: `JSON.parse(JSON.stringify(data))` serializes Date objects for the client component boundary — this is the existing pattern used throughout the codebase (see `self-program/page.tsx:56`).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/athlete/sessions/page.tsx
git commit -m "feat: replace flat sessions list with Training Hub"
```

---

### Task 10: Rename sidebar nav item and update dashboard widget

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`
- Modify: `src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx`

- [ ] **Step 1: Rename "My Sessions" to "Training" in sidebar**

In `src/components/ui/Sidebar.tsx`, find line ~461 where the label says `"My Sessions"` and change it:

```typescript
// Before:
{
  label: "My Sessions",
  href: "/athlete/sessions",
  icon: <Calendar {...iconSize} />,
  matchPaths: ["/athlete/sessions"],
},

// After:
{
  label: "Training",
  href: "/athlete/sessions",
  icon: <Calendar {...iconSize} />,
  matchPaths: ["/athlete/sessions"],
},
```

- [ ] **Step 2: Update the RestDayState in today-workout widget**

In `src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx`, replace the `RestDayState` function (lines ~230-254) with:

```typescript
function RestDayState() {
  return (
    <div className="card shadow-sm md:hover:shadow-md md:transition-shadow">
      <div className="flex flex-col items-center text-center py-10 px-6 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <Coffee
            size={24}
            strokeWidth={1.75}
            className="text-surface-400 dark:text-surface-500"
            aria-hidden="true"
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            No Sessions Scheduled
          </h3>
          <p className="text-xs text-muted mt-1 max-w-[240px] leading-relaxed">
            Head to your Training page to request programming or log a session.
          </p>
          <Link
            href="/athlete/sessions"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:underline mt-2"
          >
            Go to Training
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Note: `Link` and `ChevronRight` are already imported at the top of this file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Run lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: No errors (warnings are OK)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Sidebar.tsx src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx
git commit -m "feat: rename nav to Training + update dashboard empty state"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: 0 errors

- [ ] **Step 2: Full lint check**

Run: `npm run lint`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Dev server smoke test**

Run: `npm run dev` and manually verify:
1. Navigate to `/athlete/sessions` — should show Training Hub
2. Sidebar shows "Training" not "My Sessions"
3. If no sessions: cold-start state with onboarding checklist
4. Dashboard widget links to Training page
5. "Request Programming" button sends notification (check DB or coach notifications page)

- [ ] **Step 4: Commit any fixes from smoke test**

```bash
git add -A
git commit -m "fix: address smoke test issues for training hub"
```
