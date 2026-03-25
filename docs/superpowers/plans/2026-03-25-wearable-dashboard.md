# Wearable Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WHOOP and Oura detail pages with a shared Metric Grid dashboard that surfaces all available metrics (including skinTempC, sleepEfficiency, spo2 in averages/history) with trend indicators.

**Architecture:** Extract shared helpers and presentation into `_wearable-dashboard.tsx`. Both page files become thin Server Components that query Prisma and pass normalized props. The shared component handles all rendering with device-specific branching via a `device` prop.

**Tech Stack:** Next.js 14.2 App Router, Server Components, Prisma, existing UI components (AnimatedNumber, StaggeredList, LineChart, ProgressBar)

**Spec:** `docs/superpowers/specs/2026-03-25-wearable-dashboard-design.md`

---

## File Structure

```
src/app/(dashboard)/athlete/_wearable-helpers.ts    — NEW: shared helpers (colors, formatters, types)
src/app/(dashboard)/athlete/_wearable-dashboard.tsx  — NEW: shared Metric Grid dashboard component
src/app/(dashboard)/athlete/whoop/page.tsx           — REWRITE: thin data-fetching shell
src/app/(dashboard)/athlete/oura/page.tsx            — REWRITE: thin data-fetching shell
```

No new API routes, no schema changes, no new dependencies.

---

### Task 1: Create shared wearable helpers

**Files:**
- Create: `src/app/(dashboard)/athlete/_wearable-helpers.ts`

This extracts and consolidates helpers currently duplicated across the WHOOP page (lines 10-36) and Oura page (similar helpers). Both pages define their own color/format functions — we unify them.

- [ ] **Step 1: Create the shared helpers file**

```typescript
// src/app/(dashboard)/athlete/_wearable-helpers.ts

// ─── Score Color Helpers ────────────────────────────────────────────────────

/** Color for recovery/readiness score text (0-100 scale) */
export function scoreColor(score: number | null): string {
  if (score === null) return "text-surface-400";
  if (score >= 67) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Background for recovery/readiness hero card */
export function scoreBg(score: number | null): string {
  if (score === null) return "bg-surface-100 dark:bg-surface-800";
  if (score >= 67) return "bg-emerald-50 dark:bg-emerald-500/10";
  if (score >= 34) return "bg-amber-50 dark:bg-amber-500/10";
  return "bg-red-50 dark:bg-red-500/10";
}

/** Status label for recovery/readiness score */
export function scoreLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 80) return "Excellent";
  if (score >= 67) return "Good";
  if (score >= 34) return "Moderate";
  return "Low";
}

/** SpO2 color: red <95%, amber 95-96%, emerald >96% */
export function spo2Color(value: number | null): string {
  if (value === null) return "text-surface-400";
  if (value > 96) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 95) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Skin temp color: emerald <=0.5C, amber 0.5-1.0C, red >1.0C */
export function skinTempColor(deviation: number | null): string {
  if (deviation === null) return "text-surface-400";
  const abs = Math.abs(deviation);
  if (abs <= 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (abs <= 1.0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ─── Formatters ─────────────────────────────────────────────────────────────

export function formatMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

export function formatSec(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Compute average of non-null values */
export function avg(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/** Trend delta: today vs average. Returns null if either is null. */
export function trendDelta(today: number | null, average: number | null): number | null {
  if (today === null || average === null) return null;
  return Math.round((today - average) * 10) / 10;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WhoopMetrics {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  skinTempC: number | null;
  strain: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  sleepEfficiency: number | null;
  lightSleepMs: number | null;
  swsSleepMs: number | null;
  remSleepMs: number | null;
}

export interface OuraMetrics {
  readinessScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  temperatureDeviation: number | null;
  sleepScore: number | null;
  sleepDurationSec: number | null;
  sleepEfficiency: number | null;
  lightSleepSec: number | null;
  deepSleepSec: number | null;
  remSleepSec: number | null;
  activityScore: number | null;
  steps: number | null;
}

export interface SnapshotRow {
  id: string;
  date: string;
}

export type WhoopRow = SnapshotRow & WhoopMetrics;
export type OuraRow = SnapshotRow & OuraMetrics;
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/_wearable-helpers.ts
git commit -m "feat: add shared wearable dashboard helpers (colors, formatters, types)"
```

