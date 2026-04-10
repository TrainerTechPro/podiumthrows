# Athlete Dashboard Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static athlete dashboard with a customizable widget-based dashboard featuring readiness hero, today's workout timeline, calendar, and preset/toggle customization.

**Architecture:** Centralized data fetching in `page.tsx` orchestrates parallel queries for only enabled widgets, passing pre-fetched data as props to pure render widget components. Widget config stored as nullable JSON on `AthleteProfile`. 10 widgets, 4 presets, customize via modal sheet.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma ORM, Tailwind CSS, framer-motion (existing), custom component library (AnimatedNumber, StaggeredList, Tabs, NumberFlow, Button, Badge).

**Spec:** `docs/superpowers/specs/2026-03-23-athlete-dashboard-overhaul-design.md`

**Verification:** `tsc --noEmit` after each task. Visual verification via `npm run dev` on mobile viewport.

---

## File Structure

```
NEW FILES:
  src/app/(dashboard)/athlete/dashboard/_widget-registry.ts
  src/app/(dashboard)/athlete/dashboard/_customize-panel.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/readiness-hero.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/workout-calendar.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/personal-bests.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/quick-stats.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/goals-progress.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/training-volume.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/recent-videos.tsx
  src/app/(dashboard)/athlete/dashboard/_widgets/pending-questionnaires.tsx
  src/app/api/athlete/dashboard-config/route.ts
  src/lib/data/dashboard.ts

MODIFIED FILES:
  prisma/schema.prisma          — add dashboardConfig Json? to AthleteProfile
  src/app/(dashboard)/athlete/dashboard/page.tsx  — complete rewrite as widget orchestrator
```

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma` (AthleteProfile model)

- [ ] **Step 1: Add dashboardConfig column to AthleteProfile**

In `prisma/schema.prisma`, find the `AthleteProfile` model and add before the closing brace:

```prisma
  dashboardConfig  Json?     // Widget layout config: { preset, widgets, order }
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate
```

This runs `prisma migrate dev`. Name it `add-dashboard-config`. Expected: migration created and applied, Prisma Client regenerated.

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors (existing code doesn't reference the new column yet).

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add dashboardConfig JSON column to AthleteProfile"
```

---

### Task 2: Widget Registry, Types, and Presets

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widget-registry.ts`

- [ ] **Step 1: Create the widget registry file**

```typescript
// src/app/(dashboard)/athlete/dashboard/_widget-registry.ts

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type WidgetId =
  | "readiness"
  | "today-workout"
  | "calendar"
  | "prs"
  | "quick-stats"
  | "goals"
  | "volume"
  | "upcoming-sessions"
  | "videos"
  | "questionnaires";

export const WIDGET_IDS: WidgetId[] = [
  "readiness",
  "today-workout",
  "calendar",
  "prs",
  "quick-stats",
  "goals",
  "volume",
  "upcoming-sessions",
  "videos",
  "questionnaires",
];

export type WidgetMeta = {
  id: WidgetId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  pinned?: boolean; // true = cannot be removed or reordered
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: "readiness", name: "Readiness Score", description: "Today's readiness check-in and score", icon: "Heart", pinned: true },
  { id: "today-workout", name: "Today's Workout", description: "Preview timeline of today's sessions", icon: "Dumbbell" },
  { id: "calendar", name: "Workout Calendar", description: "Month view with session indicators", icon: "Calendar" },
  { id: "prs", name: "Personal Bests", description: "Latest PRs across events", icon: "Award" },
  { id: "quick-stats", name: "Quick Stats", description: "Sessions this week, streak, total", icon: "Hash" },
  { id: "goals", name: "Goals Progress", description: "Active goals with progress bars", icon: "Target" },
  { id: "volume", name: "Training Volume", description: "Weekly throws/lifts volume chart", icon: "TrendingUp" },
  { id: "upcoming-sessions", name: "Upcoming Sessions", description: "Next 5 scheduled sessions", icon: "CalendarDays" },
  { id: "videos", name: "Recent Videos", description: "Latest coaching videos", icon: "Video" },
  { id: "questionnaires", name: "Pending Questionnaires", description: "Unanswered coach questionnaires", icon: "ClipboardList" },
];

/* ─── Dashboard Config ───────────────────────────────────────────────────── */

export type PresetId = "minimal" | "performance" | "detailed" | "recovery";

export type DashboardConfig = {
  preset: PresetId | "custom";
  widgets: WidgetId[];
  order: WidgetId[];
};

export const PRESETS: Record<PresetId, DashboardConfig> = {
  minimal: {
    preset: "minimal",
    widgets: ["readiness", "today-workout", "quick-stats"],
    order: ["readiness", "today-workout", "quick-stats"],
  },
  performance: {
    preset: "performance",
    widgets: ["readiness", "today-workout", "calendar", "prs", "quick-stats"],
    order: ["readiness", "today-workout", "calendar", "prs", "quick-stats"],
  },
  detailed: {
    preset: "detailed",
    widgets: ["readiness", "today-workout", "calendar", "prs", "quick-stats", "goals", "volume", "upcoming-sessions"],
    order: ["readiness", "today-workout", "calendar", "prs", "quick-stats", "goals", "volume", "upcoming-sessions"],
  },
  recovery: {
    preset: "recovery",
    widgets: ["readiness", "today-workout", "calendar", "goals"],
    order: ["readiness", "today-workout", "calendar", "goals"],
  },
};

