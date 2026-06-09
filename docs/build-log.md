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

## Stage 2 — Eval harness (2026-06-09) ✅

- `src/lib/analysis/eval/benchmark.ts`: PCK@0.05 (upper/lower split, norm = max GT
  keypoint-bbox side), L/R swap rate (crossed-assignment test per pair), release-frame
  error distribution (fps-scaled ±2@60fps tolerance), phase-boundary IoU (inclusive
  ranges, missing predicted phase = 0). Fully deterministic, no LLM.
- `scripts/eval/label-clips.ts`: interactive CLI → `<clip>.labels.json`
  (GoldenLabelsSchema) + optional `--db` upsert into golden_set_clips. Keypoint GT
  merges from an external annotator export via `--keypoints-from` (CLI keypoint entry
  by hand is impractical; documented in the tool header).
- `scripts/eval/run-benchmark.ts`: pose dir + labels dir (+ optional MetricsOutput
  predictions dir) → gate table + report JSON.
- `src/lib/analysis/eval/mediapipe-adapter.ts`: legacy 33-landmark MediaPipe
  annotations → PoseOutput, so the old pipeline can be scored as the baseline row.
- Found+fixed during VERIFY: zod v4 `z.record(enumKeys, …)` is exhaustive — partial
  keypoint GT needs `z.partialRecord` (real bug, caught by the live CLI run).
- **Baseline row blocked on data:** zero labeled golden-set clips exist. → TODO(user).
- VERIFY evidence: 9/9 benchmark unit tests with hand-computed exact numbers
  (PCK upper 1.0 / lower 0.5, swap 0.5, IoU 1/3 etc.); live CLI run on synthetic
  fixture asserted equal to expectations by an independent script; tsc exit 0;
  29/29 tests across contracts + eval.

## TODO(user)

(accumulates as stages complete)