---

### Task 2: Create the shared WearableDashboard component

**Files:**
- Create: `src/app/(dashboard)/athlete/_wearable-dashboard.tsx`
- Reference: `docs/superpowers/specs/2026-03-25-wearable-dashboard-design.md`
- Reference: existing WHOOP page `src/app/(dashboard)/athlete/whoop/page.tsx` for structure
- Reference: existing Oura page `src/app/(dashboard)/athlete/oura/page.tsx` for Oura patterns

This is the largest task. Build the full Metric Grid layout as a Server Component.

- [ ] **Step 1: Create the component file with imports and props interface**

The component receives normalized data from the page Server Components. Define the props:

```typescript
import { type WhoopRow, type OuraRow } from "./_wearable-helpers";

interface WearableDashboardProps {
  device: "whoop" | "oura";
  today: WhoopRow | OuraRow | null;
  history: (WhoopRow | OuraRow)[];
  averages: Record<string, number | null>;
  lastSyncAt: Date | null;
}
```

- [ ] **Step 2: Implement the Hero Banner section**

Gradient hero card with:
- Device-specific gradient (emerald for WHOOP, violet for Oura)
- Primary score (recovery or readiness) via `AnimatedNumber decimals={0}`
- Score label via `scoreLabel()`
- Trend delta vs 7-day average (right side)
- Use `scoreColor()` and `scoreBg()` from helpers

Reference spec section 1.2 for exact layout.

- [ ] **Step 3: Implement the Two-Up Cards section**

Grid of 2 cards:
- WHOOP: Strain (amber, progress bar width = strain/21*100%) + Sleep (indigo, formatMs duration, efficiency subtitle)
- Oura: Sleep Score (indigo, /100) + Activity Score (emerald, /100, "Goal Reached" if >= 100)
- Both use `AnimatedNumber` for numeric values
- Standard `card` class

Reference spec section 1.3.

- [ ] **Step 4: Implement the Vitals Strip**

5-col grid (WHOOP) or 4-col grid (Oura):
- Each cell: mini card, label (uppercase muted 9px), `AnimatedNumber`, trend arrow
- Trend arrow: inline — Lucide `TrendingUp`/`TrendingDown` (size 10, strokeWidth 1.75) + delta value
- WHOOP: HRV (0 decimals, "ms"), RHR (0, "bpm"), SpO2 (1, "%"), Skin Temp (1, "°C" with +/-), Sleep Perf (0, "%")
- Oura: HRV (0, "ms"), RHR (0, "bpm"), SpO2 (1, "%"), Temp Dev (1, "°C" with +/-)
- Apply `spo2Color()` and `skinTempColor()` from helpers

Reference spec section 1.4.

- [ ] **Step 5: Implement Sleep Stages section**

- Stacked flex bar: light (blue-400), deep (indigo-500), REM (purple-500)
- Each div width = percentage of total sleep
- CSS transition: `transition-all duration-700 ease-out` triggered by client-side IntersectionObserver (wrap this small piece in a 'use client' child component or use the existing pattern from ProgressBar)
- Legend below with colored dots and `formatMs`/`formatSec` durations
- WHOOP: lightSleepMs, swsSleepMs, remSleepMs
- Oura: lightSleepSec, deepSleepSec, remSleepSec

Reference spec section 1.5. Note: use a small client component for the viewport-triggered animation — call it `SleepStagesBar`.

- [ ] **Step 6: Implement 7-Day Trend Chart**

- Import `LineChart` from `src/components/charts/LineChart.tsx`
- Build datasets from last 7 days of history
- WHOOP: recovery (emerald) + strain (amber, dashed)
- Oura: readiness (violet) + sleep score (indigo, dashed)
- X-axis: day abbreviations from `formatDate`
- Wrap in card with section label

Reference spec section 1.6.

- [ ] **Step 7: Implement 7-Day Averages card**