export const DEFAULT_PRESET: PresetId = "performance";

/* ─── Config Helpers ─────────────────────────────────────────────────────── */

export function resolveConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== "object") return PRESETS[DEFAULT_PRESET];
  const cfg = raw as Record<string, unknown>;
  const preset = cfg.preset as string;
  const widgets = cfg.widgets as string[];
  const order = cfg.order as string[];

  if (!Array.isArray(widgets) || !Array.isArray(order)) return PRESETS[DEFAULT_PRESET];

  // Validate widget IDs
  const validWidgets = widgets.filter((w): w is WidgetId => WIDGET_IDS.includes(w as WidgetId));
  const validOrder = order.filter((w): w is WidgetId => validWidgets.includes(w as WidgetId));

  // Force readiness first
  if (!validWidgets.includes("readiness")) validWidgets.unshift("readiness");
  if (!validOrder.includes("readiness")) validOrder.unshift("readiness");
  else if (validOrder[0] !== "readiness") {
    const idx = validOrder.indexOf("readiness");
    validOrder.splice(idx, 1);
    validOrder.unshift("readiness");
  }

  return {
    preset: (preset as PresetId | "custom") ?? "custom",
    widgets: validWidgets,
    order: validOrder,
  };
}

export function isWidgetEnabled(config: DashboardConfig, id: WidgetId): boolean {
  return config.widgets.includes(id);
}
```

- [ ] **Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widget-registry.ts
git commit -m "feat: add widget registry with types, catalog, presets, and config helpers"
```

---

### Task 3: Dashboard Data Fetchers

**Files:**
- Create: `src/lib/data/dashboard.ts`

This file contains all fetcher functions for dashboard widgets. Each returns strongly typed data that widget components receive as props.

- [ ] **Step 1: Create data fetcher file with types**

Create `src/lib/data/dashboard.ts` with the following. Read the existing patterns in `src/lib/data/athlete.ts` and `src/lib/data/coach.ts` first — follow the same Prisma query style.

```typescript
// src/lib/data/dashboard.ts
import prisma from "@/lib/prisma";

/* ─── Shared Types ───────────────────────────────────────────────────────── */

export type TimelineItem = {
  id: string;
  name: string;
  type: "throw" | "lift" | "warmup" | "note" | "cooldown";
  detail: string;
  supersetGroup?: string;
  position: number;
};

export type TodaySession = {
  id: string;
  source: "program" | "assignment" | "self-logged" | "legacy";
  name: string;
  sessionType: "throws" | "lift" | "mixed";
  status: "planned" | "scheduled" | "in_progress" | "completed";
  scheduledTime?: string;
  items: TimelineItem[];
  totalItemCount: number;
  href: string;
};

export type ReadinessData = {
  checkedIn: boolean;
  score: number | null;
  label: string | null;
  sleepQuality: number | null;
  soreness: number | null;
  stressLevel: number | null;
  energyMood: number | null;
  hydration: string | null;
};

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  hasCompleted: boolean;
  hasScheduled: boolean;
};

export type PRItem = {
  id: string;
  event: string;
  distance: number;
  date: string;
};

export type QuickStatsData = {
  sessionsThisWeek: number;
  currentStreak: number;
  totalSessions: number;
};

export type GoalItem = {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
};

export type UpcomingSessionItem = {
  id: string;
  scheduledDate: string;
  status: string;
  planName: string | null;
  coachNotes: string | null;
};

export type VideoItem = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type QuestionnairesData = {
  pendingCount: number;
  items: { id: string; title: string }[];
};
```

- [ ] **Step 2: Add readiness data fetcher**

Append to `src/lib/data/dashboard.ts`. Reference existing `getAthleteCheckInToday` in `src/lib/data/athlete.ts` for the query pattern.

```typescript
/* ─── Readiness Fetcher ──────────────────────────────────────────────────── */

export async function fetchReadinessData(athleteId: string): Promise<ReadinessData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.readinessCheckIn.findFirst({
    where: {
      athleteId,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 86400000),
      },
    },
    orderBy: { date: "desc" },
  });

  if (!checkIn) {
    return { checkedIn: false, score: null, label: null, sleepQuality: null, soreness: null, stressLevel: null, energyMood: null, hydration: null };
  }

  const score = checkIn.overallScore;
  let label = "Low — Rest Recommended";
  if (score >= 9) label = "Excellent";
  else if (score >= 8) label = "Good — Train Hard";
  else if (score >= 6) label = "Moderate";
  else if (score >= 5) label = "Below Average";

  return {
    checkedIn: true,
    score,
    label,
    sleepQuality: checkIn.sleepQuality,
    soreness: checkIn.soreness,
    stressLevel: checkIn.stressLevel,
    energyMood: checkIn.energyMood,
    hydration: checkIn.hydration,
  };
}
```

- [ ] **Step 3: Add today-workout data fetcher**

This is the most complex fetcher. Append to `src/lib/data/dashboard.ts`:

