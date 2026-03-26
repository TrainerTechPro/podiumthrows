# Readiness Check-in Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-form readiness check-in with a 5-screen progressive flow featuring an interactive SVG body map, wearable pre-fill, and animated score summary.

**Architecture:** One-per-page flow controller (`_checkin-flow.tsx`) owns all state and renders step components. Each step is a pure UI component receiving `data`, `onChange`, `onNext`, `onBack`. The `InteractiveBodyMap` component (already built) provides the SVG body diagram. A `parseSorenessArea()` utility handles backwards-compatible reading of both old text and new JSON formats across all consumers.

**Tech Stack:** React 18.3, TypeScript, Next.js 14.2 App Router, Tailwind CSS, react-muscle-highlighter (installed), Prisma

**Spec:** `docs/superpowers/specs/2026-03-25-readiness-checkin-redesign-design.md`

---

## Task 1: Create sorenessArea parsing utility

**Files:**
- Create: `src/lib/readiness/parse-soreness.ts`

- [ ] **Step 1: Create the parsing utility**

```ts
import type { SoreArea } from "@/components/ui/InteractiveBodyMap";

export function parseSorenessArea(raw: string | null): {
  isStructured: boolean;
  areas: SoreArea[];
  legacyText: string | null;
} {
  if (!raw) return { isStructured: false, areas: [], legacyText: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].slug) {
      return { isStructured: true, areas: parsed, legacyText: null };
    }
  } catch {
    // Not JSON — legacy format
  }
  return { isStructured: false, areas: [], legacyText: raw };
}

export function serializeSorenessArea(areas: SoreArea[]): string | null {
  if (areas.length === 0) return null;
  return JSON.stringify(areas);
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/readiness/parse-soreness.ts
git commit -m "feat: add parseSorenessArea utility for backwards-compatible format handling"
```

---

## Task 2: Update API schema and route for ouraSleepScore + structured sorenessArea

**Files:**
- Modify: `src/lib/api-schemas.ts:122-144` — add `ouraSleepScore` to `ReadinessCheckInSchema`
- Modify: `src/app/api/athlete/readiness/route.ts:29-48,84-108` — destructure and persist `ouraSleepScore`

- [ ] **Step 1: Add ouraSleepScore to Zod schema**

In `src/lib/api-schemas.ts`, add after line 141 (`ouraActivityScore`):

```ts
  ouraSleepScore: z.number().optional(),
```

- [ ] **Step 2: Destructure ouraSleepScore in route handler**

In `src/app/api/athlete/readiness/route.ts`, add `ouraSleepScore` to the destructured fields at line 44-45 (after `ouraActivityScore`):

```ts
      ouraActivityScore,
      ouraSleepScore,
```

And add to the Prisma `create` data at line 104 (after `ouraActivityScore`):

```ts
        ouraSleepScore: ouraSleepScore ?? null,
```

**Wearable mapping note:** The flow controller sends `ouraData.sleepScore` (0-100 value from Oura sync) as the `ouraSleepScore` field in the POST payload. This is the raw Oura score, not the mapped 1-10 quality value.

- [ ] **Step 3: Update API response to include streak**

The current API response at line 108 only returns `{ id, overallScore, date }`. The Summary step needs the streak count. Modify the `select` to also return the streak, or add the streak to the response:

```ts
// After the create call, the route already computes newStreak at line 112.
// Update the final response to include it:
return NextResponse.json({
  ...checkIn,
  streak: newStreak,
});
```

- [ ] **Step 4: Update sorenessArea handling in route**

