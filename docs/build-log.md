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

## Stage 3 — Pose service + job state machine (2026-06-09) ✅

- `services/pose/`: Modal app (`app.py`, T4 GPU, scales to zero) with shared
  `pipeline.py` (ffmpeg frames → detect → top-down pose → PoseOutput JSON),
  `models.py` (POSE_MODEL flag: rtmpose-l via rtmlib/ONNX, vitpose-l via HF
  transformers + RT-DETR), HMAC webhook signer, `local_run.py` CPU fallback,
  `DEPLOY.md` with exact commands. R2 creds never reach Modal (presigned GET/PUT).
- D14: `event` column added to analysis_jobs (migration edited pre-ship, re-verified
  from scratch on the local DB).
- Next.js: `POST/GET /api/analysis/jobs`, `GET /api/analysis/jobs/[id]`,
  `POST /api/analysis/webhooks/pose` (HMAC-signed, fail-closed, idempotent),
  `POST /api/cron/requeue-stale-analysis` (D4 retry), `transitionJob()` chokepoint
  enforcing the contract state machine, env registry + middleware CSRF-skip updated.
- Real bugs caught by running it for real:
  1. rtmlib `mode="performance"` silently loads rtmpose-**x** — POSE_MODEL flag
     would have lied. Pinned the explicit rtmpose-l checkpoint.
  2. Ambiguity guard fired on duplicate detections of the SAME person; fixed to
     require comparable size AND low spatial overlap (IoU < 0.5).
- VERIFY evidence:
  - Local CPU run (real rtmpose-l ONNX inference on `fixtures/fixture-clip.mp4`,
    a real-person clip): `VALID PoseOutput: 60 frames (60 with detections), model
    rtmpose-l@body7-256x192-20230504/rtmlib-0.0.13, 30fps 720x720` via
    `scripts/eval/validate-pose-json.ts`. Output committed as
    `services/pose/fixtures/fixture-pose.json`.
  - Webhook integration tests (real HMAC over raw body, mocked Prisma): 11/11 —
    signature reject/missing/fail-closed, QUEUED walk-up, duplicate no-ops,
    contract 400s, failure path. `tsc --noEmit` exit 0.
- **NOT deployed to Modal** (external gate — needs your account): → TODO(user).

## Stage 4 — Temporal layer + shot put metrics (2026-06-09) ✅

- Temporal (F4, pure functions in `src/lib/analysis/temporal/`): confidence gate,
  L/R identity enforcement (trajectory continuity; genuine crossings preserved),
  gap interpolation (cubic Hermite, exact on linear motion — uniform Catmull-Rom was
  wrong across multi-frame gaps, caught by test), OneEuro (state resets across gaps;
  never bridges what interpolation refused to fill), quality scoring.
  `SmoothedPoseSchema` added to contracts (F10 alignment obligation).
- Metrics (F5, `src/lib/analysis/metrics/`): geometry helpers (null over guess),
  deterministic release detection (wrist-speed peak + elbow extension),
  phase segmentation (named-constant thresholds pending golden-set tuning),
  `definitions/shotput.ts` with the full PRD F5 set — every metric
  `{value, unit, confidence, frameRefs}`; calibrated metrics null without homography.
  Engine validates its own output against the contract before returning.
- VERIFY evidence:
  - 28 new unit tests (14 temporal incl. injected swaps corrected / crossings kept /
    long gaps refused; 14 metrics with hand-computed exact values: sep 50°,
    10.00 m/s, 1.67 m, phases [0,20][21,44][45][45,60][61,119]).
  - Bit-identical: real fixture-pose.json → temporal → metrics twice, `cmp` equal.
    The static-photo fixture correctly parks LOW_CONFIDENCE (quality 0.294) with
    null release — the honest-refusal path works end-to-end.
  - Benchmark compat: engine output fed to runBenchmark → releaseError 0, IoU 1.
  - `tsc --noEmit` exit 0; 68/68 across contracts + eval + temporal + metrics + webhook.

## Stage 5 — Faults, narrative, report, overlays (2026-06-09) ✅

