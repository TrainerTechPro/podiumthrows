# Session Builder Validation Panel — Design Spec

**Date:** 2026-03-26
**Scope:** Add a live Bondarchuk validation panel to the session builder that checks domain rules in real-time and displays pass/warn/fail status per rule.

---

## Problem Statement

The session builder (`src/app/(dashboard)/coach/throws/builder/page.tsx`) already imports and calls `validateSession()` from `src/lib/throws/validation.ts`, which implements 7 Bondarchuk rules. However, the validation results are only surfaced as blocking errors at save time. Coaches don't get progressive feedback as they build — they construct an entire session, hit save, and only then discover sequencing violations. This is frustrating and pedagogically wrong: the validation should teach coaches the methodology in real-time.

## Goals

1. A persistent validation panel visible while building a session, showing all 7 rules with live status
2. Status indicators: `[OK]` green = passes, `[WN]` amber = warning, `[XX]` red = critical violation
3. Panel updates reactively as blocks are added, removed, or reordered
4. Each rule row is expandable to show a brief explanation and the specific blocks involved
5. Auto-fix button for fixable issues (e.g., reorder blocks to fix sequence violations)
6. Panel collapses to a compact summary badge on mobile

## Out of Scope

- Changes to the validation rules themselves (keep all 7 existing rules)
- Server-side validation (already exists at the API layer)
- Validation for the self-program generator (separate engine)
- New database fields

## Constraints

- `validateSession(blocks)` from `src/lib/throws/validation.ts` returns `ValidationResult` with `issues[]`, each having `rule`, `severity`, `title`, `message`, `autoFixable`, and `blockIndices`
- `autoFixSequence(blocks)` returns reordered blocks when sequence is fixable
- The builder page is a `"use client"` component — validation runs client-side
- Must not introduce layout shift or performance issues — validation runs on every block change

---

## Visual Design

### Validation Panel (Desktop)

Sticky panel on the right side of the session builder, below the session metadata:

```
┌─────────────────────────────────┐
│  SESSION VALIDATION         7/7 │
│─────────────────────────────────│
│  [OK] Implement Sequence        │
│  [OK] CE Priority               │
│  [WN] Strength Between Throws   │
│       └ Add a strength block    │
│         between blocks 1 and 3  │
│  [OK] Weight Differential       │
│  [XX] Minimum Throw Count       │
│       └ Shot Put needs 12+      │
│         throws (currently 8)    │
│         Blocks: #1, #3          │
│  [OK] Intensity Cap             │
│  [OK] No Mixed Light/Heavy      │
│─────────────────────────────────│
│  [Auto-Fix Sequence]            │
└─────────────────────────────────┘
```

- Card with `card` class, no `card-interactive`
- Header: `text-sm font-semibold text-muted uppercase tracking-wider`, count badge showing passing/total
- Each rule row: 44px min height, flex row with status badge + rule title
- Status badges:
  - `[OK]`: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`, 24x24 rounded
  - `[WN]`: `bg-amber-500/10 text-amber-600 dark:text-amber-400`
  - `[XX]`: `bg-red-500/10 text-red-600 dark:text-red-400`, plus `animate-danger-pulse`
- Expanded detail: `text-xs text-muted`, indented, shows `message` from `ValidationIssue`
- Block indices rendered as clickable badges that scroll to the relevant block in the builder
- Auto-fix button: `Button` variant `secondary` size `sm`, only shown when any issue has `autoFixable: true`

### Rule Titles (mapped from rule numbers)

| Rule # | Title | Check |
|--------|-------|-------|
| 1 | Implement Sequence | Heavy-to-light order |
| 2 | CE Priority | Competitive exercises first |
| 3 | Strength Separation | Strength blocks between throws |
| 4 | Weight Differential | Within 15-20% of comp weight |
| 5 | Minimum Throw Count | Event-specific minimums |
| 6 | Intensity Cap | Max 15% at 95-100% effort |
| 7 | No Mixed Weights | No light + heavy same session |

### Mobile Compact Mode

On `sm:` and below, the panel collapses to a floating badge at the bottom of the screen:

```
[✓ 5  ⚠ 1  ✕ 1]
```

- Fixed bottom-right, `z-50`, tappable to expand full panel as a bottom sheet
- Badge colors match the status indicators
- Counts for each severity level

### Empty State

When no blocks have been added yet:

```
Add blocks to see validation results
```

Muted centered text, no status rows.

---

## Data Flow

1. Coach adds/removes/reorders blocks in the session builder
2. On every block state change, `validateSession(blocks)` is called (already imported)
3. Result is stored in component state: `const [validation, setValidation] = useState<ValidationResult | null>(null)`
4. Validation panel component receives `validation` and renders rule statuses
5. Auto-fix: calls `autoFixSequence(blocks)` and updates block state with reordered result
6. All processing is client-side — no API calls for validation

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/coach/throws/builder/page.tsx` | Modify | Add validation panel integration, wire up reactive validation calls |
| `src/app/(dashboard)/coach/throws/builder/_validation-panel.tsx` | Create | New client component for the validation UI |
| `src/lib/throws/validation.ts` | No change | Already exports `validateSession`, `autoFixSequence`, and all types |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- Panel shows all 7 rules with correct status for current blocks
- Adding a block that violates a rule immediately shows `[WN]` or `[XX]`
- Removing the violating block returns the rule to `[OK]`
- Auto-fix button reorders blocks and clears the sequence violation
- Block index badges in expanded details are clickable
- Mobile compact badge shows correct severity counts
- No performance degradation — validation completes in < 5ms for typical sessions (< 10 blocks)
- No new dependencies introduced