At line 91, the route currently does `sorenessArea: sorenessArea?.trim() || null`. This already works for both string and JSON-string formats — no change needed. The client will send `JSON.stringify(soreAreas)` which is a valid string.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-schemas.ts src/app/api/athlete/readiness/route.ts
git commit -m "feat: accept ouraSleepScore in readiness API, return streak in response"
```

---

## Task 3: Update ALL sorenessArea consumers to use parsing utility

**Files (spec requires all 5 consumers + 2 data-layer pass-throughs):**
- Modify: `src/app/(dashboard)/athlete/wellness/page.tsx` — display sorenessArea
- Modify: `src/app/(dashboard)/coach/athletes/[id]/page.tsx` — coach view
- Modify: `src/app/api/readiness/team/route.ts` — team readiness response
- Modify: `src/app/api/readiness/[athleteId]/route.ts` — athlete history response
- Modify: `src/app/api/readiness/[athleteId]/latest/route.ts` — latest check-in response

**No change needed:** `src/lib/data/athlete.ts` and `src/lib/data/coach.ts` pass `sorenessArea` as a raw string from Prisma — they don't transform it, so they work with both formats already.

- [ ] **Step 1: Read ALL five consumer files to find sorenessArea display/transform locations**

Search each file for `sorenessArea` references. For UI files: update display. For API files: ensure the response includes the raw string (consumers parse client-side) OR parse server-side and return structured data.

- [ ] **Step 2: Update wellness page**

Import and use:
```tsx
import { parseSorenessArea } from "@/lib/readiness/parse-soreness";
```

Replace raw `sorenessArea` display with:
```tsx
const { isStructured, areas, legacyText } = parseSorenessArea(checkIn.sorenessArea);
// Render areas as colored chips or legacyText as before
```

- [ ] **Step 3: Update coach athlete detail page**

Same pattern — import `parseSorenessArea`, replace raw `sorenessArea.replace(/_/g, " ")` display with structured/legacy rendering.

- [ ] **Step 4: Update API routes (team, history, latest)**

For `src/app/api/readiness/team/route.ts`, `src/app/api/readiness/[athleteId]/route.ts`, and `src/app/api/readiness/[athleteId]/latest/route.ts`: these return `sorenessArea` as a raw string from Prisma. This already works for both formats since the client does the parsing. Verify no server-side `replace(/_/g, " ")` transforms exist. If they do, replace with `parseSorenessArea()`.

- [ ] **Step 5: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/athlete/wellness/page.tsx" "src/app/(dashboard)/coach/athletes/[id]/page.tsx" "src/app/api/readiness/"
git commit -m "feat: render structured sorenessArea as severity chips, backwards-compat with legacy text"
```

---

## Task 4: Create step components — Sleep and Soreness

**Files:**
- Create: `src/app/(dashboard)/athlete/wellness/_steps/sleep-step.tsx`
- Create: `src/app/(dashboard)/athlete/wellness/_steps/soreness-step.tsx`

**IMPORTANT: All step files MUST include `"use client";` at the top** — they use `useState`, event handlers, and `window.matchMedia`.

- [ ] **Step 1: Create the Sleep step**

This screen has:
- Sleep quality slider (1-10) with glowing thumb, color-coded value
- Sleep hours stepper (+/- buttons, 0.5hr increments, range 1-14). **Intentional change** from the old form's 3-12 range — range 1-14 covers edge cases (very short sleep, oversleep). Hours 1-3 all score identically due to clamping.
- Wearable badge if Oura/WHOOP data available

Read `_checkin-form.tsx` lines 35-87 for the existing `SliderField` pattern and lines 91-140 for pre-fill logic. Reuse the same color logic (green ≥8, amber ≥5, red <5) and pre-fill patterns.

The component accepts `StepProps`:
```tsx
interface StepProps {
  data: CheckinData;
  onChange: (updates: Partial<CheckinData>) => void;
  onNext: () => void;
  onBack: () => void;
  whoopData?: WhoopSnapshot | null;
  ouraData?: OuraSnapshot | null;
  isFirst?: boolean;
}
```

**OuraSnapshot interface note:** The wellness page currently passes 7 fields (including `hrvMs`, `restingHR`, `spo2`). The step components only use `sleepScore`, `sleepDurationSec`, `readinessScore`, and `activityScore`. Accept the full interface from the page to avoid breaking the prop chain — just use the fields you need.

Style: Lucide Moon icon in amber-tinted 40x40 container. Outfit 20px heading. DM Sans body. Amber progress bar at top showing "1/5".

- [ ] **Step 2: Create the Soreness step**

This screen has:
- Overall soreness slider (1-10), inverted coloring (low = green = good)
- `<InteractiveBodyMap value={data.sorenessArea} onChange={areas => onChange({ sorenessArea: areas })} />`
- Uses 3-point severity scale (Mild/Moderate/Severe)

