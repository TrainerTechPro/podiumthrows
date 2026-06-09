# Podium Throws — Video Analysis 2.0 PRD & Technical Spec

**Version:** 1.0 | **Date:** June 9, 2026 | **Owner:** Tony Sommers
**Status:** Approved for build | **Codename:** Measurement Layer

---

## 1. Problem Statement

The current MediaPipe client-side pose pipeline produces unreliable keypoints on rotational throws (jitter, left/right swaps, lost limbs during turns) and has no temporal stability layer. Separately, the ThrowFlow prototype (Gemini-based) produces fluent coaching reports whose numbers are confabulated, not measured: velocity, distance, and "energy leak" percentages are LLM guesses dressed as physics.

The rebuild inverts the architecture: **every number shown to a user must be traceable to a measured quantity.** The LLM writes prose about measurements; it never invents them.

## 2. Goals

1. Keypoint reliability on throws footage that passes a fixed eval benchmark (Section 11) before any user-facing feature ships.
2. Real measurements: joint angles, hip-shoulder separation, phase timing, and (when calibrated) release velocity in m/s, derived from pose data and ring-diameter calibration.
3. Evidence-based fault detection: every fault card shows the measured value, the target range, and the frame it occurred on.
4. Annotated visual output: keyframes with drawn angles, joint markers, and fault callouts, in-app and in the PDF report.
5. Guided capture: a camera calibration wizard that standardizes filming and doubles as metric calibration.

## 3. Non-Goals (v1)

- Native iOS/Android app (web + PWA only; native is a post-revenue v3 decision)
- Ghost overlay rendering (v2 — requires proven keypoint quality first; architecture must not preclude it)
- Live/real-time analysis during filming (upload-and-process only)
- 3D pose reconstruction (2D keypoints + calibrated ground plane is sufficient for v1 metrics)
- Events beyond shot put and hammer (discus/javelin are fast-follows on the same engine)
- Multi-person tracking (assume one athlete per clip; reject clips where detection finds ambiguity)

## 4. Users & Context

- **Primary:** throws coaches (HS through D1) reviewing athlete clips on phone at the ring and laptop in the office. Existing Podium Throws subscribers (Pro $49/mo, Elite $99/mo).
- **Secondary:** self-coached athletes filming themselves.
- Connectivity at track venues is poor; uploads must be resumable and clips compressed/trimmed client-side.

## 5. Product Placement

Video Analysis 2.0 ships **inside the Podium Throws app** as the `analysis` module, replacing the MediaPipe pipeline. It is gated to Pro and Elite tiers (Free tier: 3 analyses/month teaser). Analyses attach to athlete profiles so fault history feeds the Bondarchuk programming layer (fault → drill prescription → training block) — this linkage is the moat and must be modeled in the schema from day one.

---

## 6. Feature Specifications

### F1 — Capture & Calibration Wizard

Guided tripod setup that standardizes footage and produces metric calibration.

**Flow:**
1. Event selection → static position diagram (tripod distance, height, angle per event; defaults: rear-45° for rotational shot, side-on for glide, rear elevated for hammer).
2. Live alignment view: `getUserMedia` preview + canvas overlay.
   - **Level/tilt:** DeviceOrientation API (iOS requires a user-gesture permission prompt; handle denial gracefully with manual-confirm fallback). Tolerance: roll within ±1.5°, pitch within configured band per event.
   - **Framing:** ghost ellipse template for the throwing circle; user physically adjusts tripod until the real ring sits inside the template. No CV required in v1.
   - **State machine:** `MISALIGNED` (red border + directional arrows) → `CLOSE` (amber) → `LOCKED` (green full-screen flash + chime).
   - **Audio coaching:** Web Speech API speaks adjustments ("tilt down… down… locked") — user is at the tripod, not at the screen.
3. On lock: capture calibration still, persist `{ deviceOrientation, ringEllipseScreenCoords, eventType, timestamp }` as a **CalibrationSession**.
4. Handoff instruction: "Open your camera app, switch to slo-mo (240fps), record your throws. Do not move the tripod." All clips uploaded within the session window inherit the calibration.

