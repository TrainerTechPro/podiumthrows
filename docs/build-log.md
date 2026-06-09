# Video Analysis 2.0 — Build Log

One entry per stage VERIFY, with evidence. TODO(user) items accumulate at the bottom.

## Stage 0 — Recon & plan (2026-06-09) ✅

- Recon: PRD read in full; existing surfaces mapped (video-analysis routes/components,
  throwflow module, r2.ts, auth/authorize, api-schemas, idempotency, webhook patterns,
  vitest/playwright setups, middleware). No RLS exists in the repo (D2).
- `docs/build-plan.md` written: full file tree, job state machine, PRD contracts
  verbatim (§3), F1–F9 → file paths (§4), F10 as schema obligations only.
- `docs/decisions.md` written: D1–D13 (stack reconciliation, queue, naming, drills,
  keyframes, PDF, deps).
- VERIFY note: zod contract *files* are a Stage 1 deliverable per the stage list; the
  Stage 0 check is satisfied by the plan committing them to `src/lib/contracts`
  (typed, per-payload) — recorded here to keep the gate honest.

## Stage 1 — Schema & contracts (2026-06-09) ✅

- Prisma: +`AnalysisJobStatus` enum, +5 models (`CalibrationSession`, `AnalysisJob`,
  `PoseArtifact`, `AnalysisResult`, `GoldenSetClip`), `@@map`'d to PRD snake_case
  table names (D7). Only schema-file additions to existing models are back-relation
  lists (no DB change). Migration `20260609120000_video_analysis_2_tables` generated
  via schema→schema `migrate diff` because the repo's migration history has
  **pre-existing drift** vs schema.prisma (trgm indexes, dropped legacy tables,
  `Lead.email` unique, `event` column enum conversions — none mine, all excluded).
  Evidence: drift statements appeared in `--from-migrations` diff but not in the
  HEAD-schema→new-schema diff; final migration is 1 enum + 5 CREATE TABLE +
  10 indexes + 7 FKs, zero ALTER/DROP on existing tables.
- VERIFY evidence:
  - `prisma migrate deploy` on local scratch DB `podium_va2_check` (full history +
    new migration): "All migrations have been successfully applied."
  - `tsc --noEmit`: exit 0.
  - Contract round-trips: `vitest run src/lib/contracts` → 20/20 passed
    (round-trip for all 12 payload schemas + rejection paths + state machine).
- Contracts live in `src/lib/contracts/{pose,jobs,metrics,faults,narrative,calibration,report}.ts`.

## TODO(user)

(accumulates as stages complete)
