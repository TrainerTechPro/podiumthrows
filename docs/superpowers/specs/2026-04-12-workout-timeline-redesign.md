# Live Workout Timeline Redesign — Updated Spec

**Date:** 2026-04-12 (supersedes 2026-03-21 spec)
**Status:** Approved
**Approach:** Extract-then-redesign (Phase 1: split monolith, Phase 2: timeline visuals)

---

## Overview

Redesign the athlete's live workout view from a flat block-at-a-time navigator into a vertical timeline with inline-expanding exercise cards. The current implementation is a 2,070-line monolith at `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx`. This spec corrects stale file references from the March 21 spec (pre-IA-rework) and defines the extract-then-redesign approach.

**Key correction from original spec:** The live workout does NOT use `use-session-reducer.ts`. It has its own inline state management with `BlockState` maps, throw/set logging via fetch, PR detection, rest timer integration, and session completion. This state management is preserved as-is.

---

## Phase 1: Component Extraction (no visual changes)

Split the monolith into focused files. All files live in the same directory: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/`.

### New Files

| File | Source Lines | Contents |
|------|-------------|----------|
| `_types.ts` | 17-65 | `BlockData`, `WorkoutData`, `LoggedThrow`, `LoggedSet`, `BlockState` types |
| `_utils.ts` | 67-165 | `parseConfig`, `getThrowCount`, `getImplement`, `getImplementKg`, `getRestSeconds`, `CLASSIFICATION_ACCENT`, `getBlockAccent`, `getBlockLabel`, `getExerciseName`, `useElapsedTime`, `formatElapsed`, `FEELING_OPTIONS`, chamfer clip-paths |
| `_throwing-block.tsx` | 170-580 | `ThrowingBlockView` — distance input, video capture, rest timer, logged throws list, progress counter |
| `_strength-block.tsx` | 600-900 | `StrengthBlockView` — prescribed exercises display, weight/reps/RPE inputs, set logging |
| `_completion-view.tsx` | 1200-1430 | `CompletionView` — self-feeling selector, notes textarea, SlideToConfirm + desktop button, submit handler |
| `_workout-overview.tsx` | 1432-1608 | `WorkoutOverview` — all-blocks-at-a-glance with quick stats grid |

### Modified Files

| File | Change |
|------|--------|
| `_live-workout.tsx` | Reduce from ~2,070 to ~500 lines. Keeps: `LiveWorkout` container, state reconstruction from persisted logs, block navigation, `beforeunload` guard, view mode logic. Imports extracted components. |

### Interface Contracts

Each extracted component receives props from the container:

```typescript
// ThrowingBlockView
{
  block: BlockData;
  state: BlockState;
  assignmentId: string;
  event: string;
  onThrowLogged: (t: LoggedThrow) => void;
}

// StrengthBlockView
{
  block: BlockData;
  state: BlockState;
  assignmentId: string;
  onSetLogged: (s: LoggedSet) => void;
}

// CompletionView
{
  data: WorkoutData;
  blockStates: Map<string, BlockState>;
  onComplete: () => void;
}

// WorkoutOverview
{
  data: WorkoutData;
  blockStates: Map<string, BlockState>;
}
```

### Phase 1 Verification

- `tsc --noEmit` passes
- `npm run lint` passes
- Live workout behaves identically (manual test: log a throw, log a set, complete a session)
- Commit: "refactor: extract live workout monolith into focused components"

---

## Phase 2: Timeline Visual Redesign

Replace rendering in each extracted component. State management, API calls, and data flow are unchanged.

### Timeline Container (`_live-workout.tsx`)

Replace the current "one block at a time" view with a vertical timeline showing ALL blocks simultaneously.

**Layout:**
- Left side: 2px vertical progress line, absolute positioned at `left: 24px`
- Background line: `rgba(255,255,255,0.03)` (full height)
- Fill: amber, `box-shadow: 0 0 10px rgba(amber, 0.2)`, height = `(completed blocks / total) * content height`
- Fill transitions with CSS `transition: height 0.8s cubic-bezier(0.16, 1, 0.3, 1)`
- Content: padded left of the line (`pl-14`), nodes stacked vertically

**Block group labels** between type changes:
- Format: "THROWING BLOCK 1 · 9KG", "STRENGTH BLOCK"
- Amber text for throwing blocks, blue for strength blocks
- `text-[10px] uppercase tracking-[0.2em] font-semibold`

**Navigation changes:**
- Remove the overview/live toggle — the timeline IS both
- Remove prev/next block buttons — athlete taps nodes directly
- Active block auto-scrolls: `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- On session load, auto-expand the first incomplete block

### Timeline Node States (applies to both throw and strength nodes)

**Collapsed (pending):**
- 14px border-radius card, bg contrast only (no border)
- Exercise name (14px, font-semibold) + prescription (11px, muted)
- 12px dot on timeline: `rgba(255,255,255,0.08)`
- `opacity-40` — visually receded
- Tap to expand (only if the PREVIOUS block is completed or this is block 0)

