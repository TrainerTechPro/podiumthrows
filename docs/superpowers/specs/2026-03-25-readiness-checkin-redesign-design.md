# Readiness Check-in Redesign — Design Spec

**Date:** 2026-03-25
**Scope:** Replace the current single-form readiness check-in with a one-per-page progressive flow featuring an interactive SVG body map, wearable pre-fill, and animated score summary.

---

## Problem Statement

The current readiness check-in is a standard scrollable form with sliders and text buttons for body regions. Athletes rush through it without thinking, data quality suffers, and the body map is just a grid of text buttons — not a visual representation coaches can glance at. The experience doesn't match the premium quality bar of the rest of the app.

## Goals

1. Athletes thoughtfully complete each factor (not speed-click through)
2. Body map is a professional anatomical SVG diagram with tappable zones
3. Wearable data (Oura/WHOOP) pre-fills where available with clear comparison
4. Score reveal feels rewarding, reinforcing the daily habit
5. Coach gets richer data: specific body areas with severity levels, not just a number

## Out of Scope

- Coach wellness dashboard (separate spec)
- Changes to the readiness scoring algorithm (weights stay the same)
- No new database columns — `sorenessArea` changes from free-text to structured JSON but remains a `String?` column. Migration note: all consumers must handle both old (plain text) and new (JSON) formats.
- WHOOP/Oura API changes (pre-fill already works)

## Constraints

- Replaces `_checkin-form.tsx` entirely — one path, no dual forms
- Uses existing components: `InteractiveBodyMap` (just built), `ScrollProgressBar`, `SlideToConfirm`, `AnimatedNumber`, `NumberFlow`, `useToast`
- No new dependencies beyond `react-muscle-highlighter` (already installed)
- Must work on mobile-first (375px minimum), desktop is secondary
- Must respect `prefers-reduced-motion`
- Dark OLED theme (pure black bg, amber accent)

---

## Screen Flow

```
[Sleep] → [Soreness] → [Stress & Energy] → [Quick Checks] → [Notes] → [Summary]
   1/5        2/5            3/5                4/5             5/5       Done
```

Each screen has:
- Amber progress bar with step counter (1/5, 2/5, etc.)
- Lucide SVG icon in a tinted container (40x40, 12px radius)
- Title (Outfit, 20px, 700) + subtitle (DM Sans, 13px, muted)
- "Next" button at bottom (primary amber, full-width)
- Swipe right to go back (optional, for mobile ergonomics)

### Screen 1: Sleep (step 1/5)

**Components:**
- Sleep quality slider (1-10) with glowing thumb, color-coded value (green ≥8, amber ≥5, red <5)
- Sleep hours stepper with +/- buttons, 0.5hr increments, range 1-14 (matches Zod min:1). Note: hours 1-3 all score identically due to clamping in `(sleepHours - 4) * 2` → `Math.max(1, ...)`
- Wearable badge (if connected): "Oura Ring · Sleep score 82 · 7h 23m" — pre-fills both fields

**Pre-fill logic:**
1. If Oura connected: map `ouraSleepScore` (0-100) to quality (1-10 scale: `Math.round(score / 10)`), map `sleepDurationSec` to hours. Store raw `ouraSleepScore` in checkin data for summary comparison.
2. If WHOOP connected: map `sleepPerformance` (0-100) to quality, map `sleepDurationMs` to hours
3. WHOOP takes priority if both connected (existing behavior)
4. Athlete can override pre-filled values

**Maps to schema:** `sleepQuality`, `sleepHours`, `ouraSleepScore` (persisted for wearable comparison on summary screen — must be added to POST payload and API schema)

### Screen 2: Soreness (step 2/5)

**Components:**
- Overall soreness slider (1-10), inverted coloring (low = green = good, high = red = bad)
- `InteractiveBodyMap` component (already built) with front/back toggle
- Severity legend: Mild (yellow) / Moderate (amber) / Severe (red)
- Tag chips below body map showing selected areas with X to remove

**Interaction:**
- Tap body part → cycles: none → mild → moderate → severe → none
- Body map is the primary input; the overall soreness slider is a secondary summary
- Selected areas stored as `SoreArea[]`: `{ region, slug, side?, severity }`

**Maps to schema:** `soreness` (overall slider), `sorenessArea` (JSON string of the SoreArea array — field remains `String?` but semantics change from free-text to structured JSON)

**Severity scale:** Uses the 3-point scale from `InteractiveBodyMap.tsx` (Mild/Moderate/Severe), NOT the 5-point scale from `src/lib/forms/constants.ts` `SEVERITY_LABELS`. The body map's `SoreArea.severity` is `1 | 2 | 3`. Note: the comment on `SEVERITY_LABELS` in `constants.ts` (line 178: "for body map") is now misleading — update it to "for form-blocks body map (legacy 5-point)" to avoid confusion.

