---
description: Execute the Video Analysis 2.0 PRD end-to-end with phase gates and verification
argument-hint: [path-to-PRD] (default: docs/PRD-video-analysis-2.md)
model: claude-fable-5
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# /goal — Video Analysis 2.0 one-shot build

<role>
You are the implementing engineer for Podium Throws (Next.js 14, TypeScript, Supabase,
Vercel, Stripe). You are executing a PRD as a single continuous run with hard phase
gates. You write deep modules with simple interfaces (Ousterhout): complexity lives
inside services, not in their contracts.
</role>

<source_of_truth>
The PRD at $ARGUMENTS (default docs/PRD-video-analysis-2.md) is the spec. If the PRD
and this command conflict, the PRD wins. If the PRD is ambiguous, choose the stated
default in its Open Decisions section, record the choice in docs/decisions.md, and
keep moving. Do not invent features not in the PRD; the v1 Non-Goals list is binding.
</source_of_truth>

<workflow>
Execute these stages in order. Each stage ends with a VERIFY block. A stage may not
begin until the previous VERIFY passes. If a VERIFY fails twice after targeted fixes,
stop, write a failure report to docs/build-log.md (what failed, evidence, two candidate
fixes), and end the run rather than thrash.

## Stage 0 — Recon & plan
1. Read the full PRD. Read the existing codebase structure (routes, schema, auth
   patterns, existing MediaPipe module) before writing anything. Match existing
   conventions; do not introduce parallel patterns for things the codebase already does.
2. Produce a build plan in docs/build-plan.md: file tree of everything you will create,
   the job-state machine, the data contracts between services (pose JSON schema,
   metrics output schema, fault output schema — copy these verbatim from the PRD).
3. VERIFY: plan references every PRD feature F1–F9 with file paths; F10 appears only
   as schema obligations. Contracts are typed (zod schemas committed in packages/contracts
   or src/lib/contracts).

## Stage 1 — Schema & contracts
1. Prisma schema additions + migrations (against the Supabase Postgres instance) for calibration_sessions, analysis_jobs, pose_artifacts,
   analysis_results, golden_set_clips, with RLS mirroring existing athlete-scoped
   policies. Additive only — no changes to existing tables.
2. Zod contracts for every cross-service payload. These are the spine of the build;
   every later stage imports them.
3. VERIFY: migrations apply cleanly to a local/branch database; `tsc --noEmit` passes;
   contract round-trip tests (parse → serialize → parse) pass.

## Stage 2 — Eval harness (Phase 0 of the PRD; nothing user-facing ships before this)
1. CLI labeling tool: step through golden-set clip frames, record release frame, phase
   boundaries, and keypoint ground truth at critical instants → labels jsonb.
2. Benchmark runner: given a pose-output directory + labels, compute PCK@0.05
   (upper/lower body split), release-frame error distribution, phase-boundary IoU,
   left/right swap rate. Deterministic, no LLM judging anywhere in this harness.
3. Score the existing MediaPipe output on any available labeled clips to establish
   the baseline row of the benchmark table.
4. VERIFY: harness runs end-to-end on a synthetic fixture clip with known labels and
   reports exact expected numbers (unit-tested with fabricated pose data).

## Stage 3 — Pose service (Modal)
1. Scaffold services/pose: Modal app, GPU image, ffmpeg frame extraction, person
   detector, top-down pose, POSE_MODEL flag with vitpose-l and rtmpose-l backends,
   signed webhook back to /api/analysis/webhooks/pose.
2. Implement the full job state machine in the Next.js API routes (queued →
   processing → pose_complete → failed) with idempotent webhook handling.
3. EXTERNAL GATE: deploying to Modal requires the user's Modal account and secrets.
   Build everything runnable locally (CPU fallback path for the detector+pose on a
   short fixture clip), write services/pose/DEPLOY.md with the exact commands, and
   mark the deploy step as a TODO(user) checklist item in docs/build-log.md. Do not
   fabricate a deployment.
4. VERIFY: local CPU run on the fixture clip emits pose JSON that validates against
   the contract; webhook handler integration test passes with a mocked signature.

## Stage 4 — Temporal layer + metrics engine (shot put)
1. Implement confidence gating, left/right enforcement, gap interpolation, OneEuro
   smoothing as pure functions with unit tests per function (synthetic trajectories
   with injected swaps/gaps must be corrected/filled as specified).
2. Implement metrics/definitions/shotput.ts per PRD F5. Every metric returns
   { value, unit, confidence, frameRefs }. Release detection and phase segmentation
   are deterministic functions with fixture-based tests.
3. VERIFY: full pipeline (fixture pose JSON → smoothed → metrics) produces stable
   output across two runs (bit-identical), all unit tests pass, and the benchmark
   runner accepts the pipeline's output format.

## Stage 5 — Faults, narrative, report, overlays
1. Rules engine reading faults/rules/shotput.json (seed with the PRD's example rule
   plus placeholder thresholds clearly marked COACH_TUNABLE).
2. Claude narrative layer: structured output, drill selection restricted to drillTags
   lookup against the existing drill library, output validator that rejects any
   numeral absent from the input JSON (regex over the response; on rejection, retry
   once with the violation quoted, then fall back to template text).
3. Canvas overlay player component; server-side annotated keyframe renderer; PDF
   report assembling rubric-based phase scores, fault cards with measured values and
   evidence thumbnails. No "% energy" strings anywhere — add a lint test that greps
   the codebase for them.
4. VERIFY: end-to-end fixture run produces a PDF where every displayed number exists
   in analysis_results.metrics; component renders in a Playwright smoke test;
   numeral-validator unit tests pass including the rejection path.

## Stage 6 — Calibration wizard
1. Build F1 exactly as specced: state machine, gyro with permission-denial fallback,
   ghost ellipse, Web Speech cues, CalibrationSession persistence, homography
   computation server-side with reprojection-error check.
2. VERIFY: state machine unit tests cover all transitions; homography test against a
   synthetic image of a known circle recovers scale within 2%; wizard route renders
   in Playwright with camera/gyro mocked.

## Stage 7 — Wiring & gating
1. Stripe tier gating per PRD Section 8, upload pipeline (trim, fps validation, TUS),
   job status UI, athlete-profile attachment.
2. VERIFY: `tsc --noEmit`, lint, full test suite, and a scripted end-to-end walkthrough
   (upload fixture → results page → PDF) all pass. Write the final build report to
   docs/build-log.md: what shipped, every TODO(user) item, benchmark baseline table,
   and the exact commands to run the golden-set benchmark once real clips are labeled.
</workflow>

<constraints>
- Commit at every passing VERIFY with message "stage-N: <summary>". Never commit a
  failing stage.
- Tests are deterministic checkers, not LLM judges. Fixtures over mocks where possible.
- Prefer boring technology already in the repo. New dependencies require one sentence
  of justification in docs/decisions.md.
- Speed matters (solo founder, pre-revenue) but a fabricated VERIFY is worse than a
  reported failure: a false green costs a week of misplaced trust, a true red costs
  an hour. Report honestly.
- Anything requiring credentials you don't have (Modal deploy, Supabase prod, Stripe
  products) becomes a TODO(user) checklist item with exact commands — never simulated.
</constraints>

<output_contract>
End the run with a summary containing exactly: stages completed, stages failed (with
evidence), the TODO(user) checklist, and the single next action Tony should take.
</output_contract>
