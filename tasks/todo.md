# Migration: Podium Throws Module from TrainingTracker

**Goal:** Extract only the Podium Throws-specific module from TrainingTracker and bring it into this project. Leave existing Podium Throws features intact.

## Phase 1: Config Files ✅
- [x] Copy `next.config.js` (security headers, 2GB body limit, image patterns, bcryptjs)
- [x] Merge `tailwind.config.ts` (add spring animations, plugins, ease-spring easing, strict type scale)
- [x] Copy `vitest.config.ts` + test setup

## Phase 2: Package Dependencies ✅
- [x] Add `recharts`
- [x] Add `tsx`
- [x] Add test infra: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react`

## Phase 3: Prisma Schema Additions ✅
New models added:
- [x] ThrowsSession, ThrowsBlock, ThrowsAssignment
- [x] PracticeSession, PracticeAttempt
- [x] ThrowsPR, ThrowsDrillPR
- [x] ThrowsCheckIn, ThrowsTyping
- [x] ThrowsComplex, ThrowsCompetition
- [x] AthleteThrowsSession, AthleteDrillLog
- [x] ThrowAnalysis, AnalysisVideo, VideoAnnotation
- [x] ThrowsProfile, ThrowsKpiStandard
- [x] ThrowsTestingRecord, ThrowsCompetitionResult, ThrowsInjury
- [x] DrillVideo, ExerciseLibrary
- [x] TrainingProgram, ProgramPhase, ProgramSession
- [x] ProgramThrowResult, ProgramLiftResult, SessionBestMark
- [x] EquipmentInventory, AdaptationCheckpoint, VoiceNote
- [x] Schema field upgrades: tokenVersion on User, richer AthleteProfile/CoachProfile fields
- [x] Added `performanceBenchmarks String? @db.Text` to AthleteProfile

## Phase 4: Core Lib Files ✅
- [x] `src/lib/throws/` (constants, correlations, podium-profile, profile-constants, profile-utils, validation)
- [x] `src/lib/throws/engine/` (all 13 engine files)
- [x] `src/lib/throwflow/` (4 AI analysis files)
- [x] Individual lib files: activity-log, built-in-exercises, env, exercisedb, focus-mode, logger, muscle-visualizer, rate-limit, wger, workout-templates, workspaces
- [x] `src/lib/calculations/` (injury-risk, training-load, wellness-score)

## Phase 5: Components ✅
- [x] `src/components/session/` (8 session-flow components)
- [x] `src/components/podium-throws-panel.tsx`
- [x] Individual components: animated-counter, drill-video-upload, exercise-library-page, exercise-name-link, icons, session-preview, shimmer-loading, user-avatar, page-transition, notification-bell, plate-calculator, profile-picture-editor, dark-mode-toggle, tools-page
- [x] `src/components/video-analysis/` additions: ComparisonView, ScrubberRuler

## Phase 6: API Routes ✅
- [x] `src/app/api/throws/` (all ~25 sub-routes)
- [x] `src/app/api/throwflow/` (2 routes)
- [x] `src/app/api/drill-videos/` (3 routes)
- [x] `src/app/api/exercise-library/` (5 routes)
- [x] `src/app/api/muscles/visualize/route.ts`
- [x] `src/app/api/voice-notes/` (2 routes)
- [x] `src/app/api/activity/route.ts`

## Phase 7: Pages ✅
- [x] `src/app/(dashboard)/coach/throws/` (dashboard, roster, practice, builder, library, analyze, profile/typing)
- [x] `src/app/(dashboard)/coach/my-program/` (dashboard, onboard, session detail)
- [x] `src/app/(dashboard)/coach/drill-videos/page.tsx`
- [x] `src/app/(dashboard)/coach/tools/page.tsx`
- [x] `src/app/(dashboard)/athlete/throws/` (replace with full TrainingTracker version)
- [x] `src/app/(dashboard)/athlete/drill-videos/page.tsx`
- [x] `src/app/(dashboard)/athlete/tools/page.tsx`

## Phase 8: Typecheck ✅
- [x] Run `tsc --noEmit` — zero errors
- [x] Run `npm run lint` — zero errors (warnings only)
- [x] Verify dev server starts cleanly
- [x] Run `prisma db push` to sync schema to local database

---
## Review
**Migration complete as of 2026-02-26.**

Key schema adaptations made during migration:
- `getCurrentUser` alias added to `src/lib/auth.ts` (PT uses `getSession()`)
- `firstName`/`lastName` on User → `email` (PT stores names on profiles, not User)
- `profilePictureUrl` → `avatarUrl` on AthleteProfile
- `weight`/`height` → `weightKg`/`heightCm` on AthleteProfile
- `prisma.throwLog` (TT semantics) → `prisma.throwsBlockLog` in throws/logs and throws/profile routes
- Added `performanceBenchmarks String? @db.Text` to AthleteProfile
- Added `"downlevelIteration": true` to tsconfig for Set/Map iteration
- Replaced 3 stale engine files (generate-phase, generate-week, select-exercises) with TT's current versions
- Copied missing components: EmptyState, toast, tools-page, user-avatar, rpe-slider, session/\*