### Screen 3: Stress & Energy (step 3/5)

**Components:**
- Stress level slider (1-10) — label: "1 = overwhelmed · 10 = totally relaxed"
- Energy/mood slider (1-10) — label: "1 = exhausted · 10 = fired up"
- "Compared to yesterday" badge: shows delta from previous check-in if available

**Maps to schema:** `stressLevel`, `energyMood`

### Screen 4: Quick Checks (step 4/5)

**Components:**
- Hydration: 3 tappable cards (Poor / Adequate / Good) with Lucide icons, selected state = green border + tinted bg
- Injury status: 3 tappable cards (None / Monitoring / Active) with Lucide icons
- If "Monitoring" or "Active" selected: expandable notes text field slides in below (progressive disclosure)

**Maps to schema:** `hydration` (enum: POOR/ADEQUATE/GOOD), `injuryStatus` (enum: NONE/MONITORING/ACTIVE), `injuryNotes`

### Screen 5: Notes (step 5/5)

**Components:**
- Optional free text area: "Anything your coach should know?"
- Prominent Skip button (secondary) + Submit button (primary amber)
- Submit uses `SlideToConfirm` on mobile (`sm:hidden`), regular button on desktop (`hidden sm:flex`)

**Maps to schema:** `notes`

### Screen 6: Summary (after submission)

**Components:**
- Animated score ring (SVG circle, animated stroke-dashoffset) — color: green ≥8, amber ≥5, red <5
- `AnimatedNumber` for the score (count-up from 0 to final score)
- Score label: "Great" (≥8), "Good to Go" (≥6), "Take It Easy" (≥4), "Rest Day" (<4)
- Streak counter: "X-day streak" with check-in streak from user profile
- Breakdown grid: 4 mini cards (Sleep, Soreness, Stress, Energy) with value + mini progress bar
- Wearable comparison line: "You: 7/10 sleep · Oura: 82/100" (if connected)
- `celebration` toast if score ≥ 8 (uses existing toast system)
- "Done" button returns to wellness page

**Scoring:** Uses the existing weighted algorithm from the API route (unchanged):
- Sleep quality: 15%, Sleep hours: 10%, Soreness: 25%, Stress: 20%, Energy/mood: 20%, Hydration: 10%

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/(dashboard)/athlete/wellness/_checkin-flow.tsx` | Create | Main one-per-page flow controller (phase management, state, submission) |
| `src/app/(dashboard)/athlete/wellness/_steps/sleep-step.tsx` | Create | Screen 1: sleep quality + hours |
| `src/app/(dashboard)/athlete/wellness/_steps/soreness-step.tsx` | Create | Screen 2: soreness slider + InteractiveBodyMap |
| `src/app/(dashboard)/athlete/wellness/_steps/stress-energy-step.tsx` | Create | Screen 3: stress + energy sliders |
| `src/app/(dashboard)/athlete/wellness/_steps/quick-checks-step.tsx` | Create | Screen 4: hydration + injury |
| `src/app/(dashboard)/athlete/wellness/_steps/notes-step.tsx` | Create | Screen 5: optional notes + submit |
| `src/app/(dashboard)/athlete/wellness/_steps/summary-step.tsx` | Create | Screen 6: animated score reveal |
| `src/app/(dashboard)/athlete/wellness/_checkin-form.tsx` | Delete | Old form (replaced entirely) |
| `src/app/(dashboard)/athlete/wellness/_readiness-chart.tsx` | No change | Trend chart — remains as-is, displays after check-in |
| `src/app/(dashboard)/athlete/wellness/page.tsx` | Modify | Wire up new `_checkin-flow.tsx` instead of `_checkin-form.tsx` |
| `src/lib/readiness/parse-soreness.ts` | Create | `parseSorenessArea()` utility — handles both legacy text and new JSON formats |
| `src/lib/api-schemas.ts` | Modify | Add `ouraSleepScore: z.number().nullable().optional()` to `ReadinessCheckInSchema` |
| `src/app/api/athlete/readiness/route.ts` | Modify | Accept structured `sorenessArea` JSON; destructure `ouraSleepScore` from parsed body and include in Prisma `create` call |
| `src/app/api/readiness/route.ts` | Modify | Same `sorenessArea` + `ouraSleepScore` changes for backwards-compat legacy route |
| `src/app/(dashboard)/athlete/wellness/page.tsx` | Modify | Use `parseSorenessArea()` for display (~line 251, 533) |
| `src/app/(dashboard)/coach/athletes/[id]/page.tsx` | Modify | Use `parseSorenessArea()` for coach view (~line 893-896) |
| `src/app/api/readiness/team/route.ts` | Modify | Return parsed sorenessArea in team response |
| `src/app/api/readiness/[athleteId]/route.ts` | Modify | Return parsed sorenessArea in history response |
| `src/app/api/readiness/[athleteId]/latest/route.ts` | Modify | Return parsed sorenessArea in latest response |

## Data Flow

1. Wellness page loads → checks if already checked in today → if not, shows check-in flow
2. Flow manages local state for all 5 screens: `{ sleepQuality, sleepHours, soreness, sorenessArea, stressLevel, energyMood, hydration, injuryStatus, injuryNotes, notes }`
3. Wearable data fetched on mount (existing pattern from `_checkin-form.tsx`) → pre-fills sleep fields
4. On submit (screen 5): POST to `/api/athlete/readiness` with all fields
5. API calculates weighted `overallScore`, saves record, updates streak, awards achievements, notifies coach if score ≤ 4
6. Response returns `overallScore` → flow transitions to summary screen with animated reveal
7. "Done" button navigates back to wellness page which now shows the trend chart with today's data point

## Types

```tsx
import type { SoreArea } from "@/components/ui/InteractiveBodyMap";

