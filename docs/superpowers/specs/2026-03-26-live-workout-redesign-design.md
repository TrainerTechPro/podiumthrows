# Live Workout Redesign — Design Spec

**Date:** 2026-03-26
**Scope:** Restyle the athlete live workout view (`_live-workout.tsx`) with a focused, dramatic visual layer inspired by the Figma cyberpunk prototype, while preserving all existing functionality.

---

## Problem Statement

The current live workout view uses standard design-system components (cards, buttons, text inputs). During a training session, athletes need a focused, glanceable interface — not a form. The Figma prototype showed a better UX: giant throw counter as the hero element, minimal distraction, classification-colored UI, and a dramatic progression grid.

## Goals

1. Giant throw counter dominates the screen — glanceable from across the ring
2. Classification colors reinforce Bondarchuk methodology (CE=amber, SDE=orange, SPE=green, GPE=blue)
3. Chamfered progress grid shows throw-by-throw completion at a glance
4. Distance input is a tappable card, not a form — optimized for sweaty hands and quick logging
5. Minimal chrome — no unnecessary labels, cards, or navigation during active throwing

## Out of Scope

- Changes to the API endpoints (log throw, log set, complete session)
- Changes to the page.tsx server component or data fetching
- New database fields
- Strength block UI changes (keep current implementation for now)
- Coach real-time monitoring (separate feature)

## Constraints

- Single file change: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx`
- Keep `"use client"` directive
- Keep all existing types — **except** `LoggedThrow.distance` changes from `number` to `number | null` to support skip throws
- Keep all existing hooks (`useElapsedTime`, state management, `blockStates` Map)
- Keep all existing API calls and their error handling, including the `endEarly` / `action: "partial"` call on exit
- Keep `SlideToConfirm` for session completion on mobile
- Keep back button protection (`beforeunload` + `popstate`)
- Must work on 375px mobile (primary use case — athletes at the ring)
- Dark OLED theme with classification color accents
- Resumed sessions (`existingThrowLogs` from page.tsx) must initialize correctly — progress grid pre-filled, counter at N/total, not blank slate

---

## Visual Design

### Header (sticky top)

```
[← END SESSION]     [CE · 9KG]     [● LIVE  12:34]
```

- Left: ghost back link, triggers exit confirmation dialog. On confirm: fires `action: "partial"` API call (existing `endEarly()` function) then navigates away. This preserves the existing partial-save behavior.
- Center: classification badge — 4px color accent bar on left, classification code + implement weight. Color from `CLASSIFICATION_ACCENT` mapping: CE=#FFC800, SDE=#FF8800, SPE=#00FF88, GPE=#4488FF
- Right: green "LIVE" dot + elapsed time from `useElapsedTime`

### Block indicator + navigation

Below header:
```
‹  BLOCK 2 / 4  ·  SHOT PUT 9KG  ›
```
- Outfit font, 22px, 700 weight. Exercise name from block config.
- Tappable `‹` and `›` arrows replace the current dot stepper for block-to-block navigation. This preserves the ability to jump between blocks but with a simpler UI.
- Arrows hidden when at first/last block respectively.

### Hero Throw Counter

Giant centered number:
```
        THROW
    3 /8