- Faults (F6): `faults/rules/shotput.json` — 6 rules incl. the PRD's worked example
  (`early_shoulder_opening`), all thresholds marked COACH_TUNABLE; engine never fires
  on null/low-confidence metrics; severity by deviation band; evidence = metric
  frameRefs. drillTagMap (D8) resolves tags → existing Drill rows.
- Narrative (F7): `@anthropic-ai/sdk` `messages.parse` + `zodOutputFormat`
  (claude-opus-4-8, adaptive thinking); numeral validator rejects any numeral absent
  from the input JSON (+ 120-word cap + library-only drills); one retry with
  violations quoted; deterministic template fallback that passes its own validator.
  No key / API error ⇒ fallback, never confabulation.
- Report (F9, D10): published rubric (`rubric-1.0.0`), ReportModel builder with the
  traceability gate RUNNING INSIDE the builder, pdf-lib renderer (header, phase
  scores w/ frame refs, fault cards, drills, summary, "How these numbers are
  measured" page, FREE-plan watermark). `GET /api/analysis/results/[id]/report.pdf`.
- Overlays (F8): `OverlayPlayer` canvas skeleton + angle readouts + frame-step +
  `PhaseTimeline` scrubber; `services/pose/render.py` OpenCV keyframe renderer (D9).
- Pipeline: `process.ts` continuation (temporal → quality gate → metrics → faults →
  narrative → result row → PDF) wired into the pose webhook; LOW_CONFIDENCE parks
  with a refilm message; failures recorded, never swallowed.
- Real bug caught: `getPresignedUploadUrl` returns `{uploadUrl, publicUrl}` — the
  pose-client was about to serialize the whole object into Modal's payload.
- VERIFY evidence:
  - End-to-end fixture run test: synthetic throw → metrics → faults → template
    narrative → ReportModel → real PDF bytes (`/tmp/va2-fixture-report.pdf`, %PDF
    header, 2 pages); gate re-asserted standalone AND shown to reject a tampered
    "73.4" figure. Deterministic across runs.
  - Numeral-validator: 12 tests incl. invented-numeral rejection, re-rounding
    rejection, invented-drill rejection, >120-word rejection, retry-with-violation
    and fallback paths.
  - "% energy" ban: greps all VA2 surfaces; allowlist = files stating the
    prohibition itself (documented in-test). Legacy ThrowFlow quarantined (D11).
  - Playwright smoke `analysis-overlay.spec.ts`: canvas paints (pixel check),
    frame-steps, phase scrub — 1 passed.
  - `tsc --noEmit` exit 0; 99/99 tests across contracts + analysis + webhook.

## Stage 6 — Calibration wizard (2026-06-09) ✅

- `wizard-machine.ts`: pure reducer (event_select → position → align
  MISALIGNED/CLOSE/LOCKED → captured → saving → done/error); gyro denial
  degrades to manual confirm, never blocks (F1); 1s lock-hold debounce;
  illegal transitions are no-ops. `classifyAlignment` enforces roll ±1.5° +
  per-event pitch bands.
- Component layer: `CalibrationWizard` (getUserMedia preview, ghost ellipse
  SVG, zone-colored border, Web Speech cues throttled, save → POST
  /api/analysis/calibration), `useDeviceOrientation` (iOS permission-gesture
  + denial fallback), `SpeechCues`, `GhostEllipse`.
- Server: homography from ring ellipse + known diameter (affine ground-plane
  model), reprojection gate; invalid fit stores the session WITHOUT a
  homography (angles/timing work, velocity says "requires calibration").
- **Measured product constraint:** the affine model's scale error ≈ D/(2Z)
  crosses the 2% F1 gate at ~5 m → `minTripodDistanceM = 5` in the wizard
  position config, derived from the perspective-camera test (4 m = 2.87%,
  5 m = 1.99%, 6 m = 1.45%). A 4 m setup is asserted OUTSIDE the envelope.
- VERIFY evidence:
  - State machine: 15/15 tests covering all transitions incl. denial path,
    wobble-resets-hold, retry/reset, illegal no-ops.
  - Homography: 7/7 — scale recovered within 2% vs a real perspective
    projection at 6 m/12° and 5 m/16° (non-circular: ground truth is f/Z
    from the synthetic camera, not the model's own output); degenerate
    ellipses fail the validity gate.
  - Playwright (camera + gyro mocked via addInitScript): gyro path drives
    MISALIGNED → CLOSE → LOCKED → captured; denied path reaches capture via
    manual confirm. 2/2 passed (+ overlay smoke re-run: 3/3 total).
  - `tsc --noEmit` exit 0; 121/121 unit tests.

## Stage 7 — Wiring & gating (2026-06-10) ✅

- Gating (PRD §8): `src/lib/analysis/gating.ts` — Free 3/mo + PDF watermark,
  Pro 50/mo, Elite unlimited + calibrated velocity (below Elite, clips process
  uncalibrated). Org-level monthly quota, FAILED jobs don't burn it. Enforced in
  POST /api/analysis/jobs (402) and in the pipeline. **Real bug caught by tests:**
  `PLAN_QUOTAS[plan] ?? 3` silently capped Elite (null = unlimited) at 3.
- Upload (F2/D3): `/api/analysis/uploads` — S3-multipart resumable (init /
  sign-part / complete / abort, per-part retry on the client), dev form-data
  fallback; `UploadTrimmer` validates resolution ≥720p + trim window ≤15 s; trim
  passes through job → pose service (`ffmpeg -ss/-t`). True fps read server-side.
- UI: `/coach/video-analysis-2` (list + quota readout), `/new` (UploadTrimmer),
  `/calibrate` (wizard), `/[jobId]` (AnalysisResultView: overlay player, phase
  scores, fault cards with evidence frames, coach summary, PDF link), polling
  JobStatusCard with the LOW_CONFIDENCE refilm state.
- **Flake → product bug:** the wizard smoke was ~50% flaky; reducer logging
  showed headless Chromium emitting a REAL all-null deviceorientation event that
  destroyed a held lock. Fixed in the machine (all-null sample = "no reading",
  never "misaligned") + regression test. Real devices do this when sensors
  throttle — would have hit users at the ring.
- VERIFY evidence:
  - `tsc --noEmit` exit 0; `next lint` zero warnings/errors; design lints clean.
  - Full unit suite: **1179/1179 across 122 files** (whole repo, no regressions).
  - Playwright: overlay + wizard ×2 — 3/3, and wizard specs stable across 5
    consecutive runs after the null-sample fix.
  - Scripted e2e walkthrough (`scripts/analysis-walkthrough.ts`, local DB):
    gating → upload → job QUEUED → pose artifact → POSE_COMPLETE → temporal →
    metrics (release_frame=60, exact) → faults → narrative (template path) →
    phase scores → COMPLETE → real PDF on disk. "WALKTHROUGH PASSED".

---

# FINAL BUILD REPORT (run of 2026-06-09/10)

## What shipped (all 8 stages, VERIFY-gated, committed per stage)

| Area | Where |
|---|---|
| Schema: 5 additive tables + state-machine enum | `prisma/migrations/20260609120000_video_analysis_2_tables` |
| Zod contract spine (12 payload schemas) | `src/lib/contracts/*` |
| Eval harness: PCK@0.05, swap rate, release error, phase IoU + labeling CLI + MediaPipe adapter | `src/lib/analysis/eval/*`, `scripts/eval/*` |
| Pose service: Modal app (rtmpose-l / vitpose-l flag), CPU fallback **verified with real ONNX inference**, signed idempotent webhook, requeue cron | `services/pose/*`, `api/analysis/webhooks/pose`, `api/cron/requeue-stale-analysis` |
| Temporal layer: gate → L/R → Hermite gap fill → OneEuro + quality gate | `src/lib/analysis/temporal/*` |
| Shot put metrics engine ({value, unit, confidence, frameRefs} everywhere) | `src/lib/analysis/metrics/*` |
| Fault rules engine (6 coach-tunable rules incl. PRD example) + drillTag resolver | `src/lib/analysis/faults/*`, `drills.ts` |
| Claude narrative with numeral validator + template fallback | `src/lib/analysis/narrative/*` |
| Report: published rubric, traceability-gated ReportModel, pdf-lib PDF, "% energy" ban test | `src/lib/analysis/report/*` |
| Overlay player + phase timeline + keyframe renderer | `src/components/analysis/*`, `services/pose/render.py` |
| Calibration wizard (F1 complete) + homography with measured 5 m envelope | `CalibrationWizard/*`, `calibration/homography.ts` |
| Gating, resumable upload, job UI, athlete attachment | `gating.ts`, `api/analysis/uploads`, `/coach/video-analysis-2/*` |
| F10 ghost-overlay schema obligations (no rendering) | SmoothedPose artifact + phase boundaries + golden-set tags |

## Benchmark baseline table (PRD §11)

| Model | PCK@0.05 upper | PCK@0.05 lower | Swap rate | Release ±2fr | Phase IoU |
|---|---|---|---|---|---|
| Gate | ≥ 0.90 | ≥ 0.85 | < 0.01 | ≥ 0.90 | ≥ 0.85 |
| mediapipe-blazepose (baseline) | **blocked: no labeled clips** | — | — | — | — |
| rtmpose-l | **blocked: no labeled clips** | — | — | — | — |
| vitpose-l | **blocked: needs Modal GPU** | — | — | — | — |

Harness is ready and unit-verified; rows need labeled real clips (below).

## Exact commands once clips are labeled

```bash
# 1. Label each golden-set clip (50–60 per PRD §11):
npx tsx scripts/eval/label-clips.ts <clip.mp4> --event SHOT_PUT \
  --keypoints-from <gt.json> --db

# 2. Produce pose outputs per model (local CPU for rtmpose-l):
cd services/pose && python3 local_run.py --clip <clip.mp4> --out poses/<clipId>.json

# 3. Score:
npx tsx scripts/eval/run-benchmark.ts --pose poses/ --labels labels/ \
  [--pred metrics/] --out benchmark-rtmpose-l.json
```

## Out of scope this run (honest gaps, not failures)

- Client-side WebCodecs/ffmpeg.wasm compression (PRD F2): trim ships via
  server-side window extraction; compression is a follow-up for poor-connectivity
  venues.
- Hammer metrics pack (PRD Phase 5) — engine is event-parameterized for it.
- Keyframe thumbnails in PDF fault cards: renderer exists (`render.py`); the
  orchestration call into Modal's render endpoint lands with the Modal deploy.
- Legacy ThrowFlow removal (D11) — quarantined, lint-guarded, remove at GA.

## TODO(user)

- [ ] **Deploy the pose service to Modal** — exact commands in
      `services/pose/DEPLOY.md` (modal token new → modal secret create
      pose-service → modal deploy app.py → set MODAL_POSE_URL /
      MODAL_POSE_TOKEN / POSE_WEBHOOK_SECRET in Vercel + .env.local).
- [ ] **Label golden-set clips** (50–60 per PRD §11) with
      `npx tsx scripts/eval/label-clips.ts <clip> --event SHOT_PUT --db`,
      then score the MediaPipe baseline row:
      `npx tsx scripts/eval/run-benchmark.ts --pose <mediapipe-adapted-dir> --labels <labels-dir>`
      (adapter: `src/lib/analysis/eval/mediapipe-adapter.ts`).
- [ ] **Set ANTHROPIC_API_KEY** in Vercel + `.env.local` — without it the
      narrative uses the deterministic template (measured-values prose, never
      wrong, just plain).
- [ ] **Apply the migration to production** on the next deploy (the build runs
      `prisma migrate deploy` automatically; it was verified from scratch on a
      local DB). Additive only — no existing tables touched.
- [ ] **Replace `services/pose/fixtures/fixture-clip.mp4`** with a real throws
      clip and re-run `python3 local_run.py …` + `validate-pose-json.ts` to see
      real keypoints (current fixture is a real-person photo clip: detector
      verified, but it's static).
- [ ] **Tune COACH_TUNABLE thresholds** in
      `src/lib/analysis/faults/rules/shotput.json` and the rubric bands in
      `src/lib/analysis/report/rubric.ts` against your eye on real clips.
- [ ] **Decide POSE_MODEL** (rtmpose-l vs vitpose-l) from the golden-set
      benchmark before beta — PRD Phase 1 gate.