```typescript
/* ─── Today Workout Fetcher ──────────────────────────────────────────────── */

function parseJson<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function formatEventName(event: string): string {
  return event.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type ThrowRx = { implement: string; category?: string; drillType?: string; sets: number; repsPerSet: number; notes?: string };
type StrengthRx = { exerciseName: string; classification?: string; sets: number; reps: number; supersetGroup?: string };
type WarmupRx = { name: string; duration?: string; notes?: string };

function normalizeProgramSession(ps: {
  id: string;
  sessionType: string;
  focusLabel: string;
  status: string;
  scheduledDate: string | null;
  throwsPrescription: string | null;
  strengthPrescription: string | null;
  warmupPrescription: string | null;
  program: { event: string; selfProgramConfig: { id: string } | null };
}): TodaySession {
  const items: TimelineItem[] = [];
  let pos = 0;

  // Warmup
  const warmups = parseJson<WarmupRx>(ps.warmupPrescription);
  for (const w of warmups) {
    items.push({ id: `${ps.id}-w-${pos}`, name: w.name, type: "warmup", detail: w.duration ?? "", position: pos++ });
  }

  // Throws (descending weight order is guaranteed by program generation)
  const throws = parseJson<ThrowRx>(ps.throwsPrescription);
  for (const t of throws) {
    const totalThrows = t.sets * t.repsPerSet;
    items.push({ id: `${ps.id}-t-${pos}`, name: `${t.implement} ${formatEventName(ps.program.event)}`, type: "throw", detail: `${totalThrows} throws`, position: pos++ });
  }

  // Strength
  const lifts = parseJson<StrengthRx>(ps.strengthPrescription);
  for (const l of lifts) {
    items.push({ id: `${ps.id}-l-${pos}`, name: l.exerciseName, type: "lift", detail: `${l.sets} x ${l.reps}`, supersetGroup: l.supersetGroup, position: pos++ });
  }

  const statusMap: Record<string, TodaySession["status"]> = {
    PLANNED: "planned", SCHEDULED: "scheduled", IN_PROGRESS: "in_progress", COMPLETED: "completed",
  };

  const sessionTypeMap: Record<string, TodaySession["sessionType"]> = {
    THROWS_ONLY: "throws", LIFT_ONLY: "lift", THROWS_LIFT: "mixed",
    COMPETITION_SIM: "throws", RECOVERY: "mixed",
  };

  const href = ps.program.selfProgramConfig
    ? `/athlete/self-program/${ps.program.selfProgramConfig.id}`
    : `/athlete/sessions/${ps.id}`;

  return {
    id: ps.id,
    source: "program",
    name: `${formatEventName(ps.program.event)} — ${ps.focusLabel}`,
    sessionType: sessionTypeMap[ps.sessionType] ?? "mixed",
    status: statusMap[ps.status] ?? "planned",
    items: items.slice(0, 4),
    totalItemCount: items.length,
    href,
  };
}

export async function fetchTodayWorkoutData(athleteId: string): Promise<TodaySession[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const sessions: TodaySession[] = [];

  // 1. ProgramSessions
  const programSessions = await prisma.programSession.findMany({
    where: {
      scheduledDate: today,
      program: { athleteId },
      status: { in: ["PLANNED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      program: { select: { event: true, selfProgramConfig: { select: { id: true } } } },
    },
    orderBy: { dayOfWeek: "asc" },
  });

  for (const ps of programSessions) {
    sessions.push(normalizeProgramSession({
      ...ps,
      throwsPrescription: ps.throwsPrescription ?? null,
      strengthPrescription: ps.strengthPrescription ?? null,
      warmupPrescription: ps.warmupPrescription ?? null,
    }));
  }

  // 2. ThrowsAssignments
  const assignments = await prisma.throwsAssignment.findMany({
    where: {
      athleteId,
      assignedDate: today,
      status: { in: ["ASSIGNED", "NOTIFIED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      session: {
        include: { blocks: { orderBy: { position: "asc" } } },
      },
    },
  });

  for (const a of assignments) {
    const items: TimelineItem[] = [];
    let pos = 0;
    for (const block of a.session.blocks) {
      const config = parseJson<Record<string, unknown>>(typeof block.config === "string" ? block.config : JSON.stringify(block.config));
      const typeMap: Record<string, TimelineItem["type"]> = {
        WARMUP: "warmup", THROWING: "throw", STRENGTH: "lift",
        PLYOMETRIC: "lift", COOLDOWN: "cooldown", NOTES: "note",
      };
      items.push({
        id: `${a.id}-b-${pos}`,
        name: block.blockType === "NOTES" ? "Note" : a.session.name,
        type: typeMap[block.blockType] ?? "note",
        detail: block.blockType,
        position: pos++,
      });
    }

    const statusMap: Record<string, TodaySession["status"]> = {
      ASSIGNED: "scheduled", NOTIFIED: "scheduled", IN_PROGRESS: "in_progress", COMPLETED: "completed",
    };

    sessions.push({
      id: a.id,
      source: "assignment",
      name: a.session.name,
      sessionType: "throws",
      status: statusMap[a.status] ?? "scheduled",
      items: items.slice(0, 4),
      totalItemCount: items.length,
      href: `/athlete/sessions/${a.id}`,
    });
  }

  // 3. AthleteThrowsSessions (self-logged)
  const selfLogged = await prisma.athleteThrowsSession.findMany({
    where: { athleteId, date: today },
    include: { drillLogs: { orderBy: { createdAt: "asc" } } },
  });

  for (const s of selfLogged) {
    const items: TimelineItem[] = s.drillLogs.map((d, i) => ({
      id: d.id,
      name: `${d.implementWeight ? `${d.implementWeight}kg ` : ""}${formatEventName(s.event)}`,
      type: "throw" as const,
      detail: `${d.throwCount} throws`,
      position: i,
    }));

    sessions.push({
      id: s.id,
      source: "self-logged",
      name: `${formatEventName(s.event)} (Self-Logged)`,
      sessionType: "throws",
      status: "completed",
      items: items.slice(0, 4),
      totalItemCount: items.length,
      href: `/athlete/sessions`, // self-logged sessions don't have dedicated detail pages yet
    });
  }

  // 4. TrainingSessions (legacy)
  const legacy = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      scheduledDate: { gte: todayDate, lt: new Date(todayDate.getTime() + 86400000) },
      status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      plan: { select: { name: true } },
      logs: { take: 4, orderBy: { createdAt: "asc" }, include: { exercise: true } },
    },
  });

  for (const ts of legacy) {
    const items: TimelineItem[] = ts.logs.map((log, i) => ({
      id: log.id,
      name: log.exercise?.name ?? "Exercise",
      type: "lift" as const,
      detail: `${log.sets} x ${log.reps}`,
      position: i,
    }));

    const statusMap: Record<string, TodaySession["status"]> = {
      SCHEDULED: "scheduled", IN_PROGRESS: "in_progress", COMPLETED: "completed",
    };

    sessions.push({
      id: ts.id,
      source: "legacy",
      name: ts.plan?.name ?? "Training Session",
      sessionType: "lift",
      status: statusMap[ts.status] ?? "scheduled",
      items: items.slice(0, 4),
      totalItemCount: items.length,
      href: `/athlete/sessions/${ts.id}`,
    });
  }

  return sessions;
}
```

