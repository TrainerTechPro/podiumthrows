# Bondarchuk Engine Refinements — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** 3 targeted fixes to align the training engine with authentic Bondarchuk methodology

---

## Context

The engine overhaul planned on 2026-03-26 identified 13 fixes. 10 of 13 are already shipped. This spec covers the remaining 3 gaps.

### Files Affected

| File | Change |
|------|--------|
| `src/lib/throws/engine/adaptive-waves.ts` | Gap A: disable unload weeks for ACCUM/TRANS |
| `src/lib/throws/engine/generate-phase.ts` | Gap B: intra-phase complex rotation; Gap C: pass rotationIndex |
| `src/lib/throws/engine/select-strength.ts` | Gap C: rotation-indexed complex selection |
| `src/lib/throws/engine/types.ts` | New fields on PhaseGenConfig, SessionGenConfig, GeneratedPhase |

No schema changes. No new API routes. No new files.

---

## Gap A — Constant Volume in ACCUM/TRANS

### Problem

`computeAdaptiveWave()` applies load/unload cycling (0.70 multiplier on unload weeks) to ALL non-COMPETITION phases. This violates the Bondarchuk principle that volume is constant during ACCUMULATION and TRANSMUTATION. The base `getProgressFactor()` correctly returns 1.0, but adaptive waves override it when training history exists.

### Fix

In `computeAdaptiveWave()`, early-return `null` for ACCUMULATION and TRANSMUTATION phases. This causes `generatePhase` to fall through to `getProgressFactor()` which returns constant 1.0.

The existing early-return for COMPETITION phase (line 51) is the pattern to follow:

```typescript
// Don't apply to ACCUMULATION or TRANSMUTATION — volume is constant (Bondarchuk)
if (phase === "ACCUMULATION" || phase === "TRANSMUTATION") return null;
```

Remove the now-dead progressive overload envelope code (ACCUMULATION envelope lines 81-85, TRANSMUTATION bump lines 88-89).

REALIZATION keeps adaptive waves — this is the existing hybrid concession for NCAA coaches who expect reduced volume approaching meets.

### Effect

Programs with training history will no longer inject deload weeks during build phases. Volume stays truly constant. Coaches who want manual adjustment can modify individual sessions.

---

## Gap B — Intra-Phase Complex Rotation

### Problem

Each phase gets ONE exercise complex for its entire duration. A 6-week ACCUMULATION phase (~24 sessions) uses the same exercises throughout. Bondarchuk methodology rotates exercises every 8-12 sessions (Terrace style) or ~14 days (OG style) to prevent readaptation plateau.

### Fix

Add rotation logic inside the week generation loop in `generatePhase()`.

**Rotation intervals by adaptation group:**

| Group | Interval (weeks) | Approx. sessions (at 4/wk) |
|-------|------------------|-----------------------------|
| 1 (fast) | 2 | ~8 |
| 2 (moderate) | 3 | ~12 |
| 3 (slow) | 3 | ~12 |

New constant in `generate-phase.ts`:

```typescript
const ROTATION_INTERVAL_WEEKS: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
};
```

Inside the `for (let w = 0; w < durationWeeks; w++)` loop:

1. When `w > 0 && w % interval === 0`, call `rotateComplex()` with the current complex and program config.
2. Replace `exerciseComplex` with the returned fresh complex for all subsequent weeks.
3. Increment `rotationIndex` (starts at 0).
4. Push the previous complex into `allPreviousComplexes` array so future rotations avoid cycling back.

**Return type addition:** `GeneratedPhase` gains an optional field:

```typescript
exerciseComplexHistory?: ExerciseComplexEntry[][];
```

This stores every complex used within the phase (one per rotation cycle). Informational for coach-facing program view. Does not affect session generation.

**No schema changes.** The existing `exerciseComplex` JSON field on `TrainingPhase` stores the LAST complex used (matching current behavior for regeneration). The full history is embedded in the `generationConfig` JSON on `TrainingProgram` for regeneration purposes.

---

## Gap C — Strength Complex Follows Rotation

### Problem

`selectComplexTemplate()` picks strength complexes by phase name (ACCUM→Complex 1, TRANS→Complex 2, etc.). Bondarchuk says the strength complex should stay fixed within a rotation cycle and change only when the exercise complex rotates.

### Fix

Replace phase-based selection with sequential cycling by rotation index:

1. `generatePhase` passes `rotationIndex` (0, 1, 2...) into session generation config.
2. `selectStrength()` receives `rotationIndex` and passes it to `selectComplexTemplate()`.
3. `selectComplexTemplate()` replaces the phase switch with:

```typescript
// Sequential cycling through Bondarchuk complexes
return BONDARCHUK_COMPLEXES[rotationIndex % BONDARCHUK_COMPLEXES.length] ?? BONDARCHUK_COMPLEXES[0];
```

**Preserved overrides:**
- `strengthComplexId` parameter still takes priority (coach/config override).
- `strengthLevel === "Light" || "Very Low"` still forces Complex 2.
- `phase === "CLEANSE"` still returns null (no strength during cleanse).

**Effect on short programs:** A single-rotation phase always uses `rotationIndex = 0` → Complex 1. Two rotations → Complex 1 then Complex 2. Three rotations → Complex 1, 2, 3. This produces similar variety to the phase-based mapping but ties the timing to exercise rotation rather than phase boundaries.

---

## Type Changes

### `types.ts` additions

```typescript
// In PhaseGenConfig (input to generatePhase)
// No changes needed — rotationIndex is internal to generatePhase

// In SessionGenConfig (input to generateSession)
rotationIndex?: number; // Which rotation cycle this session belongs to (0-indexed)

// In GeneratedPhase (output of generatePhase)
exerciseComplexHistory?: ExerciseComplexEntry[][]; // All complexes used (one per rotation)
```

### `select-strength.ts` signature change

```typescript
// SelectStrengthParams — add rotationIndex
interface SelectStrengthParams {
  exerciseComplex: ExerciseComplexEntry[];
  liftingPrs: LiftingPrs;
  phase: TrainingPhase;
  strengthLevel: string;
  strengthComplexId?: string;
  rotationIndex?: number; // NEW — defaults to 0
}
```

---

## Scope Boundaries

**In scope:**
- Gap A: 1 file, ~10 lines changed
- Gap B: 1 file, ~30 lines added
- Gap C: 2 files, ~15 lines changed
- Type additions: 1 file, ~5 lines

**Out of scope:**
- AM/PM session splitting (not urgent, no current users)
- Cleanse cycle auto-suggestion at contextual boundaries (indoor→outdoor, finals)
- Coach-facing UI for rotation cycle visualization
- Engine reading `strengthNumbers` from Master Profile to auto-populate `liftingPrs`
- Engine reading `movementRestrictions` to filter exercises

**Estimated total:** ~60 lines of code changes across 4 files.

---

## Testing Strategy

No new test files needed. The engine files have no existing test suite (generation is validated via Zod schemas + audit at runtime). Changes should be verified by:

1. `tsc --noEmit` — type check passes
2. `npm run lint` — no new warnings
3. Manual verification: generate a program with a 6+ week ACCUMULATION phase and confirm:
   - Volume multipliers are constant 1.0 in ACCUM/TRANS weeks (Gap A)
   - Exercise complex changes at rotation interval boundaries (Gap B)
   - Strength complex cycles sequentially with exercise rotation (Gap C)
