# Video Analysis 2.0 — Build Plan

Source of truth: `docs/PRD-video-analysis-2.md`. Decisions: `docs/decisions.md`.
Run log: `docs/build-log.md`. Branch: `feat/video-analysis-2`.

## 1. File tree (everything this build creates)

```
docs/
  build-plan.md                        ← this file (Stage 0)
  decisions.md                         ← decision log (Stage 0)
  build-log.md                         ← VERIFY evidence + TODO(user) (all stages)

prisma/
  schema.prisma                        ← +5 models, additive (Stage 1)
  migrations/2026xxxx_video_analysis_2/ (Stage 1)

src/lib/contracts/                     ← zod contracts, the spine (Stage 1)
  pose.ts                              ← PoseOutput (COCO-17 frames), PoseWebhookPayload
  metrics.ts                           ← MetricValue, ShotPutMetrics, PhaseBoundaries
  faults.ts                            ← FaultRule, FaultResult
  narrative.ts                         ← NarrativeInput, NarrativeOutput
  calibration.ts                       ← CalibrationSessionPayload, Homography
  jobs.ts                              ← JobStatus state machine + transitions
  report.ts                            ← ReportModel (single source of PDF strings)
  index.ts
  __tests__/roundtrip.test.ts          ← parse → serialize → parse (Stage 1)

scripts/eval/                          ← Phase 0 harness (Stage 2)
  label-clips.ts                       ← CLI labeler → labels jsonb (golden_set_clips)
  run-benchmark.ts                     ← CLI wrapper around the benchmark lib
src/lib/analysis/eval/
  benchmark.ts                         ← PCK@0.05 (upper/lower), release-frame error,
                                         phase-boundary IoU, L/R swap rate
  __tests__/benchmark.test.ts          ← fabricated pose data, exact expected numbers

services/pose/                         ← Modal GPU service (Stage 3)
  app.py                               ← Modal app: detect → top-down pose → webhook
  models.py                            ← POSE_MODEL flag: vitpose-l | rtmpose-l
  frames.py                            ← ffmpeg extraction at native fps
  render.py                            ← annotated keyframe renderer (OpenCV) (Stage 5, F8)
  webhook.py                           ← HMAC-signed callback helper
  local_run.py                         ← CPU fallback (rtmlib/ONNX) on a fixture clip
  requirements.txt / DEPLOY.md
  fixtures/fixture-clip.mp4            ← short local test clip

src/app/api/analysis/                  ← job orchestration (Stage 3, 6, 7)
  calibration/route.ts                 ← POST create CalibrationSession (F1)
  calibration/[id]/route.ts            ← GET (wizard resume) + homography readback
  jobs/route.ts                        ← POST register upload → queued, enqueue (F2)
  jobs/[id]/route.ts                   ← GET status + results
  webhooks/pose/route.ts               ← POST Modal callback, signed, idempotent (F3)
  results/[id]/report.pdf/route.ts     ← GET PDF (F9)
src/app/api/eval/run/route.ts          ← POST benchmark vs golden set, admin-gated
src/app/api/cron/requeue-stale-analysis/route.ts  ← stuck-job retry (D4)

src/lib/analysis/                      ← deterministic core, all TS (Stages 4-5)
  temporal/
    confidence-gate.ts  lr-enforce.ts  interpolate.ts  one-euro.ts
    quality.ts          pipeline.ts
    __tests__/*.test.ts                ← synthetic trajectories per function
  metrics/
    engine.ts                          ← event-agnostic runner
    geometry.ts                        ← angles, COM proxy, velocities
    release.ts  phases.ts              ← deterministic detection/segmentation
    definitions/shotput.ts             ← F5 shot put metric set
    __tests__/*.test.ts
  faults/
    engine.ts                          ← rules → FaultResult[]
    rules/shotput.json                 ← versioned, COACH_TUNABLE thresholds (F6)
    __tests__/engine.test.ts
  narrative/
    claude.ts                          ← Messages API, structured output (F7)
    numeral-validator.ts               ← reject numerals absent from input JSON
    templates.ts                       ← deterministic fallback text
    __tests__/numeral-validator.test.ts
  drills.ts                            ← drillTags → existing Drill rows (D8)
  calibration/homography.ts            ← ellipse → ground-plane homography + reproj err
  calibration/__tests__/homography.test.ts
  report/
    report-model.ts                    ← ReportModel builder (rubric, fault cards)
    rubric.ts                          ← published phase-score rubric (F9)
    pdf.ts                             ← pdf-lib renderer
    __tests__/traceability.test.ts     ← every ReportModel number ∈ metrics JSON
  gating.ts                            ← Free 3/mo, Pro 50/mo, Elite unlimited (§8)
  __tests__/no-energy-strings.test.ts  ← "% energy" ban lint test (F6)

src/components/analysis/               ← UI (Stages 5-7)
  CalibrationWizard/
    CalibrationWizard.tsx              ← F1 flow shell
    wizard-machine.ts                  ← pure reducer state machine
    useDeviceOrientation.ts            ← gyro + permission-denial fallback
    GhostEllipse.tsx  SpeechCues.ts
    __tests__/wizard-machine.test.ts
  OverlayPlayer.tsx                    ← canvas skeleton/angles over video (F8)
  PhaseTimeline.tsx                    ← phase scrubber + frame-step
  UploadTrimmer.tsx                    ← trim ≤15s, fps/resolution validation (F2)
  JobStatusCard.tsx                    ← queued → … → complete states (F2/F7)
  FaultCard.tsx                        ← measured value, target range, evidence frame
  RubricDisclosure.tsx                 ← visible rubric (F9)

src/app/(dashboard)/coach/video-analysis-2/   ← routes (Stage 7; final naming may
  page.tsx  [jobId]/page.tsx  calibrate/page.tsx  new/page.tsx     reuse existing
                                                                    /video-analysis)
e2e/analysis-overlay.spec.ts           ← Playwright smoke (Stage 5)
e2e/calibration-wizard.spec.ts         ← Playwright with camera/gyro mocked (Stage 6)
```