- [ ] **Step 4: Add calendar, PR, stats, goals, upcoming, videos, questionnaires fetchers**

Append remaining fetchers to `src/lib/data/dashboard.ts`. These are simpler — many reuse existing query patterns from `src/lib/data/athlete.ts`.

```typescript
/* ─── Calendar Fetcher ───────────────────────────────────────────────────── */

export async function fetchCalendarData(athleteId: string): Promise<CalendarDay[]> {
  // Get first and last day of current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const firstStr = firstDay.toISOString().slice(0, 10);
  const lastStr = lastDay.toISOString().slice(0, 10);

  // ProgramSessions this month
  const programSessions = await prisma.programSession.findMany({
    where: {
      program: { athleteId },
      scheduledDate: { gte: firstStr, lte: lastStr },
    },
    select: { scheduledDate: true, status: true },
  });

  // TrainingSessions this month
  const trainingSessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      scheduledDate: { gte: firstDay, lte: lastDay },
    },
    select: { scheduledDate: true, status: true },
  });

  // Build day map
  const dayMap = new Map<string, CalendarDay>();
  const numDays = lastDay.getDate();
  for (let d = 1; d <= numDays; d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dayMap.set(dateStr, { date: dateStr, hasCompleted: false, hasScheduled: false });
  }

  for (const ps of programSessions) {
    if (!ps.scheduledDate) continue;
    const day = dayMap.get(ps.scheduledDate);
    if (!day) continue;
    if (ps.status === "COMPLETED") day.hasCompleted = true;
    else day.hasScheduled = true;
  }

  for (const ts of trainingSessions) {
    const dateStr = ts.scheduledDate.toISOString().slice(0, 10);
    const day = dayMap.get(dateStr);
    if (!day) continue;
    if (ts.status === "COMPLETED") day.hasCompleted = true;
    else day.hasScheduled = true;
  }

  return Array.from(dayMap.values());
}

/* ─── PR Fetcher ─────────────────────────────────────────────────────────── */

export async function fetchPRsData(athleteId: string): Promise<PRItem[]> {
  // PRs are tracked via isPersonalBest flag on ThrowLog — no PersonalBest model exists.
  // Query ThrowLog where isPersonalBest=true, get best per event.
  const throwLogs = await prisma.throwLog.findMany({
    where: {
      session: { athleteId },
      isPersonalBest: true,
      distance: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 20, // fetch extra to deduplicate per event
    select: { id: true, event: true, distance: true, createdAt: true },
  });

  // Deduplicate: keep best distance per event
  const bestByEvent = new Map<string, typeof throwLogs[0]>();
  for (const log of throwLogs) {
    const existing = bestByEvent.get(log.event);
    if (!existing || (log.distance ?? 0) > (existing.distance ?? 0)) {
      bestByEvent.set(log.event, log);
    }
  }

  return Array.from(bestByEvent.values())
    .slice(0, 4)
    .map((pr) => ({
      id: pr.id,
      event: pr.event,
      distance: pr.distance ?? 0,
      date: pr.createdAt.toISOString(),
    }));
}

/* ─── Quick Stats Fetcher ────────────────────────────────────────────────── */

export async function fetchQuickStatsData(athleteId: string): Promise<QuickStatsData> {
  // Reuses logic from getAthleteStats in athlete.ts
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [totalSessions, sessionsThisWeek] = await Promise.all([
    prisma.trainingSession.count({ where: { athleteId, status: "COMPLETED" } }),
    prisma.trainingSession.count({
      where: { athleteId, status: "COMPLETED", completedDate: { gte: weekStart } },
    }),
  ]);

  // Streak calculation — count consecutive days with completed sessions
  const recentCompleted = await prisma.trainingSession.findMany({
    where: { athleteId, status: "COMPLETED" },
    orderBy: { completedDate: "desc" },
    take: 60,
    select: { completedDate: true },
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  const completedDates = new Set(
    recentCompleted
      .filter((s) => s.completedDate)
      .map((s) => s.completedDate!.toISOString().slice(0, 10))
  );

  while (completedDates.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { sessionsThisWeek, currentStreak: streak, totalSessions };
}

/* ─── Goals Fetcher ──────────────────────────────────────────────────────── */

export async function fetchGoalsData(athleteId: string): Promise<GoalItem[]> {
  const goals = await prisma.goal.findMany({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, targetValue: true, currentValue: true, unit: true },
  });

  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetValue: g.targetValue ?? 0,
    currentValue: g.currentValue ?? 0,
    unit: g.unit ?? "",
  }));
}

/* ─── Volume Fetcher (stub — wraps existing VolumeWidget data) ───────────── */

export async function fetchVolumeData(athleteId: string): Promise<{ athleteId: string }> {
  // VolumeWidget fetches its own data client-side via /api/athlete/training-volume
  // We just pass the athleteId so it can make the call
  return { athleteId };
}

/* ─── Upcoming Sessions Fetcher ──────────────────────────────────────────── */

export async function fetchUpcomingSessionsData(athleteId: string): Promise<UpcomingSessionItem[]> {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      scheduledDate: { gte: now },
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
    },
    orderBy: { scheduledDate: "asc" },
    take: 5,
    select: {
      id: true,
      scheduledDate: true,
      status: true,
      coachNotes: true,
      plan: { select: { name: true } },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    scheduledDate: s.scheduledDate.toISOString(),
    status: s.status,
    planName: s.plan?.name ?? null,
    coachNotes: s.coachNotes,
  }));
}

/* ─── Videos Fetcher ─────────────────────────────────────────────────────── */

export async function fetchVideosData(athleteId: string): Promise<VideoItem[]> {
  // Model is VideoUpload, not Video
  const videos = await prisma.videoUpload.findMany({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, thumbnailUrl: true, createdAt: true },
  });

  return videos.map((v) => ({
    id: v.id,
    title: v.title ?? "Video",
    thumbnailUrl: v.thumbnailUrl,
    createdAt: v.createdAt.toISOString(),
  }));
}

/* ─── Questionnaires Fetcher ─────────────────────────────────────────────── */

export async function fetchQuestionnairesData(athleteId: string): Promise<QuestionnairesData> {
  // QuestionnaireAssignment has no status field — use completedAt: null for pending
  const pending = await prisma.questionnaireAssignment.findMany({
    where: { athleteId, completedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { questionnaire: { select: { title: true } } },
  });

  return {
    pendingCount: pending.length,
    items: pending.map((p) => ({ id: p.id, title: p.questionnaire.title })),
  };
}
```

