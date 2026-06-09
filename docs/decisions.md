# Video Analysis 2.0 — Build Decisions

Decisions made during the /goal build run (2026-06-09), per the PRD's Open Decisions
section and conflicts between the PRD's reference architecture and the existing repo.

## D1 — Database & storage: existing stack, not literal Supabase products

The PRD's architecture diagram names Supabase Storage / Edge Functions. The repo's
Postgres **is** the Supabase instance (`POSTGRES_PRISMA_URL` → `*.supabase.com`),
accessed exclusively through Prisma, and all media lives in **Cloudflare R2** via
`src/lib/r2.ts` (presigned + multipart upload, local-dir fallback). Introducing
Supabase Storage/Edge Functions would create a parallel pattern for things the repo
already does. **Decision:** Prisma migrations on the existing Postgres; clips, pose
JSON, keyframes, and PDFs in R2; job orchestration in Next.js API routes (existing
pattern: `api/webhooks/video-processing`, `api/cron/*`).

## D2 — "RLS mirroring existing policies" → application-layer scoping

The repo uses **no** Postgres RLS anywhere (verified: no policies in any migration).
Athlete scoping is application-layer via `src/lib/authorize.ts`
(`canAccessAthlete(userId, role, athleteId)`). The PRD itself says "Prisma-level
scoping + RLS **where the repo already uses it**" — which is nowhere. **Decision:**
new tables get the same `authorize.ts` scoping as every other athlete-scoped surface.
No RLS migration.

## D3 — Resumable upload: R2 multipart, not TUS

PRD F2 says "TUS protocol to Supabase Storage". Storage is R2 (D1); R2 does not speak
TUS natively, but `src/lib/r2.ts` already ships `createMultipartUpload` /
`uploadPart` / `completeMultipartUpload` helpers — S3 multipart **is** the resumable
mechanism (per-part retry, resume from last completed part). **Decision:** client
uploads via presigned multipart parts with part-level retry/resume; no new TUS server
dependency.

## D4 — Queue mechanism (PRD Open Decision 2, default accepted, adapted)

Default was "Supabase Edge Function + pg queue". Adapted to repo idiom:
`analysis_jobs` row is the queue record (status enum is the state machine); job
creation triggers the Modal endpoint directly (fire-and-forget HTTP, same shape as
the existing async ThrowFlow analysis call); a cron route
(`api/cron/requeue-stale-analysis`) retries jobs stuck in `queued`/`processing` past
a timeout. No dedicated queue infra until observed need.

## D5 — Metrics service language: TypeScript (PRD Open Decision 1, default accepted)

Temporal layer, metrics engine, rules engine, narrative, and PDF are pure TypeScript
inside the Next.js repo (`src/lib/analysis/*`). Nothing pose-adjacent forced Python:
OneEuro, spline interpolation, homography, and angle math are all straightforward TS.
Only the GPU pose service and the keyframe renderer (OpenCV) are Python, isolated in
`services/pose` behind the job contract.

## D6 — Modal service location: `/services/pose` in monorepo (PRD Open Decision 3, default accepted)

Independent deploy via `modal deploy`; no coupling to the Next.js build.

## D7 — Prisma model naming: PascalCase models, snake_case @@map

CLAUDE.md grandfathers PascalCase tables for the existing schema and prescribes
snake_case for greenfield. The PRD names the new tables snake_case
(`calibration_sessions`, …). **Decision:** PascalCase Prisma models (matches every
existing model and all generated client call sites) with `@@map` to the PRD's
snake_case table names — satisfies both the PRD's table naming and repo client
conventions. cuid() ids, standard FK indexes.

## D8 — Drill selection: drillTags resolved against the existing Drill model

PRD F6/F7 require fault rules to carry `drillTags[]` and the LLM to pick drills from
the existing library only. The existing `Drill` model has no tags column, and Stage 1
is additive-only (no changes to existing tables). **Decision:** fault rules carry
drillTags; a resolver (`src/lib/analysis/drills.ts`) maps tags → Drill rows via a
versioned tag-map in the rules config (tag → {event, category, name keywords}).
The narrative layer receives only the resolved drill list (id + name + description)
and may select solely from it. A real `tags` column on Drill is a post-v1 cleanup.

## D9 — Annotated keyframes rendered by the pose service (Python/OpenCV)

PRD F8 names OpenCV/Pillow; Vercel functions have no ffmpeg/OpenCV. **Decision:** the
Modal service exposes a second endpoint `render_keyframes(clip, frames[], annotations)`
called after metrics+faults are computed; same container, same webhook pattern. Local
CPU fallback mirrors it. PDF embeds the rendered stills from R2.

## D10 — PDF: ReportModel + pdf-lib (new dependency)

New dep `pdf-lib` (pure-JS, zero native deps, serverless-safe) — justification: repo
has no PDF capability and pdf-lib is the boring, no-binary option. All displayed
strings are produced from a typed `ReportModel`; the "every number traceable" gate is
enforced by a deterministic test over ReportModel vs `analysis_results.metrics`
(single source of truth for everything painted into the PDF).

## D11 — Legacy ThrowFlow module retained, quarantined

Video Analysis 2.0 replaces the MediaPipe pipeline and ThrowFlow's confabulated
numbers, but ripping out `src/lib/throwflow` + `api/throwflow` mid-build risks
breaking shipped surfaces. **Decision:** the "% energy" lint guard bans the pattern in
all new analysis surfaces (`src/lib/analysis`, `src/components/analysis`,
`services/`, report templates) and the legacy module is excluded with an explicit
allowlist + deprecation note. Removing ThrowFlow UI entry points is a follow-up once
2.0 is GA (tracked in build-log TODO).

## D12 — Pose model default: rtmpose-l, vitpose-l behind the same flag

Both backends ship in `services/pose` behind `POSE_MODEL`. Until the golden-set
benchmark picks a winner (needs labeled real clips — TODO(user)), the default is
`rtmpose-l` (lighter, ONNX-runnable on CPU for the local fallback path; ViTPose-L
requires GPU weights impractical for local verification).

## D13 — New dependencies (one-sentence justifications)

- `pdf-lib`: PDF generation with zero native binaries (D10).
- `@napi-rs/canvas` — **rejected**; keyframe rendering moved server-side to Python/OpenCV (D9), overlay player uses the browser canvas. No new canvas dep.
- Python service deps (`modal`, `rtmlib`, `onnxruntime`, `opencv-python-headless`, `numpy`): isolated to `services/pose`, never installed in the Node build.
