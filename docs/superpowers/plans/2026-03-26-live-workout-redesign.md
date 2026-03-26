# Live Workout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the athlete live workout view with a focused, dramatic visual layer — giant throw counter, classification-colored UI, chamfered progress grid — while preserving all existing block navigation, throw logging, rest timer, and completion functionality.

**Architecture:** Single file rewrite of `_live-workout.tsx`. The file has 6 internal components: utility functions, ThrowingBlockView, StrengthBlockView, WarmupCooldownView, CompletionScreen, and the main LiveWorkout shell. We rewrite each section sequentially, building from utilities up to the shell. All types, hooks, API calls, and state management are preserved — only the JSX/styling layer changes.

**Tech Stack:** React 18.3, TypeScript, Next.js 14.2, Tailwind CSS, existing components (NumberFlow, AnimatedNumber, RestTimer, SlideToConfirm, Button)

**Spec:** `docs/superpowers/specs/2026-03-26-live-workout-redesign-design.md`

---

## Task 1: Update types + add classification color mapping

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx:23-108`

- [ ] **Step 1: Read the full file to understand all sections**

Read the entire `_live-workout.tsx` (1,055 lines). Understand the 6 sections:
- Lines 23-100: Types + utility functions
- Lines 101-137: Block icons, useElapsedTime, formatElapsed
- Lines 148-358: ThrowingBlockView
- Lines 360-514: StrengthBlockView
- Lines 516-574: WarmupCooldownView
- Lines 576-750: CompletionScreen
- Lines 752-1055: Main LiveWorkout component

- [ ] **Step 2: Update LoggedThrow type**

Change `LoggedThrow.distance` from `number` to `number | null`:

```tsx
type LoggedThrow = {
  id?: string;
  throwNumber: number;
  distance: number | null;  // null for skipped throws
  isPersonalBest?: boolean;
};
```

- [ ] **Step 3: Add classification color mapping**

Replace `BLOCK_META` with `CLASSIFICATION_ACCENT` + a resolver:

```tsx
const CLASSIFICATION_ACCENT: Record<string, string> = {
  CE: "#FFC800", SDE: "#FF8800", SPE: "#00FF88", GPE: "#4488FF",
  STRENGTH: "#4488FF", WARMUP: "#FF8800", COOLDOWN: "#00BBFF",
};

function getBlockAccent(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const classification = cfg.classification as string;
  if (classification && CLASSIFICATION_ACCENT[classification]) {
    return CLASSIFICATION_ACCENT[classification];
  }
  return CLASSIFICATION_ACCENT[block.blockType] ?? "#FFC800";
}