Lucide Flame icon in green-tinted container. Progress bar "2/5".

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/wellness/_steps/"
git commit -m "feat: add Sleep and Soreness step components for readiness flow"
```

---

## Task 5: Create step components — Stress/Energy, Quick Checks, Notes

**Files:**
- Create: `src/app/(dashboard)/athlete/wellness/_steps/stress-energy-step.tsx`
- Create: `src/app/(dashboard)/athlete/wellness/_steps/quick-checks-step.tsx`
- Create: `src/app/(dashboard)/athlete/wellness/_steps/notes-step.tsx`

- [ ] **Step 1: Create Stress & Energy step**

Two sliders (stress 1-10, energy 1-10) with hint labels. Lucide Sparkles icon in yellow-tinted container. Progress "3/5". Optional "compared to yesterday" badge if previous check-in data is available (pass as additional prop or fetch in the flow controller).

- [ ] **Step 2: Create Quick Checks step**

Hydration: 3 tappable cards (Poor/Adequate/Good) with Lucide icons (AlertTriangle, Minus, Check). Green border + tinted bg for selected state.
Injury: 3 tappable cards (None/Monitoring/Active) with Lucide icons (CheckCircle, Eye, AlertCircle). If Monitoring or Active selected, expand a text input for `injuryNotes` below.
Lucide CheckCircle icon in green container. Progress "4/5".

- [ ] **Step 3: Create Notes step**

Optional textarea with "Anything your coach should know?" prompt. Skip button (secondary) + Submit button (primary amber). On mobile: `<SlideToConfirm>` instead of submit button. Progress "5/5".

The Notes step calls `onSubmit()` instead of `onNext()`. Add `onSubmit` to its props (or use the flow controller's submit handler passed via `onNext`).

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/athlete/wellness/_steps/"
git commit -m "feat: add Stress/Energy, Quick Checks, and Notes step components"
```

---

## Task 6: Create Summary step with animated score reveal

**Files:**
- Create: `src/app/(dashboard)/athlete/wellness/_steps/summary-step.tsx`

- [ ] **Step 1: Create the Summary step**

This screen shows AFTER submission (receives `overallScore` from API response). Components:
- SVG circle progress ring: `<svg viewBox="0 0 140 140">` with animated `stroke-dashoffset` (408 = empty circle, target based on score). Color: green ≥8, amber ≥5, red <5. Use `useEffect` to animate from 408 to target over 1s.
- `<AnimatedNumber value={score} decimals={1} />` for the score number (count-up from 0)
- Score label: "Great" (≥8), "Good to Go" (≥6), "Take It Easy" (≥4), "Rest Day" (<4)
- Streak badge: "X-day streak" (passed as prop from flow controller)
- Breakdown grid: 4 mini cards showing Sleep, Soreness, Stress, Energy values with mini `<ProgressBar>` components
- Wearable comparison line if Oura data available: "You: {sleepQuality}/10 sleep · Oura: {ouraSleepScore}/100"
- `celebration` toast via `useToast()` if score ≥ 8
- "Done" button navigates back to wellness page via `router.refresh()` + scroll to top