## 2. Job state machine (analysis_jobs.status)

```
queued ──→ processing ──→ pose_complete ──→ metrics_complete ──→ complete
   │            │               │                  │
   └────────────┴───────────────┴──────────────────┴──→ failed
                                └──→ low_confidence   (terminal, refilm prompt)
```

- `queued → processing`: Modal accepts the job (webhook `job.accepted`).
- `processing → pose_complete`: signed pose webhook with artifact paths; idempotent
  (duplicate webhook = no-op; same pattern as `StripeEvent` dedupe).
- `pose_complete → metrics_complete`: temporal + metrics + faults run in the Next.js
  route (TS, D5); `metrics_complete → complete` after narrative + keyframes + report.
- Mean frame quality below threshold ⇒ `low_confidence` (F4) — never analyzed with
  false confidence.
- Any step error ⇒ `failed` with `error jsonb`; cron requeues stale `queued`/
  `processing` (D4). Transitions validated by `src/lib/contracts/jobs.ts`
  (`canTransition(from, to)`); illegal transitions rejected and logged.

## 3. Data contracts (verbatim from PRD; zod in src/lib/contracts)

**Pose output (F3):** JSON per clip — `frames[] { idx, t, bbox, keypoints[17] { x, y, conf } }`
in COCO-17 schema, plus model id/version, fps, resolution.

**Metric output (F5):** every metric `{ value, unit, confidence, frameRefs[] }`.
No metric without provenance.

**Fault output (F6):** per fault `{ ruleId, severity, measuredValue, targetRange,
evidenceFrames[], drillTags[] }`. No "% energy lost" figures anywhere — unmeasurable,
banned.

**Calibration (F1):** `{ deviceOrientation, ringEllipseScreenCoords, eventType,
timestamp }` as a CalibrationSession; server-side homography from ring ellipse +
known diameter (shot/hammer 2.135 m, discus 2.50 m); reprojection error < 2% of ring
diameter.

## 4. Feature → file map (F1–F10)

| Feature | Where |
|---|---|
| F1 Calibration wizard | `src/components/analysis/CalibrationWizard/*`, `api/analysis/calibration/*`, `src/lib/analysis/calibration/homography.ts` |
| F2 Upload pipeline | `src/components/analysis/UploadTrimmer.tsx`, `api/analysis/jobs/route.ts`, R2 multipart (D3) |
| F3 Pose service | `services/pose/*`, `api/analysis/webhooks/pose/route.ts` |
| F4 Temporal layer | `src/lib/analysis/temporal/*` |
| F5 Metrics engine | `src/lib/analysis/metrics/*`, `definitions/shotput.ts` |
| F6 Fault rules | `src/lib/analysis/faults/*`, `rules/shotput.json` |
| F7 Narrative | `src/lib/analysis/narrative/*`, `src/lib/analysis/drills.ts` |
| F8 Overlays/keyframes | `src/components/analysis/OverlayPlayer.tsx`, `services/pose/render.py` |
| F9 Report/PDF | `src/lib/analysis/report/*`, `api/analysis/results/[id]/report.pdf` |
| F10 Ghost overlay | **Schema obligations only:** `pose_artifacts.smoothed_path` stores cross-clip-alignable smoothed keypoints; `analysis_results.phase_boundaries` enables DTW time alignment; `golden_set_clips.difficulty`/`source` tags reference-quality clips. No rendering code in v1. |

## 5. New Prisma models (Stage 1, additive only)

PascalCase models `@@map`ped to PRD snake_case tables (D7): `CalibrationSession`
(`calibration_sessions`), `AnalysisJob` (`analysis_jobs`), `PoseArtifact`
(`pose_artifacts`), `AnalysisResult` (`analysis_results`), `GoldenSetClip`
(`golden_set_clips`) — fields per PRD §7.1, `AnalysisJobStatus` enum per §2 above,
version stamps (`model`, `rules_version`, `rubric_version`) on every result.

## 6. Stage order & gates

Stage 1 schema/contracts → Stage 2 eval harness (PRD Phase 0 gate) → Stage 3 pose
service + state machine → Stage 4 temporal/metrics (shot put) → Stage 5 faults/
narrative/report/overlays → Stage 6 calibration wizard → Stage 7 gating/upload/UI/
final report. Commit on every passing VERIFY (`stage-N: …`). Hammer metrics (PRD
Phase 5) are out of this run; the engine + schema stay event-parameterized so the
hammer pack is config + one definitions file.