**Active/Expanded (one at a time):**
- Larger card with gradient: `linear-gradient(165deg, rgba(amber,0.04), transparent)`
- Shadow: `0 2px 40px rgba(amber,0.06), 0 20px 60px rgba(0,0,0,0.3)`
- Tilt shine sweep: diagonal light reflection (6s CSS cycle)
- Timeline dot: amber, pulsing ring (2s CSS cycle)
- Full input area per block type (see below)

**Completed:**
- Green-tinted bg, `opacity-45`
- Green dot on timeline with subtle glow
- Shimmer sweep animation (8s CSS cycle)
- Summary line: "12 throws · Best: 18.42m" or "4 sets · Best: 120kg × 3"
- Tap to re-expand (read-only review of logged data)

### Throw Node — Expanded State

- Header: exercise name (20px, font-bold) + implement info
- Throw counter: large gradient text (36px) — "7 / 12"
- Progress dots: 8px dots in a row, filled = logged, current = pulsing amber
- Distance input: 56px height, `inputMode="decimal"`, auto-focus, amber focus glow
- Log button: 52px height, full-width, gradient amber, spring press (`cubic-bezier(.34,1.56,.64,1)`)
- Logged throws list: newest first, staggered slide-in (60ms per item), best throw gets amber glow
- Rest timer: inline countdown (existing `RestTimer` component), skip button
- Video capture button (existing)

**Domain rule:** Shows "N throws" — not sets × reps.

### Strength Node — Expanded State

- Header: exercise name + prescription summary ("4 × 3 @ 85%")
- Set table: SET | WEIGHT | REPS | RPE columns
- Active set row highlighted with amber left border
- Inputs pre-filled from prescription
- Check button per row to mark set complete
- Progress: "2 / 4 sets"

### Completion Summary (inline, after finishing last block)

- Green-tinted card at bottom of timeline
- Check icon + "Session Complete"
- Stats row: total throws, best distance, sets completed, elapsed time
- Self-feeling selector (existing pattern)
- Notes textarea
- SlideToConfirm on mobile, button on desktop (existing pattern)

### New Component

| File | Purpose |
|------|---------|
| `_timeline-progress-dots.tsx` | 8px dot grid showing throw progress per exercise. Props: `total`, `completed`, `activeIndex`. |

### Animations

| Effect | Implementation | Duration |
|--------|---------------|----------|
| Node expand/collapse | CSS `max-height` + opacity transition | 0.35s ease-out |
| Timeline fill | CSS `transition: height` | 0.8s spring |
| Tilt shine sweep | CSS `@keyframes` diagonal gradient | 6s cycle |
| Squishy log button | CSS `active:scale-[0.93]` + spring settle | 0.15s |
| Progress dot pulse | CSS `@keyframes` scale + shadow | 1.8s cycle |
| Throw entry stagger | CSS `@keyframes` translateX + opacity | 0.35s, 60ms stagger |
| Completion card in | CSS scale(0.95→1) + opacity(0→1) | 0.4s ease-out |
| Shimmer on completed | CSS `@keyframes` gradient sweep | 8s cycle |
| Best throw glow | CSS `text-shadow` | Static |

All respect `prefers-reduced-motion` — skip animations, show final state.

**Note:** Using CSS transitions/keyframes only, not framer-motion. The existing live workout doesn't import framer-motion, and adding it for this page would increase the bundle for a performance-critical mobile view.

---

## Mobile Optimization (CRITICAL)

- All touch targets: minimum 48px height
- Distance input: 56px height, `inputMode="decimal"`
- Log button: 52px height
- High contrast: white on near-black, amber accents — outdoor readability
- No hover effects — all interactions are tap/press
- Cards use background contrast (no 1px borders) for sunlight visibility
- Progress dots: 8px minimum

---

## Files Summary

### Phase 1 (extraction)

| Action | File |
|--------|------|
| Create | `_types.ts`, `_utils.ts`, `_throwing-block.tsx`, `_strength-block.tsx`, `_completion-view.tsx`, `_workout-overview.tsx` |
| Modify | `_live-workout.tsx` (reduce to container) |

### Phase 2 (timeline)

| Action | File |
|--------|------|
| Modify | `_live-workout.tsx` (timeline container layout) |
| Modify | `_throwing-block.tsx` (3-state node rendering) |
| Modify | `_strength-block.tsx` (3-state node rendering) |
| Modify | `_completion-view.tsx` (inline at bottom of timeline) |
| Create | `_timeline-progress-dots.tsx` |
| Delete | `_workout-overview.tsx` (absorbed into timeline view) |

### Preserved (no changes)

- `page.tsx` (server component)
- All API routes
- `RestTimer` component
- `SlideToConfirm` component
- PR detection logic (inline in throw logging)

---

## Scope Boundaries

**In scope:**
- Phase 1: Extract 6 components from monolith
- Phase 2: Vertical timeline with 3-state nodes, progress line, inline expand/collapse
- Progress dots component
- CSS animations (no new dependencies)
- Mobile-first touch targets

**Out of scope:**
- Variants B (Focus) and C (Card Stack) from original spec
- A/B testing infrastructure
- Drill video playback redesign (keep existing video capture button)
- Changes to `use-session-reducer.ts` in `src/components/session/`
- Session assignment flow changes
