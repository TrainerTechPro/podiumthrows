# Wearable Dashboard — Design Spec

## Goal

Replace the current WHOOP detail page and create a parallel Oura detail page with a data-dense "Metric Grid" dashboard that surfaces ALL available metrics from each wearable device. Both dashboards share a common visual language and component structure.

## Layout: Metric Grid

Chosen over Ring Gauge Hero (too much visual weight, less data density) and Tabbed Sections (hides data behind clicks). The Metric Grid shows every metric at a glance with trend indicators — optimized for coaches who want to scan an athlete's physiological state in seconds.

---

## 1. Page Structure (top to bottom)

### 1.1 Header
- Device name ("WHOOP Data" / "Oura Data") + "Settings" link (right-aligned)
- Same pattern as current page

### 1.2 Hero Banner
- Full-width card with gradient background
  - WHOOP: `from-emerald-500/10 via-surface-900/80 to-surface-950`
  - Oura: `from-violet-500/10 via-surface-900/80 to-surface-950`
- Left side: label (uppercase muted), score (`AnimatedNumber`, large), status label (color-coded)
- Right side: trend delta ("+ N vs 7d avg"), status word
- Score thresholds (WHOOP recovery 0-100):
  - >= 67: emerald, "Good" / "Excellent"
  - 34-66: amber, "Moderate"
  - < 34: red, "Low"
- Oura readiness uses same thresholds on 0-100 scale

### 1.3 Two-Up Cards
- `grid grid-cols-2 gap-3`
- WHOOP: Strain (amber, value/21 progress bar) + Sleep (indigo, formatted Xh Ym, efficiency subtitle)
- Oura: Sleep Score (indigo, 0-100 progress bar, duration subtitle) + Activity Score (emerald, 0-100 progress bar, "Goal Reached" if >= 100)
- Standard `card` class (not `card-interactive`)
- Values use `AnimatedNumber`

### 1.4 Vitals Strip
- WHOOP: 5-column grid — HRV, RHR, SpO2, Skin Temp, Sleep Perf
- Oura: 4-column grid — HRV, RHR, SpO2, Temp Dev
- Each cell: mini card with label (9px uppercase), value (`AnimatedNumber`), trend arrow
- Trend arrow: inline helper function (not a reusable component) — renders a Lucide `TrendingUp` or `TrendingDown` icon (size 10, strokeWidth 1.75) with the delta value. Positive = emerald, negative = amber. Shown when today's value differs from 7-day avg by > 2%.
- Mobile: stays multi-column with tighter padding (`gap-1 sm:gap-3`, `padding: 5px 2px`)
- Color coding (uses Tailwind status classes, not CSS custom properties — these are semantic status indicators, not theme-dependent):
  - Skin Temp: emerald for <=0.5C deviation, amber for 0.5-1.0C, red for >1.0C
  - SpO2: red <95%, amber 95-96%, emerald >96%

### 1.5 Sleep Stages
- Stacked bar: light (blue-400), deep (indigo-500), REM (purple-500)
- Custom stacked bar (NOT ProgressBar — ProgressBar is single-fill). Use a flex container with 3 divs, each `width` set as percentage of total. Apply CSS `transition: width 800ms cubic-bezier(0.4, 0, 0.2, 1)` triggered by IntersectionObserver on viewport entry (same pattern as ProgressBar internals). Respects `prefers-reduced-motion`.
- Legend below with color dots and individual durations
- WHOOP: lightSleepMs, swsSleepMs, remSleepMs
- Oura: lightSleepSec, deepSleepSec, remSleepSec (convert to ms for display helper)

### 1.6 Seven-Day Trend Chart
- `LineChart` from `src/components/charts/LineChart.tsx` — supports multiple series via `datasets` prop
- WHOOP: recovery (emerald solid) + strain (amber dashed)
- Oura: readiness (violet solid) + sleep score (indigo dashed)
- 7 data points from history, x-axis shows day abbreviations
- Legend below the chart

### 1.7 Seven-Day Averages
- Single `card` with stacked rows using `flex justify-between` per row, `divide-y divide-[var(--card-border)]`
- Each row: label (text-sm text-muted, left) + value (text-sm font-bold tabular-nums, right)
- WHOOP: Recovery, HRV, RHR, SpO2, Skin Temp, Strain, Sleep, Sleep Eff
- Oura: Readiness, HRV, RHR, SpO2, Temp Dev, Sleep Score, Sleep Dur, Activity
- Recovery/Readiness values color-coded with `recoveryColor` helper; others use `text-[var(--foreground)]`

### 1.8 History Table
- WHOOP columns: Date, Recovery, HRV, RHR, SpO2, Skin Temp, Sleep, Efficiency, Strain
- Oura columns: Date, Readiness, HRV, RHR, SpO2, Temp Dev, Sleep Score, Sleep Dur, Activity
- `overflow-x-auto custom-scrollbar` on mobile
- Row hover: `hover:bg-surface-50 dark:hover:bg-surface-800/30`
- Color-coded recovery/readiness scores (existing `recoveryColor` helper)