interface CheckinData {
  sleepQuality: number;     // 1-10
  sleepHours: number;       // 1-14, 0.5 increments
  soreness: number;         // 1-10
  sorenessArea: SoreArea[]; // from InteractiveBodyMap
  stressLevel: number;      // 1-10
  energyMood: number;       // 1-10
  hydration: "POOR" | "ADEQUATE" | "GOOD";
  injuryStatus: "NONE" | "MONITORING" | "ACTIVE";
  injuryNotes: string;
  notes: string;
  // Wearable pass-through (persisted for summary comparison)
  ouraSleepScore: number | null;
}

interface WhoopSnapshot {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  strain: number | null;
}

interface OuraSnapshot {
  readinessScore: number | null;
  sleepScore: number | null;
  sleepDurationSec: number | null;
  activityScore: number | null;
}
```

## Step Component Interface

Each step receives:

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

The flow controller owns all state and passes both wearable sources separately (matching the current page.tsx pattern). Steps use whichever source is available — WHOOP takes priority if both are connected. Steps are pure UI — they read from `data` and call `onChange` to update.

## sorenessArea Backwards Compatibility

The `sorenessArea` column changes from free-text (e.g., `"lower_back"`, `"upper_body"`) to JSON-stringified `SoreArea[]`. Both formats must coexist.

**Parsing utility:** `src/lib/readiness/parse-soreness.ts`

```tsx
import type { SoreArea } from "@/components/ui/InteractiveBodyMap";

export function parseSorenessArea(raw: string | null): {
  isStructured: boolean;
  areas: SoreArea[];
  legacyText: string | null;
} {
  if (!raw) return { isStructured: false, areas: [], legacyText: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((a: any) => a.slug)) {
      return { isStructured: true, areas: parsed, legacyText: null };
    }
  } catch {}
  // Legacy format: plain text like "lower_back" or "upper_body"
  return { isStructured: false, areas: [], legacyText: raw };
}
```

**Consumers that must be updated to use this utility:**
- `src/app/(dashboard)/athlete/wellness/page.tsx` (~lines 251, 533) — display soreness areas
- `src/app/(dashboard)/coach/athletes/[id]/page.tsx` (~line 893-896) — coach athlete detail
- `src/app/api/readiness/team/route.ts` — team readiness response
- `src/app/api/readiness/[athleteId]/route.ts` — athlete history response
- `src/app/api/readiness/[athleteId]/latest/route.ts` — latest check-in response

For structured data: render as severity-colored tag chips matching the body map.
For legacy data: display as before (`raw.replace(/_/g, " ")`).

## Error Handling

- **409 Conflict (already checked in today):** If the POST returns 409 during submission, the flow shows a friendly message ("You already checked in today!") with a button to navigate to the wellness page to see results. This handles the race condition where the athlete starts the flow and another check-in is submitted from a different tab.
- **Network error:** Show retry button with the error message. Form state is preserved so nothing is lost.
- **Validation error:** Highlight the step containing the invalid field and navigate to it.

## Animation

- **Progress bar:** Amber gradient fill, animates width on step change (250ms ease-out)
- **Step transitions:** Outgoing step fades + slides left (150ms), incoming fades + slides in from right (200ms). Reversed for back navigation.
- **Score ring:** SVG stroke-dashoffset animates from 408 (empty) to target over 1s ease-out
- **Score number:** `AnimatedNumber` counts up from 0 to final score over 1.2s
- **Tag chip entrance:** `animate-chip-in` (existing CSS) with 75ms stagger
- All animations respect `prefers-reduced-motion` — skip to final state immediately

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes with 0 errors
- POST `/api/athlete/readiness` continues to work with the same payload shape
- Existing check-in records display correctly on the wellness trend chart
- Wearable pre-fill works for both Oura and WHOOP
- Body map severity data persists through submission and is visible in coach wellness view
- All touch targets ≥ 44px
- Works on 375px width (iPhone SE)
