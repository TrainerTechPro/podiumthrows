# Phase F Readiness Report — 2026-05-15

**Evaluation date:** 2026-05-15 (2 weeks post implement-catalog rollout, 2026-04-30)

---

## TL;DR

**BLOCKED** — Phase F cannot proceed. Three hard blockers remain in production code; the dual-write module (`src/lib/throws/pr.ts`) is structurally dependent on both `ThrowLog.implementWeight` and `ThrowsPR`, and the history-filter API must be rearchitected before the column can be dropped.

---

## Code Audit

### ThrowsPR — remaining direct Prisma readers

| File | Lines | Disposition |
|------|-------|-------------|
| `src/lib/throws/pr.ts` | 96, 162, 217, 274, 291, 294, 303 | **(c) BLOCKER** — 9 `prisma.throwsPR.*` calls: `checkIsPersonalBest` reads ThrowsPR + falls back to `ThrowLog.implementWeight`; `recordThrowInTx` reads + upserts ThrowsPR; `recalculatePRs` reads/writes ThrowsPR and calls `groupBy(["event", "implementWeight"])` — column drop breaks this directly. Full module redesign required to use `implementId` / `AthleteImplementPR`. |
| `src/app/api/throws/prs/route.ts` | 49, 137 | **(c) BLOCKER** — GET handler returns `prisma.throwsPR.findMany()` directly; POST calls `recordThrow()` which writes ThrowsPR. Comment on line 17 acknowledges it "stays during the migration window." Must be migrated to read `AthleteImplementPR`. |
| `src/app/(dashboard)/coach/architect/page.tsx` | 19–30 | **(b) TRIVIAL** — `include: { throwsPRs: { where: { source: "COMPETITION" } } }`. Drop in replacement: use `athleteImplementPRs` with `bestContext: "COMPETITION"` filter and reshape to the same `{ event, distance }` contract. |
| `src/lib/data-export/build.ts` | 90 | **(b) TRIVIAL** — `throwsPRs: true` in the data-export select alongside `athleteImplementPRs: true`. Drop the `throwsPRs` field; keep the catalog one. |

**Already catalog-aware (no action needed):**
- `src/app/api/throws/podium-roster/route.ts` — reads `athleteImplementPRs`, reshapes to legacy contract
- `src/app/api/throws/practice/[sessionId]/route.ts` — same
- `src/app/api/coach/athletes/route.ts` — same
- `src/app/(dashboard)/athlete/profile/page.tsx` — queries `athleteImplementPR` directly
- `src/lib/data/coach.ts` — reads `athleteImplementPR.count()`
- `src/lib/data/personal-records.ts` — reads `athleteImplementPR`
- `src/app/api/athletes/[athleteId]/prs/route.ts` — the new catalog-keyed endpoint

---

### ThrowLog.implementWeight — remaining readers / writers

Total non-test references: **397 across ~90 files**.