- [ ] **Step 5: Verify with tsc**

```bash
npx tsc --noEmit
```

Fix any type errors — the Prisma schema field names may need adjusting (e.g., `personalBest` table name, `goal` field names). Read the actual Prisma schema to confirm exact field names and adjust queries accordingly.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/dashboard.ts
git commit -m "feat: add all dashboard widget data fetchers"
```

---

### Task 4: ReadinessHeroWidget

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/readiness-hero.tsx`

- [ ] **Step 1: Create the widget component**

This is a client component (needs framer-motion for ring animation). Read the existing `_readiness-widget.tsx` for patterns, then create the new hero version.

Key requirements:
- **Checked-in**: Animated ring (framer-motion spring), score, factor breakdown 2x2 grid, color-coded gradient background
- **Not checked-in**: Gold pulsing prompt card with CTA linking to `/athlete/wellness`
- Uses `cn()` from `@/lib/utils`, `AnimatedNumber` from `@/components`
- Score color: green 8+, amber 5-7, red <5
- Factor bars animate staggered (CSS transitions, 50ms stagger per bar)
- Respects `prefers-reduced-motion`

The component receives `ReadinessData` as props (from the fetcher).

```typescript
// Props interface
import type { ReadinessData } from "@/lib/data/dashboard";

export function ReadinessHeroWidget({ data }: { data: ReadinessData }) {
  // ... implementation
}
```

Full implementation: build the checked-in state with ring + factors, and the check-in prompt state. Use `"use client"` directive. Use `motion.div` from `framer-motion` for the ring fill animation with `spring` transition. CSS gradient background shifts using inline `style` with `--score-hue` custom property.

- [ ] **Step 2: Verify with tsc and visual check**

```bash
npx tsc --noEmit
```

Start dev server, navigate to athlete dashboard at mobile viewport (375px). Verify ring renders, factors show, and animation plays.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/readiness-hero.tsx
git commit -m "feat: add ReadinessHeroWidget with animated ring and factor breakdown"
```

---

### Task 5: TodayWorkoutWidget

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx`

- [ ] **Step 1: Create the widget component**

Client component (`"use client"`) — needs Tabs for multi-session switching.