**Calibration math (server-side):** the imaged ring ellipse + known circle diameter (shot/hammer: 2.135 m; discus: 2.50 m) yields a ground-plane homography → pixel-to-meter conversion and camera pose. Stored per CalibrationSession; all metric outputs (velocity, displacement) require a valid calibration; uncalibrated clips still get angles/timing but velocity displays as "requires calibration."

**Acceptance criteria:**
- Wizard completes in under 90 seconds on iPhone Safari and Android Chrome.
- Gyro permission denial does not block the flow (degrades to visual-only alignment).
- Homography reprojection error on the calibration still < 2% of ring diameter.

### F2 — Upload Pipeline

- Client-side trim UI (select throw start/end; cap 15 s per clip) and compression via WebCodecs where available, ffmpeg.wasm fallback.
- Resumable uploads to Supabase Storage (TUS protocol).
- On-upload validation: container/codec sanity, **fps check** (reject < 30, warn < 60, flag 120/240 slo-mo and read true capture rate from metadata), duration, resolution ≥ 720p.
- Upload creates an `analysis_jobs` row (`status: queued`) and enqueues processing.

### F3 — Pose Inference Service (Modal)

Separate deployable service, own repo or `/services/pose` in monorepo. GPU container, scales to zero.

- **Pipeline per job:** download clip → ffmpeg frame extraction at native fps → person detection (RTMDet or YOLO-class detector, largest/центральmost person, reject multi-person ambiguity) → top-down 2D pose on crops.
- **Model:** benchmark **ViTPose-L** vs **RTMPose-l** against the golden set (Section 11); ship the winner behind a `POSE_MODEL` config flag so it stays swappable (Poseidon-class multi-frame models are the planned v2 swap).
- **Output contract:** JSON per clip — `frames[] { idx, t, bbox, keypoints[17] { x, y, conf } }` in COCO-17 schema, plus model id/version, fps, resolution. Persisted to Storage; row reference in Postgres.
- **Endpoint:** authenticated webhook/HTTP; updates `analysis_jobs.status` through `processing → pose_complete → failed`.
- **Budget:** ≤ $0.05 per 10 s clip at target volume; p95 wall-clock ≤ 90 s per clip.

### F4 — Temporal Processing Layer

Pure functions, deterministic, runs in the metrics service after pose:

1. **Confidence gating:** keypoints below threshold → null, never trusted.
2. **Left/right identity enforcement:** trajectory-continuity check to detect and correct limb swaps across frames (the signature rotational failure).
3. **Gap interpolation:** spline fill across occlusion windows ≤ N frames; longer gaps stay null and downstream metrics mark affected instants low-confidence.
4. **Smoothing:** per-landmark OneEuro filter (parameters tuned on the golden set so release-frame dynamics aren't smeared; Savitzky-Golay as the comparison baseline).

Output: `smoothed_keypoints` artifact + per-frame quality score; clips with mean quality below threshold are flagged "low confidence — refilm" rather than analyzed with false confidence.

### F5 — Metrics Engine

Deterministic computation on smoothed keypoints. Event-agnostic core + per-event metric definitions in versioned config (`metrics/definitions/{event}.ts`).

**Shot put v1 metrics (reference event):**
- Hip-shoulder separation angle over time (and its value at power position)
- Trunk inclination at power position and at release
- Release: frame detection (wrist-velocity peak + elbow extension), release angle (calibrated), release height estimate, release velocity (calibrated, m/s)
- Phase boundaries and durations: entry → drive → power position → delivery → recovery (rotational) or glide variant
- Rear-leg sweep height/path (rotational), block-leg knee angle at release
- Center-of-mass proxy path across the circle (calibrated displacement)

**Hammer v1 metrics:** turn count and per-turn duration, single vs double support ratio per turn, low-point drift, trunk countering angle, release frame/angle/velocity (calibrated).

Every metric output: `{ value, unit, confidence, frameRefs[] }`. No metric without provenance.

### F6 — Fault Detection (Rules Engine)

Versioned rules in config, not code (`faults/rules/{event}.json`): each rule = metric expression + threshold band + severity mapping + frame-evidence selector + drill tags. Thresholds are coach-authored (Bondarchuk-informed) and editable without redeploy.

Example: `hip_shoulder_separation@power_position < 30°` → fault `early_shoulder_opening`, severity by deviation band, evidence = power-position frame, drills tagged `separation`.

**Output contract per fault:** `{ ruleId, severity, measuredValue, targetRange, evidenceFrames[], drillTags[] }`. The UI renders "Separation: 18° (target 35–45°)" with the annotated frame. **No "% energy lost" figures anywhere — unmeasurable, banned.**

### F7 — Narrative Layer (Claude API)

The only LLM stage. Input: metrics JSON + detected faults + athlete context (event, level, recent history). Output: coach's summary (≤ 120 words), phase commentary, drill selection **from the existing drill library only** (LLM picks by drillTags, never invents drills). Direct Messages API (consistent with current cost posture), structured output, temperature low. Hard rule in the prompt: the model may reference only numbers present in the input JSON.

### F8 — Overlays & Annotated Keyframes

- **In-app:** keypoint JSON drives an HTML canvas layered over the video — skeleton, joint markers, live angle readouts, phase timeline scrubber, frame-step controls. Zero server cost, fully interactive.
- **Server-side keyframes:** for each phase boundary + each fault evidence frame, render annotated stills (OpenCV/Pillow): skeleton, measured angle arcs with values, fault callout. Stored to Storage for report embedding.

### F9 — Report & PDF

Keeps ThrowFlow's information design, replaces its data: header (event, athlete, date, calibration status badge), phase scores **from a published rubric** (each phase score = weighted measured sub-metrics; rubric visible in-app), fault cards with measured values + annotated frame thumbnails, drill prescriptions, coach's summary. PDF generated server-side; every number footnoted to its metric. A "How these numbers are measured" page replaces physics theater with actual methodology.

### F10 — Ghost Overlay (v2, design-constrained now)

Reference skeleton (elite throw or per-drill template) scale-normalized to the athlete (hip width + torso length), time-aligned via phase boundaries (DTW on joint-angle curves), rendered semi-transparent on frames where deviation exceeds threshold. **v1 obligation:** store smoothed keypoints + phase boundaries in a schema that supports cross-clip alignment, and tag reference-quality clips, so v2 needs no migration.

---

## 7. Architecture

```
[Browser / PWA — Next.js 14]
  Calibration wizard (getUserMedia + DeviceOrientation + canvas + Web Speech)
  Trim/compress (WebCodecs / ffmpeg.wasm) → TUS resumable upload
  Canvas overlay player (keypoint JSON)
        │
[Supabase]  Storage: clips, pose JSON, keyframes, PDFs
            Postgres: jobs, sessions, metrics, faults (RLS by org/athlete)
            Edge Function / queue: job orchestration + webhooks
        │
[Modal — GPU service]   detector → ViTPose-L | RTMPose-l → pose JSON
[Metrics service]       temporal layer → metrics engine → rules engine
                        (Node/TS preferred for stack unity; Python acceptable
                         if it ships faster — decide at build time, isolate
                         behind the same job contract)
[Claude API]            narrative layer (structured output)
[Render service]        annotated keyframes (OpenCV) + PDF
        │
[Vercel]  Next.js app, API routes, Stripe gating (existing)
```

### 7.1 Data Model (Prisma models on Supabase Postgres, additive to existing schema)

- `calibration_sessions` — id, user_id, athlete_id?, event, ring_ellipse jsonb, device_orientation jsonb, homography jsonb?, calibration_still_path, valid_until, created_at
- `analysis_jobs` — id, user_id, athlete_id, calibration_session_id?, clip_path, fps_declared, fps_true, status enum(queued|processing|pose_complete|metrics_complete|complete|failed|low_confidence), error jsonb?, timings jsonb, created_at
- `pose_artifacts` — job_id, raw_path, smoothed_path, model_id, model_version, mean_quality, per_frame_quality_path
- `analysis_results` — job_id, metrics jsonb, phase_boundaries jsonb, phase_scores jsonb, faults jsonb, narrative jsonb, keyframe_paths jsonb, report_pdf_path, rubric_version, rules_version
- `golden_set_clips` — id, clip_path, event, labels jsonb (release frame, phase boundaries, keypoint GT at critical instants), difficulty tags, source

Access control mirrors existing athlete-scoped patterns (Prisma-level scoping + RLS where the repo already uses it). All artifacts content-addressed; versions (model, rules, rubric) stamped on every result for reproducibility.

### 7.2 API Routes (Next.js)

- `POST /api/analysis/calibration` — create session
- `POST /api/analysis/jobs` — register upload, enqueue
- `GET /api/analysis/jobs/:id` — status + results
- `POST /api/analysis/webhooks/pose` — Modal callback (signed)
- `GET /api/analysis/results/:id/report.pdf`
- `POST /api/eval/run` — run benchmark against golden set (internal, admin-gated)

---

## 8. Pricing & Gating

Free: 3 analyses/month, watermark on PDF. Pro: 50/month. Elite: unlimited + calibrated-velocity metrics + (later) ghost overlay. Per-analysis GPU cost ~$0.02–0.05 keeps Pro margin > 95% at quota.

## 9. Build Phases

- **Phase 0 — Eval harness & golden set tooling (gate for everything).** Labeling UI or CLI for golden-set clips; benchmark runner computing PCK@0.05, release-frame error, phase-boundary IoU; baseline MediaPipe scored to quantify the problem.
- **Phase 1 — Pose service.** Modal service, both candidate models, benchmarked on golden set; winner shipped behind flag. **Gate: keypoint targets met (Section 11).**
- **Phase 2 — Temporal layer + metrics engine (shot put).** **Gate: metric targets met on golden set.**
- **Phase 3 — Faults, narrative, overlays, report.** **Gate: 10-clip end-to-end review by Tony; fault precision target met.**
- **Phase 4 — Calibration wizard + calibrated velocity.** **Gate: velocity within target vs. known-distance throws.**
- **Phase 5 — Hammer metrics pack; beta to 5 external coaches.**

## 10. Risks

| Risk | Mitigation |
|---|---|
| Neither off-the-shelf model passes the keypoint gate | Fine-tune ViTPose-B on labeled UCSD frames (golden-set tooling already produces training data); budget 2–3 weeks |
| iOS Safari API gaps (gyro permission, WebCodecs) | Graceful degradation path specified in F1/F2; test matrix includes Safari 17+ |
| Field connectivity kills uploads | TUS resume + client trim/compress are v1 requirements, not polish |
| Scope creep toward ghost overlay | Hard-gated to v2; only the schema obligation ships in v1 |
| LLM invents numbers in narrative | Structured input contract + output validation that rejects any numeral not present in input JSON |

## 11. Success Metrics (the eval gate)

Golden set: 50–60 clips (shot put + hammer, both genders, varied quality, ≥ 15 deliberately hard: backlight, 30fps, off-angle).

**Keypoint gate (Phase 1):** PCK@0.05 ≥ 0.90 on upper body and ≥ 0.85 on lower body across rotation frames; left/right swap rate < 1% of frames after temporal layer.
**Metric gate (Phase 2):** release-frame detection within ±2 frames at 60fps on ≥ 90% of clips; phase-boundary IoU ≥ 0.85; separation-angle MAE ≤ 5° vs. hand-labeled ground truth.
**Fault gate (Phase 3):** fault precision ≥ 0.85 against Tony's blind labels on 30 held-out clips (recall reported, precision gates — false accusations destroy coach trust faster than misses).
**Velocity gate (Phase 4):** calibrated release velocity within ±5% on throws with taped distances.
**Product:** ≥ 40% of Pro users run ≥ 4 analyses in month one of beta; report regenerated-without-complaint rate as the trust proxy.

## 12. Open Decisions (resolve during build, defaults stated)

1. Metrics service language — default TypeScript for stack unity; switch to Python only if pose-adjacent libs force it.
2. Queue mechanism — default Supabase Edge Function + pg-based queue; upgrade to dedicated queue only on observed need.
3. Monorepo vs. service repo for Modal — default `/services/pose` in the Podium Throws monorepo with independent deploy.