### 1.9 Empty State
- Centered card (`card p-8 text-center space-y-2`)
- WHOOP: title "No WHOOP data yet", body "Data will appear here after your first recovery is scored. Make sure your WHOOP strap is connected and syncing."
- Oura: title "No Oura data yet", body "Data will appear here after your first readiness score. Make sure your Oura Ring is connected and syncing."

---

## 2. Component Architecture

### 2.1 Files

```
src/app/(dashboard)/athlete/whoop/page.tsx  — rewrite (Server Component, data fetching)
src/app/(dashboard)/athlete/oura/page.tsx   — new (Server Component, data fetching)
src/app/(dashboard)/athlete/_wearable-dashboard.tsx — new (shared presentation component)
```

### 2.2 Shared Component

`_wearable-dashboard.tsx` is a **new file created as part of this spec** — it does not exist yet. It is a Server Component (no 'use client') that receives:

```typescript
interface WearableDashboardProps {
  device: "whoop" | "oura";
  today: WhoopSnapshot | OuraSnapshot | null;
  history: (WhoopSnapshot | OuraSnapshot)[];
  averages: Record<string, number | null>;  // computed 7-day averages
  syncMode: string;
  lastSyncAt: Date | null;
}
```

The WHOOP and Oura page Server Components each:
1. Query Prisma for the connection + snapshots (last 30 days)
2. Compute 7-day averages server-side
3. Compute trend deltas (today vs avg)
4. Pass normalized props to `WearableDashboard`

### 2.3 Device-Specific Rendering

The shared component uses the `device` prop to determine:
- Gradient colors (emerald vs violet)
- Which metrics appear in the vitals strip (5 vs 4 columns)
- Two-up card content (strain+sleep vs sleep+activity)
- Trend chart series (recovery+strain vs readiness+sleep)
- History table columns

This is handled with simple conditionals, not a complex abstraction — the two devices are similar enough that branching within one component is cleaner than two parallel components.

---

## 3. Data

### 3.1 No New Endpoints

All data already exists in `WhoopDailySnapshot` and `OuraDailySnapshot`. The current WHOOP page already queries these — we expand the query to include all fields.

### 3.2 New Averages

The current page computes 5 averages (recovery, HRV, RHR, strain, sleep). We add:
- `avgSpo2`
- `avgSkinTemp` (WHOOP only)
- `avgSleepEfficiency`
- `avgSleepPerformance` (WHOOP only)

All computed server-side with the same `avg()` helper.

### 3.3 Oura Page Data

New file `src/app/(dashboard)/athlete/oura/page.tsx` queries `OuraConnection` and `OuraDailySnapshot` following the exact same pattern as the WHOOP page.

---

## 4. Animations

- **Page entry**: handled by existing framer-motion `template.tsx`
- **Hero score**: `AnimatedNumber` (1200ms count-up on viewport entry)
- **All numeric values**: `AnimatedNumber` with appropriate `decimals` prop
- **Card entrance**: `StaggeredList` wraps below-hero content (60ms stagger)
- **Sleep stages bar**: custom CSS transition (see 1.5), NOT ProgressBar
- **All respect `prefers-reduced-motion`**

### 4.1 AnimatedNumber Decimals Reference

Units are rendered as a sibling `<span>` next to `<AnimatedNumber>` — the component renders the number only.

| Metric | `decimals` | Unit suffix | Example |
|--------|-----------|-------------|---------|
| Recovery / Readiness | 0 | `%` | `76%` |
| HRV | 0 | `ms` | `54ms` |
| RHR | 0 | `bpm` | `58bpm` |
| SpO2 | 1 | `%` | `97.2%` |
| Skin Temp | 1 | `°C` (with +/- prefix) | `+0.3°C` |
| Temp Deviation (Oura) | 1 | `°C` (with +/- prefix) | `+0.1°C` |
| Strain | 1 | none | `14.2` |
| Sleep Duration | n/a | formatted `Xh Ym` | `7h 42m` (use `formatMs` helper, not AnimatedNumber) |
| Sleep Perf / Efficiency | 0 | `%` | `91%` |
| Sleep Score (Oura) | 0 | `/100` | `88` |
| Activity Score (Oura) | 0 | `/100` | `92` |

---

## 5. Responsive Behavior

- Hero: full-width, score + trend stack on narrow screens
- Two-up cards: `grid-cols-2` at all breakpoints
- Vitals strip: stays multi-column, tighter padding on mobile
- Trend chart: full-width, fixed height
- History table: horizontal scroll on mobile
- Averages: full-width compact list

---

## 6. What This Does NOT Include

- No new API fetching from WHOOP/Oura (uses existing sync infrastructure)
- No widget customization/reordering (YAGNI)
- No workout data from WHOOP `/v2/activity/workout` (not currently fetched — separate future work)
- No body measurement data from WHOOP `/v2/body` (not currently fetched)
- No changes to the cron sync, webhook, or readiness check-in flows