function getBlockLabel(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const name = (cfg.exerciseName as string) || (cfg.drillName as string) || "";
  const impl = getImplement(cfg);
  const classification = (cfg.classification as string) || "";
  return [classification, impl ? `${impl}` : "", name].filter(Boolean).join(" · ");
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: Errors where `distance` is used without null guard — that's expected, we fix them in Task 2.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
git commit -m "refactor: update LoggedThrow type for skip support, add classification colors"
```

---

## Task 2: Rewrite ThrowingBlockView with dramatic visual layer

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx:148-358`

This is the biggest task — the core throwing experience.

- [ ] **Step 1: Rewrite ThrowingBlockView**

Replace lines 148-358 with the new visual layer. Keep the same props interface and all existing logic (logThrow API call, PR detection, distance validation). Change the JSX to:

**Layout (top to bottom):**

1. **Hero Throw Counter** — centered, giant number
```tsx
<div className="text-center py-6">
  <div className="text-[8px] uppercase tracking-[4px] font-semibold" style={{ color: `${accent}44` }}>THROW</div>
  <div className="flex items-baseline justify-center gap-1">
    <NumberFlow value={throwsDone + 1} className="text-[72px] font-heading font-extrabold leading-none tabular-nums" style={{ color: accent, textShadow: `0 0 50px ${accent}33` }} />
    <span className="text-[22px] font-heading" style={{ color: `${accent}44` }}>/{totalThrows}</span>
  </div>
</div>
```

2. **Progress Grid** — chamfered squares
```tsx
<div className="flex flex-wrap justify-center gap-[3px] px-6">
  {Array.from({ length: totalThrows }).map((_, i) => {
    const isCompleted = i < throwsDone;
    const isCurrent = i === throwsDone;
    const isSkipped = isCompleted && state.throws[i]?.distance === null;
    return (
      <div key={i} className="w-5 h-5 flex items-center justify-center text-[7px] font-bold"
        style={{
          background: isSkipped ? "#111" : isCompleted ? "#00FF88" : isCurrent ? accent : "#111",
          border: `1px solid ${isSkipped ? "#1a1a1a" : isCompleted ? "#00FF88" : isCurrent ? accent : "#1a1a1a"}`,
          clipPath: "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))",
          color: isSkipped ? "#555" : isCompleted || isCurrent ? "#000" : "#333",
        }}>
        {isSkipped ? "—" : isCompleted ? "✓" : i + 1}
      </div>
    );
  })}
</div>
```

3. **Best Mark Badge** — right-aligned below grid
```tsx
{bestMark > 0 && (
  <div className="flex justify-end px-6 mt-2">
    <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
      BEST: <AnimatedNumber value={bestMark} decimals={2} />m
    </span>
  </div>
)}
```

Where `bestMark`:
```tsx
const bestMark = useMemo(() => {
  const withDistance = state.throws.filter(t => t.distance !== null);
  return withDistance.length > 0 ? Math.max(...withDistance.map(t => t.distance!)) : 0;
}, [state.throws]);
```

4. **Distance Input Card** — tappable, chamfered
```tsx
<div onClick={() => setShowInput(true)} className="mx-5 mt-5 p-4 text-center cursor-pointer font-semibold text-sm tracking-wider"
  style={{
    background: "#08080a",
    border: `1px solid ${accent}25`,
    clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
    color: accent,
  }}>
  TAP TO LOG THROW #{throwsDone + 1}
</div>
```

When tapped, expand to show the numeric input (reuse existing `logThrow` function). After logging, collapse back.

5. **Logged Throws Mini-List** — compact, below input
```tsx
{state.throws.length > 0 && (
  <div className="px-5 mt-3 flex flex-wrap gap-2">
    {state.throws.map((t, i) => (
      <span key={i} className="text-xs tabular-nums" style={{ color: t.distance !== null ? "#888" : "#444" }}>
        #{t.throwNumber} {t.distance !== null ? `${t.distance.toFixed(2)}m` : "—"}
        {t.isPersonalBest && <span style={{ color: "#FFC800" }}> ★</span>}
      </span>
    ))}
  </div>
)}
```

6. **Skip Button** — chamfered secondary
```tsx
<div className="px-5 mt-3">
  <button onClick={handleSkip} className="w-full py-3 text-xs font-bold uppercase tracking-widest"
    style={{
      background: "transparent",
      border: `1px solid ${accent}33`,
      color: `${accent}88`,
      clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
    }}>
    SKIP (NO MARK)
  </button>
</div>
```

Where `handleSkip`:
```tsx
const handleSkip = useCallback(() => {
  onThrowLogged({ throwNumber: throwsDone + 1, distance: null });
}, [throwsDone, onThrowLogged]);
```

- [ ] **Step 2: Add null guards to all distance consumers**

Search the file for `t.distance` and `.distance` — add null guards everywhere:
- `Math.max(...)` calls: filter to `t.distance !== null` first
- `.toFixed()` calls: conditional `t.distance !== null ? t.distance.toFixed(2) : "—"`
- Completion stats: filter throws with distance for "best mark", count all throws for "total"

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
git commit -m "feat: redesign ThrowingBlockView with hero counter, progress grid, and skip support"
```

---

## Task 3: Restyle StrengthBlockView + WarmupCooldownView

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx:360-574`

- [ ] **Step 1: Restyle StrengthBlockView**

Keep all existing logic (set logging, weight/reps/RPE inputs). Change the visual treatment:
- Card backgrounds: `bg-[#08080a]` with `border-[#ffffff08]`
- Set counter as mini hero: "SET X / Y" in exercise name area, styled like a smaller version of the throw counter
- Inputs: dark background, classification color accent on focus
- Keep the existing RPE input pattern

- [ ] **Step 2: Restyle WarmupCooldownView**

Keep drill checklist logic. Change visual treatment:
- Card backgrounds match new dark theme
- Checkbox toggles use classification color instead of primary-500
- Duration display styled consistently

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
git commit -m "feat: restyle Strength and Warmup/Cooldown blocks for dark dramatic theme"
```

---

## Task 4: Restyle CompletionScreen

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx:576-750`

- [ ] **Step 1: Restyle CompletionScreen**

Keep all existing logic (RPE slider, feeling selector, notes, submit API call, SlideToConfirm). Change visual treatment:

- "SESSION COMPLETE" as hero text: large, Outfit font, classification color, text-shadow glow
- Stat cards restyled: dark bg (#08080a), chamfered corners, classification-colored values
  - Total Throws (count all), Marked Throws (filter distance !== null), Best Mark (`AnimatedNumber`), Duration (`formatElapsed`)
- RPE slider: keep existing, dark-theme compatible
- Feeling selector: keep emoji buttons, dark card styling
- Notes textarea: dark bg, subtle border
- SlideToConfirm + Button: keep existing mobile/desktop pattern

- [ ] **Step 2: Add null guard to completion stats**

The best mark calculation in CompletionScreen:
```tsx
const allThrows = [...blockStates.values()].flatMap(s => s.throws);
const markedThrows = allThrows.filter(t => t.distance !== null);
const bestMark = markedThrows.length > 0 ? Math.max(...markedThrows.map(t => t.distance!)) : 0;
```

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
git commit -m "feat: restyle CompletionScreen with dramatic hero text and chamfered stat cards"
```

---

## Task 5: Rewrite main LiveWorkout shell with new header + block navigation

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx:752-1055`

- [ ] **Step 1: Rewrite the main shell**

Replace the current header (block dots, title) and shell layout with:

**Header (sticky):**
```tsx
<div className="sticky top-0 z-10 px-5 pt-14 pb-3" style={{ background: "#0a0a0c" }}>
  <div className="flex items-center justify-between">
    {/* End Session */}
    <button onClick={handleEndSession} className="text-xs text-white/50 flex items-center gap-1">
      <ChevronLeft size={14} strokeWidth={1.75} /> END SESSION
    </button>
    {/* Classification badge */}
    <div className="flex items-center gap-2">
      <div className="w-1 h-5" style={{ background: accent }} />
      <span className="text-xs font-bold tracking-widest" style={{ color: accent }}>
        {getBlockLabel(activeBlock)}
      </span>
    </div>
    {/* Live indicator + timer */}
    <div className="flex items-center gap-2">
      <span className="text-[9px] tracking-widest font-semibold text-emerald-500/60">● LIVE</span>
      <span className="text-xs tabular-nums text-white/50 font-mono">{formatElapsed(elapsed)}</span>
    </div>
  </div>
</div>
```

**Block indicator with navigation arrows:**
```tsx
<div className="flex items-center justify-center gap-4 py-2">
  {activeBlockIdx > 0 && (
    <button onClick={() => goToBlock(activeBlockIdx - 1)} className="text-white/30 text-lg">‹</button>
  )}
  <div className="text-center">
    <span className="text-xs text-white/30 tracking-widest font-semibold">
      BLOCK {activeBlockIdx + 1} / {totalBlocks}
    </span>
    <h1 className="text-[22px] font-heading font-bold tracking-wider" style={{ color: accent }}>
      {getExerciseName(activeBlock)}
    </h1>
  </div>
  {activeBlockIdx < totalBlocks - 1 && (
    <button onClick={() => goToBlock(activeBlockIdx + 1)} className="text-white/30 text-lg">›</button>
  )}
</div>
```

**Block transition card** (when a THROWING block completes):
```tsx
{showBlockTransition && (
  <div className="flex-1 flex flex-col items-center justify-center px-7">
    <div className="text-[8px] tracking-widest font-semibold" style={{ color: "#00FF8888" }}>BLOCK COMPLETE</div>
    <div className="text-lg font-bold tracking-wider mt-2" style={{ color: accent }}>
      Next: {getExerciseName(data.blocks[activeBlockIdx + 1])}
    </div>
    <button onClick={goNext} className="mt-6 w-full py-4 text-sm font-bold tracking-widest"
      style={{ background: accent, color: "#000", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
      CONTINUE
    </button>
  </div>
)}
```

**End Session handler** (preserving `endEarly` / partial-save):
```tsx
const handleEndSession = useCallback(() => {
  if (confirm("End session early? Your logged throws are saved.")) {
    endEarly();  // existing function that POSTs action: "partial"
  }
}, [endEarly]);
```

**Rest timer** between blocks — keep existing inline rendering, wrap in a styled container:
```tsx
{showRest && (
  <div className="flex-1 flex flex-col items-center justify-center px-7" style={{ borderTop: `2px solid ${accent}15` }}>
    <RestTimer seconds={restSeconds} onComplete={() => setShowRest(false)} />
    <button onClick={() => setShowRest(false)} className="mt-4 text-xs tracking-widest font-semibold" style={{ color: `${accent}88` }}>
      SKIP REST
    </button>
  </div>
)}
```

**Scanline overlay** (subtle, from Figma):
```tsx
<div className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay opacity-[0.03]"
  style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(255,200,0,0.1) 1px,rgba(255,200,0,0.1) 2px)" }} />
```

- [ ] **Step 2: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 3: Verify no broken exports**

The page.tsx imports `LiveWorkout` as a named export. Verify it still exports correctly:
```bash
grep "export function LiveWorkout" "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
```
Expected: 1 match

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"
git commit -m "feat: rewrite LiveWorkout shell with dramatic header, block nav arrows, and transition cards"
```

---

## Task 6: Final verification + push

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: 0 errors (pre-existing auth test warnings OK)

- [ ] **Step 3: Verify export contract**

Run: `grep "export function LiveWorkout\|export type.*WorkoutData" "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx"`
Expected: `LiveWorkout` function export (WorkoutData is used internally and passed from page.tsx)

- [ ] **Step 4: Verify page.tsx still compiles with the rewritten component**

Run: `npx tsc --noEmit --listFiles 2>&1 | grep "live.*page"`
Expected: page.tsx in the output, no errors

- [ ] **Step 5: Commit and push**

```bash
git push origin main
```