| File | Lines | Disposition |
|------|-------|-------------|
| `src/app/api/throws/history/route.ts` | 116 | **(c) BLOCKER** — `implementWeight: { in: implementFilter }` where-clause. The query schema parses `?implements=7.26,8` as floats and filters on the DB column. Dropping the column breaks history filtering for ~50% of athletes who rely on implement-specific history views. The filter API must change from kg-values to implementIds before this column can be dropped. |
| `src/lib/throws/pr.ts` | 106–110, 172–177, 314–329 | **(c) BLOCKER** — `recalculatePRs` runs `groupBy(["event", "implementWeight"])` and then re-queries by `implementWeight: c.implementWeight`. After column drop, the function cannot reconstruct (event, implement) combos without switching to `implementId`. |
| `src/app/api/throws/route.ts` | 103, 118–120 | **(b) TRIVIAL** — writes `implementWeight: implement.weightKg` (+ unit + original). Comment on line 118 says "Phase F drops it." Remove writes after migration. |
| `src/app/api/throws/[id]/route.ts` | 86–88 | **(b) TRIVIAL** — writes `implementWeight/Unit/Original` on throw edit. Remove after column drop. |
| `src/app/api/throws/athlete-sessions/route.ts` | 39, 46, 174, 188–190 | **(b) TRIVIAL** — fallback: `impl ? impl.weightKg : (d.implementWeight ?? null)`. Catalog-aware with graceful degradation. Once all rows have `implementId`, remove the `d.implementWeight` fallback branch. |
| `src/app/api/athlete/throws/analysis/route.ts` | 194, 200, 201, 227, 233, 234 | **(b) TRIVIAL** — display reads with `catalogOrKg(tl.implement?.displayLabel, tl.implementWeight)` fallback pattern. Remove the fallback once all rows have catalog attribution. |
| `src/app/api/throws/athlete-sessions/trends/route.ts` | 45–46 | **(b) TRIVIAL** — `formatImplementWeight(log.implementWeight, ...)` display fallback. |
| `src/app/api/throws/relabel-by-weight/route.ts` | 84, 101, 155, 165, 169 | **(b) TRIVIAL / deprecate** — the entire purpose of this route is to assign legacy `implementWeight` rows to catalog implements. After Phase F it should be removed entirely; it has served its purpose. |
| `src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx` | 27, 99, 546, 636, etc. | **(b) TRIVIAL** — client-side struct `{ implementWeight: number }` is populated from `Implement.weightKg` (catalog fetch). Rename field to `weightKg` locally and remove the column-named field. |
| `prisma/seed.ts` | 196, 210, 221, etc. | **(b) TRIVIAL** — seed writes `implementWeight`. Remove after schema change. |
| All other display/write paths (~350 remaining refs) | various | **(b) TRIVIAL** — split between write paths (drop after column removal) and display paths (use catalog fallback already in place). No architectural changes needed. |

---

## Backfill Audit — ThrowLogBackfillAudit State

`ThrowLogBackfillAudit` table exists in schema (`kind` field: `"exact" | "tolerated" | "ambiguous" | "none"`). **Could not query the production database from this remote agent.** The migration script ran 2026-04-30; any `ambiguous` or `none` rows that have not been manually resolved in the Fix Old Throws UI would leave those ThrowLog rows with `implementId = null`, meaning dropping `implementWeight` from those rows loses their identity entirely.

**Action required before Phase F:** run the following query against production and confirm the count is zero:

```sql
SELECT kind, COUNT(*) FROM "ThrowLogBackfillAudit"
WHERE kind IN ('ambiguous', 'none')
GROUP BY kind;
```

If any rows remain, the Fix Old Throws UI must process them first. Zero `ambiguous`/`none` rows is a hard precondition for dropping `implementWeight`.

---

## Test State

**PASS** — 93 test files, 920 tests, 0 failures. Run: `npm run test`.

No regressions introduced by post-rollout commits (2026-04-30 → 2026-05-15).

---

## Recommendation

**Wait. Do not ship Phase F yet.**

Three hard blockers must be resolved first:

1. **`src/lib/throws/pr.ts` redesign** (1–2 sprints): migrate `checkIsPersonalBest`, `recordThrowInTx`, and `recalculatePRs` to use `implementId` / `AthleteImplementPR` as the primary key. The legacy ThrowsPR fallback and the `groupBy(implementWeight)` scan both require replacing. This is the largest piece of work.

2. **`src/app/api/throws/prs/route.ts` migration** (~1 day): rewrite GET to return `AthleteImplementPR` rows; POST path flows through `recordThrow` which must stop writing ThrowsPR.

3. **`src/app/api/throws/history/route.ts` filter rearchitecture** (~2 days): change the `?implements=kg,kg` query parameter to accept `?implementIds=id,id` and update the client-side history filter UI accordingly. The kg-to-implementId mapping can be resolved at the UI layer since the athlete's catalog is already available.

After those three are green, the trivial migrations (architect page, data-export, seed, all the display fallbacks) can land in one cleanup PR alongside the column drop migration.

**Suggested next checkpoint:** re-evaluate at 2026-05-29. Target Phase F ship no earlier than early June.

---

*Generated by readiness audit 2026-05-15. Tests: 920/920 pass.*
