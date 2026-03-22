# Live Workout Timeline View — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Redesign the athlete's live workout view from a flat list of exercises with individual log buttons into a **vertical timeline** with inline-expanding exercise cards, progress tracking, and Framer-tier animations. Mobile-first — this is used on a phone during practice, often outdoors.

**Scope:** Variant A (Timeline) only. Variants B (Focus) and C (Card Stack) + A/B testing deferred to follow-up.

---

## What Changes

### UI Layer Only
- Replace `_session-logger.tsx` with new `WorkoutTimeline.tsx`
- Replace `throw-block-card.tsx` with new `TimelineThrowNode.tsx`
- Replace `strength-block-card.tsx` with new `TimelineStrengthNode.tsx`
- **Keep:** `use-session-reducer.ts` (state management), all API routes, PR detection, rest timer logic
- **Keep:** `_complete-button.tsx`, `_completion-summary.tsx`
- **Keep:** `session-progress-header.tsx` (update to match new visual style)

### New Components
```
src/components/session/
  WorkoutTimeline.tsx          — Main timeline container, vertical progress line, block labels
  TimelineThrowNode.tsx        — Throw exercise: collapsed/expanded/completed states
  TimelineStrengthNode.tsx     — Strength exercise: collapsed/expanded/completed states
  TimelineNodeSummary.tsx      — Inline completion summary (stats + "Next" button)
  TimelineProgressDots.tsx     — Small dot progress indicator for throw counting
```

---

## Mobile Optimization (CRITICAL)

- All touch targets: **minimum 48px height**
- Distance input: **56px height**, `inputMode="decimal"`, auto-focus on expand
- Log button: **52px height**, full-width, gradient amber
- Active exercise auto-scrolls into view with `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- No hover effects — all interactions are tap/press
- High contrast text: white on near-black, amber accents
- `prefers-reduced-motion`: skip all animations, show final states
- Cards use background contrast (no 1px borders) for outdoor readability
- Progress dots: 8px minimum for visibility

---

## Timeline Structure

### Vertical Progress Line
- Absolute-positioned 2px line on the left (left: ~40px)
- Background: `rgba(255,255,255,0.03)` (full height)
- Fill: amber, `box-shadow: 0 0 10px rgba(amber, 0.2)`, height transitions with spring
- Fill tracks completion: height = (completed exercises / total) * section height

### Block Group Labels
- Between block type changes: "THROWING BLOCK 1 · 9KG", "STRENGTH BLOCK", etc.
- Amber text for throws, indigo for strength
- 10px uppercase, letter-spacing 0.2em
- Weight badge on throwing blocks

### Node States

**Collapsed (default/pending):**
- 14px border-radius card, no border, bg contrast only
- Exercise name (Outfit 600, 14px) + prescription detail (11px, muted)
- 12px dot on timeline: pending = `rgba(255,255,255,0.08)`, completed = green with glow
- Pending nodes: opacity 0.4
- Completed nodes: opacity 0.45, green shimmer sweep animation (8s cycle)
- Tap to expand (if not pending — pending nodes are read-only)

**Active/Expanded (one at a time):**
- Larger card with gradient bg `linear-gradient(165deg, rgba(amber,0.04), transparent)`
- No border — depth from `box-shadow: 0 2px 40px rgba(amber,0.06), 0 20px 60px rgba(0,0,0,0.3)`
- **Tilt shine sweep:** diagonal light reflection animation (6s cycle CSS)
- Timeline dot: amber, pulsing ring animation (2s cycle)
- Header: exercise name (Outfit 800, 20px) + implement info
- Throw counter: massive gradient text (Outfit 900, 36px) using `background-clip: text`
- Progress dots (throws only): 8px dots, amber filled, current pulsing with glow
- Distance input: 56px, no border, inset shadow, amber focus glow
- Log button: 52px, gradient amber, squishy spring on press (`cubic-bezier(.34,1.56,.64,1)`)
- Logged throws list: staggered slide-in (60ms per item), best throw gets amber glow
- Rest timer: countdown display, amber, skip button
- Drill video area (if drill video exists for this exercise): thumbnail with play button

**Completed Summary (inline, after finishing exercise):**
- Green-tinted bg, subtle confetti particle overlay (CSS radial gradients)
- Check icon + "Exercise Name — Done"
- Stats row: throws/sets completed, best distance/intensity, avg RPE
- "Next: [Exercise Name] →" button with bouncing arrow
- Tapping "Next" collapses summary → scrolls to + expands next exercise
- PR detection: celebration overlay fires before summary appears

### Throw Node Details
- Shows: exercise name, drill type, implement weight, throw count target
- Input: single distance field + "Log Throw #N" button
- After each log: throw appears in list (newest first), dot fills, counter increments
- All throws at same implement weight (domain rule)
- **"N throws" format** — not sets × reps

### Strength Node Details
- Shows: exercise name, prescription (sets × reps @ weight/%)
- Set table: SET | WEIGHT | REPS | RPE columns, one row per set
- Active set row highlighted, inputs pre-filled from prescription
- Check button per row to mark set complete
- Progress: completed sets / total sets

---

## Animations (framer-motion)

| Effect | Implementation | Duration |
|--------|---------------|----------|
| Node expand/collapse | AnimatePresence + layout | 0.35s spring |
| Timeline fill | CSS transition on height | 0.8s spring |
| Tilt shine sweep | CSS @keyframes (diagonal gradient) | 6s cycle |
| Squishy button | CSS transition with overshoot bezier | 0.15s |
| Progress dot pulse | CSS @keyframes scale + shadow | 1.8s cycle |
| Throw entry stagger | CSS @keyframes translateX | 0.35s, 60ms stagger |
| Completion summary in | framer-motion scale + opacity | 0.4s spring |
| Confetti particles | CSS radial-gradient + translateY | 3s drift |
| Shimmer on completed | CSS @keyframes gradient sweep | 8s cycle |
| Best throw glow | CSS text-shadow | Static |
| Bouncing Next arrow | CSS @keyframes translateX | 1.5s cycle |
| Auto-scroll to active | scrollIntoView smooth | Native |

All respect `prefers-reduced-motion`.

---

## Data Flow (unchanged)

```
WorkoutTimeline
  └─ useSessionReducer() (existing hook)
      ├─ state.session — session data, blocks, exercises
      ├─ state.phase — current workflow phase
      ├─ state.throws — Map of logged throws by block
      ├─ state.lifts — Map of logged lifts by block
      ├─ dispatch(LOG_THROW) → API call → PR detection
      └─ dispatch(LOG_LIFT) → API call
```

The new components consume the same reducer state and dispatch the same actions. Only the rendering changes.

---

## Files Modified
- `src/app/(dashboard)/athlete/sessions/[id]/_session-logger.tsx` — Replace contents with WorkoutTimeline
- `src/components/session/session-progress-header.tsx` — Update visual style

## Files Created
- `src/components/session/WorkoutTimeline.tsx`
- `src/components/session/TimelineThrowNode.tsx`
- `src/components/session/TimelineStrengthNode.tsx`
- `src/components/session/TimelineNodeSummary.tsx`
- `src/components/session/TimelineProgressDots.tsx`

## Files Preserved (no changes)
- `src/components/session/use-session-reducer.ts`
- `src/components/session/inline-rest-timer.ts`
- `src/components/session/completed-session-summary.tsx`
- `src/app/api/athlete/sessions/[id]/log/route.ts`
- `src/app/api/athlete/sessions/[id]/complete/route.ts`