- Single card, `divide-y divide-[var(--card-border)]`
- Each row: `flex justify-between`, label left (text-sm text-muted), value right (text-sm font-bold tabular-nums)
- WHOOP metrics: Recovery, HRV, RHR, SpO2, Skin Temp, Strain, Sleep, Sleep Eff
- Oura metrics: Readiness, HRV, RHR, SpO2, Temp Dev, Sleep Score, Sleep Dur, Activity
- Recovery/Readiness values use `scoreColor()`, others use `text-[var(--foreground)]`

Reference spec section 1.7.

- [ ] **Step 8: Implement History Table**

- WHOOP columns: Date, Recovery, HRV, RHR, SpO2, Skin Temp, Sleep, Efficiency, Strain
- Oura columns: Date, Readiness, HRV, RHR, SpO2, Temp Dev, Sleep Score, Sleep Dur, Activity
- `overflow-x-auto custom-scrollbar` wrapper
- Row hover: `hover:bg-surface-50 dark:hover:bg-surface-800/30`
- Recovery/Readiness color-coded with `scoreColor()`
- All numbers use `tabular-nums`

Reference spec section 1.8.

- [ ] **Step 9: Implement Empty State**

- WHOOP: "No WHOOP data yet" / "Data will appear here after your first recovery is scored..."
- Oura: "No Oura data yet" / "Data will appear here after your first readiness score..."
- Card: `card p-8 text-center space-y-2`

Reference spec section 1.9.

- [ ] **Step 10: Assemble the full component**

- Wrap sections 1.3-1.8 in `StaggeredList` (60ms stagger)
- Add `ScrollProgressBar` as first child
- Conditional rendering: show empty state if no history and no today snapshot
- Show today sections only when `today` is not null

- [ ] **Step 11: Verify file compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add src/app/\(dashboard\)/athlete/_wearable-dashboard.tsx
git commit -m "feat: add shared WearableDashboard metric grid component"
```

---

### Task 3: Rewrite the WHOOP page to use the shared dashboard

**Files:**
- Modify: `src/app/(dashboard)/athlete/whoop/page.tsx` (full rewrite — currently 350 lines)

- [ ] **Step 1: Rewrite the WHOOP page**

Replace the entire file with a thin Server Component that:
1. Calls `requireAthleteSession()` to get the athlete
2. Queries `prisma.whoopConnection` for the connection (redirect to settings if none)
3. Queries `prisma.whoopDailySnapshot` for last 30 days (orderBy date desc)
4. Finds today's snapshot
5. Computes 7-day averages for ALL metrics using `avg()` helper:
   - avgRecovery, avgHrv, avgRhr, avgSpo2, avgSkinTemp, avgStrain, avgSleep, avgSleepEfficiency, avgSleepPerformance
6. Passes everything to `WearableDashboard` with `device="whoop"`

The file should be ~80-100 lines — just data fetching and prop mapping.

- [ ] **Step 2: Verify page compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/whoop/page.tsx
git commit -m "refactor: rewrite WHOOP page to use shared WearableDashboard"
```

---

### Task 4: Rewrite the Oura page to use the shared dashboard

**Files:**
- Modify: `src/app/(dashboard)/athlete/oura/page.tsx` (full rewrite — currently 423 lines)

- [ ] **Step 1: Rewrite the Oura page**

Same pattern as WHOOP page:
1. `requireAthleteSession()`
2. Query `prisma.ouraConnection` (redirect if none)
3. Query `prisma.ouraDailySnapshot` for last 30 days
4. Find today's snapshot
5. Compute averages: avgReadiness, avgHrv, avgRhr, avgSpo2, avgTempDev, avgSleepScore, avgSleepDur, avgSleepEfficiency, avgActivity
6. Pass to `WearableDashboard` with `device="oura"`

- [ ] **Step 2: Verify page compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/oura/page.tsx
git commit -m "refactor: rewrite Oura page to use shared WearableDashboard"
```

---

### Task 5: Full verification

**Files:** All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors (warnings acceptable)

- [ ] **Step 3: Verify no unused imports in old pages**

Grep for any remaining imports of the old local helpers that should now come from `_wearable-helpers.ts`:
- `recoveryColor` should not be defined in whoop/page.tsx or oura/page.tsx
- `formatMs` should not be defined in whoop/page.tsx
- `readinessColor` should not be defined in oura/page.tsx

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: wearable dashboard cleanup and verification"
```
