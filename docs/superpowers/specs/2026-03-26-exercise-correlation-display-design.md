# Exercise Correlation Display — Design Spec

**Date:** 2026-03-26
**Scope:** Surface Bondarchuk transfer coefficients (r values) in the exercise library and session builder so coaches can see at a glance which exercises correlate most strongly with competitive performance.

---

## Problem Statement

The Exercise model already stores a `correlationData` JSON field and the codebase has a full 750-entry correlation table in `src/lib/throws/correlations.ts`. However, none of this data is visible in the exercise library UI. Coaches browsing or building sessions have no way to see which exercises transfer best to competitive throws — the core value proposition of Bondarchuk methodology.

## Goals

1. Each exercise row in the library shows its correlation coefficient (r value) prominently on the right side, color-coded by strength: green >= 0.75, amber >= 0.60, blue < 0.60
2. Classification badge (CE/SDE/SPE/GPE) rendered with a color dot matching the classification system already in `_exercises-table.tsx`
3. Exercise detail (modal or expanded row) shows which competitive exercise and distance band the correlation applies to
4. In the session builder, throwing block exercise suggestions are sorted by correlation, with the r value visible next to each exercise name
5. Empty/null correlation gracefully shows "No data" instead of 0

## Out of Scope

- Editing correlation values from the UI (these come from Bondarchuk Volume IV data)
- Per-athlete personalized correlations (handled by `engine/personal-correlations.ts`, separate feature)
- Changes to the correlation data source (`src/lib/throws/correlations.ts`)
- New database migrations — `correlationData Json?` already exists on Exercise model

## Constraints

- The correlation lookup requires event, gender, and distance band context. The exercise library page does not currently have athlete context, so it must either: (a) show the raw `correlationData` JSON stored on the Exercise, or (b) let the coach filter by event/gender/band to see contextual correlations from the master table.
- Approach (b) is preferred — add event/gender/band filter controls at the top of the exercise library, then call `getRankedExercises()` to rank and annotate exercises.
- `getRankedExercises(event, gender, band)` from `src/lib/throws/correlations.ts` returns `{ exercise, type, correlation, absCorrelation }[]`.

---

## Visual Design

### Exercise Library — Correlation Column

Add a new column to the `DataTable` in `_exercises-table.tsx`, positioned after the Weight column:

```
| Exercise           | Cat  | Event     | Equip   | Weight | Correlation |
|--------------------|------|-----------|---------|--------|-------------|
| 8kg Shot           | SDE  | Shot Put  | Impl.   | 8.00kg |    ●  0.845 |
| Power Clean        | SPE  | Shot Put  | Barbell | —      |    ●  0.612 |
| Standing Throws    | CE   | Shot Put  | Impl.   | 7.26kg |    ●  0.923 |
```

- Color dot: 8px circle, filled with correlation tier color
- Value: `tabular-nums`, 3 decimal places, `font-semibold`
- Color tiers: `text-emerald-500` (r >= 0.75), `text-amber-500` (r >= 0.60), `text-blue-500` (r < 0.60)
- No data: muted "—"
- `hideOnMobile: true` for this column

### Correlation Context Filter Bar

Above the category tabs, a filter row:

```
[Shot Put ▾]  [Male ▾]  [16-17m ▾]     Showing correlations for: SP Male 16-17m
```

- Three `<select>` dropdowns: Event, Gender, Distance Band
- Defaults: first event from coach's athletes, Male, middle band
- When filters change, re-rank exercises by correlation from the master table
- Muted context label on the right confirming active filter

### Exercise Modal — Correlation Detail

In the existing `ExerciseModal`, add a section below the description:

```
─── Transfer Coefficient ───
Event: Shot Put (Male)
Band: 16-17m
Type: SD (Special Developmental)
Correlation: 0.845
[████████████████░░░░] 84.5%
```

- `ProgressBar` with value mapped to 0-100
- Color follows the same green/amber/blue tier system
- Only shown when correlation data is available for the active filter context

### Session Builder — Exercise Suggestions

In the throwing block configuration within `src/app/(dashboard)/coach/throws/builder/page.tsx`, the exercise dropdown already calls `getRankedExercises()`. Enhance the dropdown items:

```
8kg Shot           0.845  ●
6kg Shot Place     0.786  ●
Power Clean        0.612  ●
```

- r value right-aligned in the option, color dot matching tier
- Already sorted by correlation (existing behavior) — just add visual indicator

---

## Data Flow

1. Coach opens exercise library page
2. Server component fetches exercises via `getExerciseLibrary(coach.id)` (existing)
3. Client receives exercises and renders `ExercisesTable`
4. Client maintains event/gender/band filter state (defaults from coach's most common athlete event)
5. On filter change, client calls a lookup function that matches exercise names against the master correlation table (`getRankedExercises`) and annotates each row
6. Correlation values are merged into the display — no API call needed, the correlation table is a static import

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/coach/exercises/_exercises-table.tsx` | Modify | Add correlation column, filter bar, color-coded r values |
| `src/app/(dashboard)/coach/exercises/_exercise-modal.tsx` | Modify | Add correlation detail section in modal |
| `src/app/(dashboard)/coach/exercises/page.tsx` | Minor | Pass additional props if needed for default filter context |
| `src/app/(dashboard)/coach/throws/builder/page.tsx` | Modify | Add r value display to exercise suggestion dropdown |
| `src/lib/throws/correlations.ts` | No change | Already has `getRankedExercises()` and full data |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- Correlation column shows color-coded r values for exercises that match the active filter
- Exercises with no correlation data show "—" gracefully
- Filter dropdowns correctly narrow the correlation context
- Session builder exercise suggestions show r values
- Color tiers are correct: green >= 0.75, amber >= 0.60, blue < 0.60
- Column is hidden on mobile (`hideOnMobile: true`)
- No new dependencies introduced