Key requirements:
- Receives `TodaySession[]` as props
- **0 sessions**: Empty state with rest icon
- **1 session**: Name, status badge, mini timeline (4 items max), start button
- **2+ sessions**: `<Tabs>` component with session tabs (icon + name + time), each tab has its own timeline + start button
- Timeline: vertical line (`border-l-2`), colored dots per type (throw=amber, lift=blue, warmup=orange, note=gray), superset badges (A/B/C circles)
- Throws show "N throws", lifts show "sets x reps"
- Items stagger in with `<StaggeredList>` or CSS animation
- "Start Workout" button: `btn-primary` with full width
- "+ N more exercises" link

Import `Tabs, TabList, TabTrigger, TabPanel` from `@/components/ui/Tabs`, `Badge` from `@/components`, `StaggeredList` from `@/components`.

- [ ] **Step 2: Verify with tsc and visual check**

```bash
npx tsc --noEmit
```

Visual check: load dashboard with at least one ProgramSession for today (may need to seed data). Verify timeline renders, tabs work for multi-session.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/today-workout.tsx
git commit -m "feat: add TodayWorkoutWidget with timeline preview and session tabs"
```

---

### Task 6: WorkoutCalendarWidget

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/workout-calendar.tsx`

- [ ] **Step 1: Create the widget component**

Client component — needs state for current month navigation.

Key requirements:
- Receives `CalendarDay[]` as props (current month data)
- Month grid: Sun-Sat, 7 columns
- Navigation arrows: `< March 2026 >` with month name
- Day indicators: green dot (completed), gold dot (scheduled), amber ring (today)
- Tapping a day with session navigates to sessions page
- Calendar dots scale in with CSS animation on mount
- Month navigation re-fetches via client-side fetch to `/api/athlete/calendar?month=YYYY-MM` (or just navigate, keeping it simple)

For V1, keep month navigation simple — show current month only from server-fetched data. Month navigation can be a future enhancement (avoids client-side fetching complexity).

- [ ] **Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/workout-calendar.tsx
git commit -m "feat: add WorkoutCalendarWidget with session indicators"
```

---

### Task 7: PersonalBestsWidget + QuickStatsWidget

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/personal-bests.tsx`
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/quick-stats.tsx`

- [ ] **Step 1: Create PersonalBestsWidget**

Server component (no client interactivity needed). Receives `PRItem[]`.

Reuse the existing PRCard pattern from the current `page.tsx` — gold medal icon, event name, animated distance, recency text. Add subtle shimmer on medal icon via CSS `@keyframes shimmer`.

- [ ] **Step 2: Create QuickStatsWidget**

Server component. Receives `QuickStatsData`.

3 stat boxes in a row using `AnimatedNumber`. Compact card, no header. Follow existing `StatCard` pattern but simplified to 3-across.

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/personal-bests.tsx src/app/\(dashboard\)/athlete/dashboard/_widgets/quick-stats.tsx
git commit -m "feat: add PersonalBestsWidget and QuickStatsWidget"
```

---

### Task 8: Remaining Widgets (Goals, Volume, Upcoming, Videos, Questionnaires)

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/goals-progress.tsx`
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/training-volume.tsx`
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx`
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/recent-videos.tsx`
- Create: `src/app/(dashboard)/athlete/dashboard/_widgets/pending-questionnaires.tsx`

- [ ] **Step 1: Create all 5 remaining widgets**

These are simpler — mostly wrappers around existing patterns:

- **GoalsWidget**: Receives `GoalItem[]`. Progress bars using `<ProgressBar>` component. Link to `/athlete/goals`.
- **VolumeWidget**: Wraps existing `<VolumeWidget>` from `_volume-widget.tsx`. Import and render it. Receives `{ athleteId }`.
- **UpcomingSessionsWidget**: Receives `UpcomingSessionItem[]`. Reuse `UpcomingSessionCard` pattern from current dashboard.
- **VideosWidget**: Receives `VideoItem[]`. Thumbnail cards linking to `/athlete/videos/[id]`.
- **QuestionnairesWidget**: Receives `QuestionnairesData`. Count badge + list. Link to `/athlete/questionnaires`.

Each widget should have:
- Widget header with title + link
- Empty state when no data
- Consistent card styling (`card` class)

- [ ] **Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/
git commit -m "feat: add goals, volume, upcoming, videos, and questionnaires widgets"
```

---

### Task 9: Dashboard Page Orchestrator

**Files:**
- Modify: `src/app/(dashboard)/athlete/dashboard/page.tsx` (complete rewrite)

- [ ] **Step 1: Read the current page.tsx**

Read the full current `page.tsx` to understand what exists. The rewrite replaces it entirely but should preserve the same `requireAthleteSession()` auth pattern.

- [ ] **Step 2: Rewrite page.tsx as widget orchestrator**

The new page:
1. Gets athlete session via `requireAthleteSession()`
2. Reads `athlete.dashboardConfig` (include it in the athlete query)
3. Resolves config via `resolveConfig()`
4. Builds fetcher map — only fetches data for enabled widgets
5. Passes data to widget components in order
6. Header: greeting, date, streak badge, "Customize dashboard" link

```typescript
// Key structure:
import { resolveConfig, WIDGET_IDS, type WidgetId, type DashboardConfig } from "./_widget-registry";
import { fetchReadinessData, fetchTodayWorkoutData, /* ... */ } from "@/lib/data/dashboard";
// Import all widget components
import { ReadinessHeroWidget } from "./_widgets/readiness-hero";
import { TodayWorkoutWidget } from "./_widgets/today-workout";
// ... etc

