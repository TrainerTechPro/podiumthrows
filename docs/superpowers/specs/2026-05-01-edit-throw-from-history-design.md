# Edit Individual Throw From History — Design Spec

## Goal

Let athletes edit and delete an individual throw directly from the history view. The `<EditThrowSheet>` component is already built and shipped (commit during the implement-catalog rollout) but not mounted anywhere. The history view aggregates day → drill (multi-throw rows), so the question this spec answers is: where does the per-throw edit affordance live, and what data does the history payload need to surface it?

## Architecture

Pattern **C — fast-path + sub-sheet**:

1. The bold "best mark" number on each `HistoryDrill` row becomes a tap target. Tapping opens `<EditThrowSheet>` for the single best `ThrowLog` row in that drill — the 80% case for "I logged my PR wrong."
2. Below the row, when the drill has more than one throw, a muted secondary link `all {throwCount} throws ›` opens a new bottom Sheet listing every individual throw. Tapping a throw in that list opens `<EditThrowSheet>` for that one.

The history endpoint (`getHistory`) is extended to surface per-throw data only for `ThrowLog`-sourced drills. Other sources (`ThrowsBlockLog` / `AthleteDrillLog`) keep the current read-only behavior — the affordance suppresses when `bestThrowLogId === null`. Multi-source edit is a separate, deferred follow-up.

## Tech Stack

- TypeScript additions to `src/lib/throws/history-types.ts`
- History builder change in the underlying loader (one server file)
- Two client component changes: `_history-drill-row.tsx` (tap targets) and a new `_history-drill-throws-sheet.tsx`
- Reuse: `<EditThrowSheet>` (existing), `<Sheet>` primitive (existing), `router.refresh()` for post-edit reload

No schema changes. No new API endpoints. No new dependencies.

---

## 1. Data Model

### 1.1 New types in `src/lib/throws/history-types.ts`

```ts
/** One individual throw inside a drill — only populated for ThrowLog-sourced drills. */
export type HistoryThrow = {
  id: string;
  throwNumber: number;
  distance: number | null;
  performedAt: string; // ISO datetime
  isCompetition: boolean;
  isFoul: boolean;
  notes: string | null;
  implementId: string | null;
  implementDisplayLabel: string;
};
```

### 1.2 `HistoryDrill` extension

Two new fields, both nullable/empty for non-ThrowLog sources:

```ts
export type HistoryDrill = {
  // ... existing fields preserved ...
  /** ThrowLog id of the throw that produced bestMark. null when the drill is
   *  not ThrowLog-sourced (ThrowsBlockLog / AthleteDrillLog), or when no
   *  throw in the drill recorded a distance. */
  bestThrowLogId: string | null;
  /** Individual throws — populated only for ThrowLog-sourced drills.
   *  Empty for assigned blocks and AthleteDrillLog drills. */
  throws: HistoryThrow[];
};
```

No backwards-compatibility concerns — `HistoryDrill` is internal to the history view and consumed by exactly one client component.

---

## 2. History Builder

The current loader iterates ThrowLog rows to compute `bestMark` and `throwCount` per drill, then discards the per-throw data. Change: hold onto the rows.

For ThrowLog-sourced drills:

- Sort throws by `throwNumber` ascending.
- `throws[]` = mapped `HistoryThrow[]` from those rows.
- `bestThrowLogId` = id of the row whose `distance` equals `bestMark` (and is non-null and non-foul). Tie-breaker: earliest `performedAt`. Null when the drill has no recorded distances.

For non-ThrowLog sources:

- `throws: []`
- `bestThrowLogId: null`

Performance: drills already require iterating throws. We do the same work, just with a different shape on the way out. No additional queries.

---

## 3. Client Components

### 3.1 `_history-drill-row.tsx` — tap targets

The current row renders:

```
{label}  {throwCount} · {best}{★ if PR}
```

Becomes:

```
{label}  {throwCount} · [BUTTON: {best}★]
                              ↓ opens EditThrowSheet for bestThrowLogId
all {throws.length} throws ›   (only if drill.throws.length > 1)
                              ↓ opens drill-throws-sheet
```

**Affordance rules:**

- Best-mark button renders only when `drill.bestThrowLogId !== null`. Otherwise the mark stays as static text (current behavior).
- The "all N throws" link renders only when `drill.throws.length > 1`. This gate is independent of `bestThrowLogId` — a drill with only fouls (so `bestThrowLogId === null`) still shows the link if it has multiple throws, so the athlete can fix the foul flag.
- For single-throw drills, the best-mark button IS the only throw — no need for a list.
- Best-mark button styling: subtle hover underline on desktop (`hover:underline`), `active:scale-[0.97]` on touch, no permanent decoration. The PR star stays inside the button.
- The "all N throws" link is `text-xs text-muted hover:text-primary-500`, no chevron icon — the `›` glyph is enough.

Local state added to the row:

- `editOpen: boolean` — controls a single `<EditThrowSheet>` mount.
- `editingThrow: HistoryThrow | null` — which throw is being edited (best, or one picked from the sub-sheet).
- `listOpen: boolean` — controls the drill-throws sub-sheet.

**Wiring `EditThrowSheet`:**
The sheet expects an `EditableThrow`. Build it from a `HistoryThrow`:

```ts
const initial: EditableThrow = {
  id: t.id,
  athleteId, // passed down from history page
  implementId: t.implementId,
  implementDisplayLabel: t.implementDisplayLabel,
  distance: t.distance,
  date: t.performedAt,
  isCompetition: t.isCompetition,
  isFoul: t.isFoul,
  notes: t.notes,
};
```

`onSaved` and `onDeleted` both call `router.refresh()` and close the sheet stack.

### 3.2 `_history-drill-throws-sheet.tsx` — new