```
- "THROW" label: 8px, uppercase, tracking-widest, muted
- Current number: 72px, Outfit, 800 weight, classification color, `NumberFlow` animated
- "/total" suffix: 22px, muted, same line
- Text shadow with classification color glow

### Progress Grid

Horizontal row of chamfered squares (one per throw in current block):
- Done (with distance): green (#00FF88) background, "✓" in black, 7px font
- Skipped (null distance): dark (#111) background, "—" in mid-gray (#555), same 20x20 size
- Current: classification color background, throw number in black
- Remaining: dark (#111) background, throw number in dark gray (#333)
- Each square: 20x20, `clip-path: polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))`
- Gap: 3px
- Centered, wraps to second row if >12 throws

### Distance Input Card

Full-width tappable card:
```
┌─────────────────────────────┐
│    TAP TO LOG THROW #3      │
└─────────────────────────────┘
```
- Chamfered corners (clip-path)
- Background: #08080a, border: classification color at 15% opacity
- On tap: expands to show numeric input (existing pattern from current component)
- After logging: counter advances, grid updates, card resets
- If distance is a PR: fire `celebration()` toast

### Best Mark Badge

Below the progress grid, right-aligned:
```
BEST: 16.42m ★
```
- Shows the best distance logged in the current block (across all throws including from `existingThrowLogs`)
- Updates in real-time as throws are logged (use `AnimatedNumber`)
- Trophy icon if it's a session PR
- Hidden if no throws with distances have been logged yet

### Logged Throws Mini-List

Below the distance input, a compact scrollable list of logged throws for the current block:
```
#1  16.42m ★   #2  15.89m   #3  —   #4  16.18m
```
- Horizontal scroll if many throws, or vertical compact list (one row per throw)
- Distance shown, "—" for skipped throws
- PR throws get a gold star/trophy indicator
- Tappable to edit a previous throw (existing edit functionality)
- Collapsed by default, expandable with "Show all throws" if >4

### Skip Button

Below the distance input:
```
[  SKIP (NO MARK)  ]
```
- Secondary style: transparent bg, classification color border at 20% opacity
- Chamfered clip-path matching the Figma
- **Type change required:** `LoggedThrow.distance` becomes `number | null` to support null-distance throws
- Logs a throw with `distance: null`, advances the counter
- In the progress grid: skipped throws show "—" instead of "✓", in a muted color

**Null-distance guard pattern:** All code that reads `LoggedThrow.distance` must filter or guard:
- `bestMark` derivation: `throws.filter(t => t.distance !== null).reduce((max, t) => Math.max(max, t.distance!), 0)`
- Display: `t.distance !== null ? t.distance.toFixed(2) + "m" : "—"`
- `CompletionScreen` stats: same filter pattern for total throws with marks vs total throws attempted
- Apply this guard in `ThrowingBlockView`, `CompletionScreen`, and the Best Mark Badge

### Rest Timer

Between blocks (when block has `restSeconds` configured):
- Renders inline (same position as the distance input area), NOT a full-screen overlay
- Uses the existing `RestTimer` component as-is (no prop changes)
- Wrapped in a container div styled with classification color border accent
- "Skip Rest" button below

### Block Transition

When a THROWING block completes (not strength/warmup/cooldown):
- Brief transition card replacing the throw counter area: "BLOCK COMPLETE" + next block name preview
- "CONTINUE" button to advance
- No auto-advance — athlete taps when ready (auto-advance conflicts with rest timer flow)

### Completion Screen

After all blocks done (existing `CompletionView` restyled):
- Giant "SESSION COMPLETE" with text shadow glow
- Animated stat cards: Total Throws, Best Mark (with `AnimatedNumber`), Duration
- RPE slider (existing)
- Feeling emoji selector (existing)
- Optional notes textarea (existing)
- SlideToConfirm on mobile / Button on desktop (existing)

---

## Warmup / Cooldown Blocks

The existing `WarmupCooldownView` (drill checklists, duration display, toggle state) is **restyled to match the new dark theme** but keeps its structural layout. Changes:
- Card background: `#08080a` with `#ffffff08` border (matching the new dark cards)
- Drill text: white on dark instead of current muted-on-card
- Checkmark toggles: classification color (or amber default) instead of primary-500
- No hero counter or progress grid — these blocks don't have throws

## Strength Blocks

The existing `StrengthBlockView` keeps its current layout (set logging, weight/reps/RPE inputs). Restyled with the same dark card treatment as warmup blocks. The hero counter area shows exercise name + "SET X / Y" instead of throw counter.

## Classification Color Mapping

```tsx
const CLASSIFICATION_ACCENT: Record<string, string> = {
  CE: "#FFC800",
  SDE: "#FF8800",
  SPE: "#00FF88",
  GPE: "#4488FF",
  // Fallbacks for non-throwing blocks
  STRENGTH: "#4488FF",  // blue — same as GPE
  WARMUP: "#FF8800",    // orange
  COOLDOWN: "#00BBFF",  // cyan
};
```

Resolution: read `classification` from block config JSON. If not present, use the `blockType` key. If neither matches, fall back to amber (#FFC800).

Used for: hero counter color, progress grid current indicator, distance input border, header badge accent, text shadows/glows.

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx` | Rewrite | Same exports, same types, same hooks — new visual layer |
| `src/app/(dashboard)/athlete/throws/live/[assignmentId]/page.tsx` | No change | Server component stays as-is |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- All existing functionality preserved: throw logging, set logging, rest timers, RPE, completion, PR detection, back protection
- Throw counter animates between numbers via `NumberFlow`
- Classification colors applied correctly per block type
- Touch targets ≥ 44px on all interactive elements
- Works on 375px width
- SlideToConfirm appears on mobile for session completion