const FETCHERS: Record<WidgetId, (id: string) => Promise<unknown>> = {
  readiness: fetchReadinessData,
  "today-workout": fetchTodayWorkoutData,
  calendar: fetchCalendarData,
  // ... all 10
};

export default async function AthleteDashboardPage() {
  const { athlete } = await requireAthleteSession();
  // Need to fetch dashboardConfig — add to requireAthleteSession select or fetch separately
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athlete.id },
    select: { dashboardConfig: true },
  });

  const config = resolveConfig(profile?.dashboardConfig);
  const enabled = config.order.filter(w => config.widgets.includes(w));

  // Parallel fetch only enabled widgets
  const entries = await Promise.all(
    enabled.map(async (w) => [w, await FETCHERS[w](athlete.id)] as const)
  );
  const dataMap = Object.fromEntries(entries);

  // Also fetch stats for header (streak)
  const stats = await getAthleteStats(athlete.id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      {/* ... greeting, date, streak, customize link */}

      {/* Widgets in order */}
      <StaggeredList className="space-y-5" staggerDelay={60}>
        {enabled.map((widgetId) => (
          <WidgetRenderer key={widgetId} id={widgetId} data={dataMap[widgetId]} />
        ))}
      </StaggeredList>
    </div>
  );
}

// Widget renderer maps ID to component
function WidgetRenderer({ id, data }: { id: WidgetId; data: unknown }) {
  switch (id) {
    case "readiness": return <ReadinessHeroWidget data={data as ReadinessData} />;
    case "today-workout": return <TodayWorkoutWidget data={data as TodaySession[]} />;
    // ... all 10 cases
    default: return null;
  }
}
```

- [ ] **Step 3: Update requireAthleteSession or athlete query to include dashboardConfig**

Check `src/lib/data/athlete.ts` — if `requireAthleteSession` doesn't return `dashboardConfig`, either add it to the select or do a separate query in the page (simpler, already shown above).

- [ ] **Step 4: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Visual check on mobile viewport**

```bash
npm run dev
```

Navigate to `/athlete/dashboard` at 375px width. Verify:
- Greeting shows with correct name
- Readiness widget renders (checked-in or prompt state)
- Today's workout shows if sessions exist
- Widgets appear in correct order
- Staggered entrance animation plays

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/page.tsx
git commit -m "feat: rewrite athlete dashboard as widget-based orchestrator"
```

---

### Task 10: Dashboard Config API Endpoint

**Files:**
- Create: `src/app/api/athlete/dashboard-config/route.ts`

- [ ] **Step 1: Create the PATCH endpoint**

```typescript
// src/app/api/athlete/dashboard-config/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { WIDGET_IDS, PRESETS, type WidgetId, type PresetId } from "@/app/(dashboard)/athlete/dashboard/_widget-registry";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { preset, widgets, order } = body as {
    preset?: string;
    widgets?: string[];
    order?: string[];
  };

  // If preset is a known preset name, use its config
  if (preset && preset in PRESETS) {
    const presetConfig = PRESETS[preset as PresetId];
    await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data: { dashboardConfig: presetConfig },
    });
    return NextResponse.json(presetConfig);
  }

  // Custom config
  if (!Array.isArray(widgets) || !Array.isArray(order)) {
    return NextResponse.json({ error: "widgets and order must be arrays" }, { status: 400 });
  }

  // Validate widget IDs
  const validWidgets = widgets.filter((w): w is WidgetId => WIDGET_IDS.includes(w as WidgetId));
  const validOrder = order.filter((w): w is WidgetId => validWidgets.includes(w as WidgetId));

  // Ensure readiness is always present and first
  if (!validWidgets.includes("readiness")) validWidgets.unshift("readiness");
  if (!validOrder.includes("readiness")) validOrder.unshift("readiness");
  else if (validOrder[0] !== "readiness") {
    validOrder.splice(validOrder.indexOf("readiness"), 1);
    validOrder.unshift("readiness");
  }

  // Check if this matches any preset
  let resolvedPreset: string = "custom";
  for (const [name, p] of Object.entries(PRESETS)) {
    if (
      JSON.stringify(p.widgets) === JSON.stringify(validWidgets) &&
      JSON.stringify(p.order) === JSON.stringify(validOrder)
    ) {
      resolvedPreset = name;
      break;
    }
  }

  const config = { preset: resolvedPreset, widgets: validWidgets, order: validOrder };

  await prisma.athleteProfile.update({
    where: { userId: session.userId },
    data: { dashboardConfig: config },
  });

  return NextResponse.json(config);
}
```