Bottom Sheet listing every throw in one drill.

```
┌─────────────────────────────────────────┐
│  {drillTypeLabel ?? "Free log"} ·      │
│  {implementLabel}                       │
├─────────────────────────────────────────┤
│  #1   Mar 14, 4:12 PM   18.42m  ★      │
│  #2   Mar 14, 4:14 PM   17.88m         │
│  #3   Mar 14, 4:17 PM    —      FOUL   │
│  ...                                    │
└─────────────────────────────────────────┘
```

Props:

```ts
interface DrillThrowsSheetProps {
  open: boolean;
  onClose: () => void;
  drillTypeLabel: string | null;
  implementLabel: string;
  bestThrowLogId: string | null;
  throws: HistoryThrow[];
  onPickThrow: (t: HistoryThrow) => void;
}
```

Each row is a `<button>` — full row tap target, `min-height: 44px`, `active:scale-[0.99]`. Distance uses `font-mono tabular-nums`. Foul = small danger-tinted badge. PR star renders for the throw whose id matches `bestThrowLogId`.

The sub-sheet stays open underneath when `EditThrowSheet` opens on top — `Sheet` already supports stacking. After save/delete, both sheets close (managed by parent state).

### 3.3 `_history-day-card.tsx` — pass-through

The day card passes `athleteId` down to each `HistoryDrillRow`. The history `page.tsx` already has the athlete profile in scope; thread it through one prop:

```tsx
<HistoryDrillRow drill={drill} athleteId={athleteId} />
```

No other changes to the day card.

---

## 4. Refresh Strategy

`<EditThrowSheet>`'s `onSaved` and `onDeleted` props fire after the PATCH/DELETE returns. The drill row handler does:

```ts
const handleSaved = () => {
  setEditingThrow(null);
  setEditOpen(false);
  setListOpen(false);
  router.refresh();
};
```

`router.refresh()` reloads the server component and re-renders day cards with fresh aggregates (new bestMark, updated `throwCount`, etc.). Costs one server roundtrip per edit. Edits are infrequent (athletes correct ~1 throw per session at most), so the latency hit is acceptable.

No optimistic update. No client-side cache invalidation logic. Keep it simple.

---

## 5. Edge Cases

| Case                                                                              | Handling                                                                                                                                   |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Drill has 0 throws with distance recorded (all fouls)                             | `bestThrowLogId: null` → best-mark stays read-only. "all N throws" link shows if `throws.length > 1` so the athlete can fix the foul flag. |
| Drill has 1 throw                                                                 | Best-mark button shown; "all N throws" link hidden (the best is the only one).                                                             |
| Drill is from an assigned ThrowsBlockLog                                          | `bestThrowLogId: null`, `throws: []`. Read-only. Multi-source edit deferred.                                                               |
| Drill is AthleteDrillLog-sourced (aggregated drill — no individual throws stored) | Same: read-only, no affordance.                                                                                                            |
| Edit changes the implement (catalog row swap)                                     | `EditThrowSheet` already PATCHes implementId; server recomputes `AthleteImplementPR`. Refresh picks up new label.                          |
| Delete the best throw                                                             | Server promotes next-best (already implemented in DELETE /api/throws). Refresh shows new bestMark.                                         |
| Delete the only throw in a drill                                                  | The drill row disappears on refresh because the underlying throws are gone.                                                                |
| Delete the only drill on a day                                                    | The day card disappears on refresh.                                                                                                        |
| Edit/delete fails (network, 4xx)                                                  | `EditThrowSheet` already surfaces the error toast and keeps the sheet open. No additional handling here.                                   |

---

## 6. Testing

Vitest unit tests in `src/app/(dashboard)/athlete/throws/history/__tests__/`:

- `_history-drill-row.test.tsx` — extends the existing test file:
  - When `bestThrowLogId` is set, best-mark renders as `<button>`.
  - When `bestThrowLogId` is null, best-mark renders as `<span>` (no button).
  - When `throwCount > 1` and `throws.length > 0`, the "all N throws" link renders.
  - When `throwCount === 1`, the "all N throws" link does not render.
  - Clicking best-mark sets the editing throw to the one matching `bestThrowLogId` and opens the edit sheet.
  - Clicking "all N throws" opens the sub-sheet.
- `_history-drill-throws-sheet.test.tsx` — new:
  - Renders one row per throw in input order.
  - Foul throws show a foul badge; non-foul throws don't.
  - The throw whose id matches `bestThrowLogId` shows a PR star.
  - Clicking a throw row calls `onPickThrow` with that throw.

History builder test:

- Add to whichever existing test covers `getHistory` (or create one):
  - ThrowLog-sourced drill: `throws[]` populated, sorted by `throwNumber`, `bestThrowLogId` set to the highest-distance non-foul throw.
  - ThrowsBlockLog-sourced drill: `throws: []`, `bestThrowLogId: null`.
  - All-foul drill: `throws[]` populated but `bestThrowLogId: null`.

No e2e tests — pre-push e2e gate is brittle and the unit tests above cover the wiring.

---

## 7. Out of Scope

- Multi-source `<EditThrowSheet>` (editing ThrowsBlockLog / AthleteDrillLog throws). Deferred — own scope; the component is currently `ThrowLog`-only.
- Bulk edit / bulk delete.
- Optimistic UI / client-side data updates.
- Coach mirror (coach viewing an athlete's history with the same edit affordance). The history view is athlete-only today; if the coach version exists, it inherits this design but is not in this PR.
- Inline expansion (option B) or full-row tap target (option A) — design space chose C.
- Undo. Delete is destructive but the next-best promotion is automatic; "undo" would require staging deletes.

---

## 8. Open Questions

None. All edge cases enumerated; scope tight enough for one implementation session.