All animations respect `prefers-reduced-motion` — check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and skip to final values.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/athlete/wellness/_steps/summary-step.tsx"
git commit -m "feat: add animated score summary step with ring chart and breakdown"
```

---

## Task 7: Create flow controller and wire into wellness page

**Files:**
- Create: `src/app/(dashboard)/athlete/wellness/_checkin-flow.tsx`
- Modify: `src/app/(dashboard)/athlete/wellness/page.tsx`
- Delete: `src/app/(dashboard)/athlete/wellness/_checkin-form.tsx`

- [ ] **Step 1: Create the flow controller**

`_checkin-flow.tsx` is a `"use client"` component that:
1. Manages `phase`: `"sleep" | "soreness" | "stress" | "checks" | "notes" | "submitting" | "summary"`
2. Manages `CheckinData` state with sensible defaults (sleepQuality: 7, sleepHours: 8, soreness: 7, etc.)
3. Pre-fills from wearable data on mount (same logic as current `_checkin-form.tsx` lines 101-111)
4. Renders the active step component with `StepProps`
5. On submit: POST to `/api/athlete/readiness` with `csrfHeaders()`, serialize `sorenessArea` via `serializeSorenessArea()`, include `ouraSleepScore` from Oura data
6. Handle 409 (already checked in) with friendly message + navigate button
7. Handle network errors with retry button (state preserved)
8. On success: transition to summary step with `overallScore` and `streak` from response (Task 2 updated the API to return both)
9. Step transitions: CSS fade + slide (outgoing left 150ms, incoming right 200ms). Track `direction` for back navigation reversal.

Props: `{ whoopData?, ouraData?, previousScore? }` — passed from the server component page.

- [ ] **Step 2: Update wellness page to use new flow**

In `page.tsx`:
- Replace `import { CheckInForm } from "./_checkin-form"` with `import { CheckinFlow } from "./_checkin-flow"`
- Replace `<CheckInForm whoopData={...} ouraData={...} />` with `<CheckinFlow whoopData={...} ouraData={...} previousScore={...} />`
- Fetch previous day's check-in score for the "compared to yesterday" badge (simple Prisma query, one extra line in the server component data fetching)

- [ ] **Step 3: Delete old form**

```bash
rm "src/app/(dashboard)/athlete/wellness/_checkin-form.tsx"
```

- [ ] **Step 4: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 5: Verify no references to deleted file**

Run: `grep -r "_checkin-form" src/ --include="*.tsx" --include="*.ts"`
Expected: 0 matches

- [ ] **Step 6: Commit**

```bash
git add -A "src/app/(dashboard)/athlete/wellness/"
git commit -m "feat: replace single-form check-in with one-per-page progressive flow"
```

---

## Task 8: Update SEVERITY_LABELS comment and legacy route

**Files:**
- Modify: `src/lib/forms/constants.ts:178` — update misleading comment
- Modify: `src/app/api/readiness/route.ts` — add `ouraSleepScore` support (mirrors Task 2 changes)

- [ ] **Step 1: Fix misleading comment**

In `src/lib/forms/constants.ts` line 178, change:
```ts
// ─── Severity Labels (for body map) ────────────────────────────────────────
```
to:
```ts
// ─── Severity Labels (for form-blocks body map — legacy 5-point scale) ─────
```

- [ ] **Step 2: Update legacy readiness route**

Read `src/app/api/readiness/route.ts`. It uses the shared `ReadinessCheckInSchema` (line 12), so the Zod change from Task 2 propagates. However, the legacy route's destructuring (lines 31-42) and Prisma `create` call (lines 72-86) do NOT include wearable fields (`ouraSleepScore`, `hrvMs`, etc.). **Known limitation:** this legacy route has always been incomplete for wearable data. For this task, only verify it doesn't break with the new `sorenessArea` format. Full wearable field parity is out of scope (the primary route at `/api/athlete/readiness` is what the new flow uses).

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/forms/constants.ts src/app/api/readiness/route.ts
git commit -m "chore: fix severity labels comment, update legacy readiness route"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Verify no dead imports**

Run: `grep -r "_checkin-form" src/app/\(dashboard\)/athlete/wellness/ --include="*.tsx" --include="*.ts"`
Expected: 0 matches

Note: `CheckInForm` also exists as a local function name in `src/app/(dashboard)/coach/throws/profile/page.tsx` — that's a different, unrelated component. Only search the wellness directory.

- [ ] **Step 4: Verify mobile touch targets and responsive layout**

Manually check (or use browser dev tools at 375px width):
- All buttons and tappable areas ≥ 44px tall
- Body map is usable on small screens (220px wide minimum)
- Progress bar and step content fit without horizontal scroll
- SlideToConfirm appears on mobile, regular button on desktop

- [ ] **Step 5: Verify API contract**

The POST `/api/athlete/readiness` must accept this payload shape (backwards-compatible — all existing fields still work, new fields are optional):

```json
{
  "sleepQuality": 7,
  "sleepHours": 7.5,
  "soreness": 3,
  "sorenessArea": "[{\"region\":\"L. Shoulder\",\"slug\":\"deltoids\",\"side\":\"left\",\"severity\":3}]",
  "stressLevel": 4,
  "energyMood": 7,
  "hydration": "GOOD",
  "injuryStatus": "NONE",
  "injuryNotes": null,
  "notes": "Shoulder is sore from yesterday",
  "ouraSleepScore": 82,
  "source": "OURA_ASSISTED"
}
```