- [ ] **Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/athlete/dashboard-config/route.ts
git commit -m "feat: add PATCH /api/athlete/dashboard-config endpoint"
```

---

### Task 11: Customize Panel

**Files:**
- Create: `src/app/(dashboard)/athlete/dashboard/_customize-panel.tsx`
- Modify: `src/app/(dashboard)/athlete/dashboard/page.tsx` (add customize trigger)

- [ ] **Step 1: Create the customize panel component**

Client component (`"use client"`). Full-screen modal sheet on mobile.

Key requirements:
- Slides up from bottom with spring animation (framer-motion `AnimatePresence` + `motion.div`)
- Backdrop blur (`backdrop-filter: blur(16px)`)
- **Preset selector**: 4 cards in 2x2 grid, active highlighted with gold border
- **Widget toggles**: List of all 10 widgets, each with icon + name + toggle switch + up/down arrows
- Readiness toggle is disabled (always on), its reorder arrows are grayed
- Changes save immediately: optimistic local state update + `fetch("/api/athlete/dashboard-config", { method: "PATCH", body })` in background
- "Reset to default" button restores Performance preset
- Close button (X) or tap backdrop to dismiss
- Uses `router.refresh()` after saving to re-render server components with new config

Props: `currentConfig: DashboardConfig`, `onClose: () => void`

- [ ] **Step 2: Add customize trigger to page.tsx**

In the dashboard header, add a client wrapper component that manages the panel open/close state and renders the "Customize dashboard" link.

Create a small client component `_customize-trigger.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Settings } from "lucide-react";
import { CustomizePanel } from "./_customize-panel";
import type { DashboardConfig } from "./_widget-registry";

export function CustomizeTrigger({ config }: { config: DashboardConfig }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary-500 transition-colors">
        <Settings size={14} strokeWidth={1.75} aria-hidden="true" />
        Customize
      </button>
      {open && <CustomizePanel currentConfig={config} onClose={() => setOpen(false)} />}
    </>
  );
}
```

Import and render `<CustomizeTrigger config={config} />` in the dashboard header.

- [ ] **Step 3: Verify with tsc and visual check**

```bash
npx tsc --noEmit
```

Open dashboard, click "Customize", verify panel slides up, presets work, toggles work, changes persist on refresh.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_customize-panel.tsx src/app/\(dashboard\)/athlete/dashboard/_customize-trigger.tsx src/app/\(dashboard\)/athlete/dashboard/page.tsx
git commit -m "feat: add customize panel with presets and widget toggles"
```

---

### Task 12: Animation Polish Pass

**Files:**
- Modify: Multiple widget files for animation refinement

- [ ] **Step 1: Readiness ring spring animation**

In `readiness-hero.tsx`, ensure the ring fill uses framer-motion:

```typescript
import { motion, useReducedMotion } from "framer-motion";

// Ring SVG with animated stroke-dashoffset
<motion.circle
  cx="50" cy="50" r="40"
  strokeDasharray={circumference}
  initial={{ strokeDashoffset: circumference }}
  animate={{ strokeDashoffset: circumference - (score / 10) * circumference }}
  transition={{ type: "spring", damping: 20, stiffness: 100 }}
/>
```

- [ ] **Step 2: Calendar dot spring pop**

In `workout-calendar.tsx`, add CSS animation for dots:

```css
@keyframes dot-pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

Apply with staggered `animation-delay` per row.

- [ ] **Step 3: Widget loading skeletons**

Add shaped shimmer skeletons to each widget — not generic bars but shaped to match content:
- Readiness: pulsing circle + 4 small bars
- Workout: line + 3 dot-and-bar rows
- Calendar: 7x5 grid of small pulsing squares
- PRs: 3 rows of circle + bar
- Stats: 3 rectangular blocks

Use existing `shimmer` CSS class.

- [ ] **Step 4: Gradient backgrounds on readiness hero**

Add score-driven gradient:

```typescript
const hue = score >= 8 ? 150 : score >= 5 ? 40 : 0; // green, amber, red
const style = { "--score-hue": hue } as React.CSSProperties;
// Apply: bg-gradient with hsl(var(--score-hue), ...)
```

- [ ] **Step 5: Verify all animations on mobile**

```bash
npm run dev
```

Check at 375px viewport:
- Ring fills with spring overshoot
- Factor bars stagger in
- Widgets stagger entrance
- Calendar dots pop in
- Tab underline slides
- Timeline items fade in on tab switch
- Start button springs on press
- Numbers animate up
- Customize panel slides up with blur

- [ ] **Step 6: Test prefers-reduced-motion**

In browser devtools, enable "Prefers reduced motion". Verify all animations are instant (no spring, no stagger).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Framer-level animation polish to all dashboard widgets"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Mobile visual QA checklist**

At 375px viewport width, verify:
- [ ] Dashboard loads with Performance preset (5 widgets)
- [ ] Readiness hero shows check-in prompt or score
- [ ] Today's Workout shows sessions or rest day message
- [ ] Calendar shows current month with correct dot indicators
- [ ] Personal Bests shows PRs with animated distances
- [ ] Quick Stats shows 3 numbers with count-up
- [ ] Customize panel opens, presets switch widgets correctly
- [ ] Toggle a widget off → it disappears from dashboard
- [ ] Reorder widgets → new order persists on refresh
- [ ] Reset to default → Performance preset restores
- [ ] All animations are smooth, no layout shift
- [ ] Empty states display correctly for each widget

- [ ] **Step 4: Desktop visual QA**

At 1280px, verify responsive grid layout looks good (widgets may go 2-across for smaller ones like stats + PRs).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete athlete dashboard overhaul with customizable widget system"
```
