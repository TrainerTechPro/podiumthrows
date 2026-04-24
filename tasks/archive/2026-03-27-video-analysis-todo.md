# Video Analysis Feature — Implementation Plan

## Codebase Analysis (Pre-Implementation)

### Existing Infrastructure to REUSE (not duplicate):
- **`src/components/video/usePoseDetection.ts`** — Complete MediaPipe hook with `PoseLandmarker`, `calculateAngle`, `THROWS_ANGLES`, `POSE_LANDMARKS`, `POSE_CONNECTIONS`
- **`src/components/video/PoseOverlay.tsx`** — Canvas overlay for drawing landmarks + skeleton + angle labels
- **`src/components/video/VideoPlayer.tsx`** — `forwardRef` video player with imperative handle (`seekTo`, `play`, `pause`, `getVideoElement`)
- **`src/components/video/types.ts`** — `PLAYBACK_SPEEDS`, `formatTimestamp`, `FRAME_STEP`, `snapToFrame`
- **`src/lib/r2.ts`** — R2 upload with presigned URLs + local fallback (`saveFileLocally`)
- **`src/lib/design-tokens.ts`** — `POSE_COLORS` for skeleton/joint colors
- **`@mediapipe/tasks-vision`** — Already installed in package.json

### Schema Adaptation:
- Spec says `Athlete` → codebase uses `AthleteProfile`
- Spec says `User` for coach → codebase uses `CoachProfile` for coach relations
- Existing `ThrowAnalysis` is AI-based frame scoring — different from this real-time pose feature

---

## Implementation Steps

### Step 1: Schema + Migration
- [ ] Add `VideoAnalysis` model to `prisma/schema.prisma`
- [ ] Add reverse relations on `CoachProfile` and `AthleteProfile`
- [ ] Run `npx prisma migrate dev --name add-video-analysis`

### Step 2: API Routes
- [ ] `src/app/api/video-analysis/route.ts` — GET list (with `?athleteId=` filter)
- [ ] `src/app/api/video-analysis/upload/route.ts` — POST upload (FormData + R2/local)
- [ ] `src/app/api/video-analysis/[id]/route.ts` — GET, PATCH, DELETE single

### Step 3: Pose Angles Utility
- [ ] `src/lib/pose-angles.ts` — `calculateThrowAngles()` with optimal ranges

### Step 4: Video Upload Page
- [ ] `src/app/(dashboard)/coach/video-analysis/upload/page.tsx` — Server component wrapper
- [ ] `src/components/video-analysis/VideoUploadForm.tsx` — Client form with dropzone, thumbnail gen, progress

### Step 5: Video Analysis List Page
- [ ] `src/app/(dashboard)/coach/video-analysis/page.tsx` — Server component with filters
- [ ] `src/components/video-analysis/VideoAnalysisCard.tsx` — Card for grid display

### Step 6: Sidebar Navigation
- [ ] Add "Video Analysis" entry to `COACH_NAV_SECTIONS` in `src/components/ui/Sidebar.tsx`

### Step 7: Analysis Panel Components
- [ ] `src/components/video-analysis/AnglesPanel.tsx` — Real-time angles with color-coded ranges
- [ ] `src/components/video-analysis/KeyPositionsPanel.tsx` — Mark, label, save, jump-to key positions
- [ ] `src/components/video-analysis/AngleIndicator.tsx` — Single angle display with color coding

### Step 8: Video Analysis Detail Page (Main Workspace)
- [ ] `src/app/(dashboard)/coach/video-analysis/[id]/page.tsx` — Server data fetch
- [ ] `src/app/(dashboard)/coach/video-analysis/[id]/_analysis-workspace.tsx` — Client workspace

### Step 9: Polish & Quality
- [ ] Loading states with shimmer skeletons
- [ ] Error states with user-friendly messages
- [ ] Delete confirmation dialog
- [ ] Responsive layout (375px mobile)
- [ ] Dark mode verification
- [ ] Breadcrumbs on all pages
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx next lint` — 0 errors

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/coach/video-analysis/
│   │   ├── page.tsx                          # List page (server)
│   │   ├── upload/page.tsx                   # Upload page (server)
│   │   └── [id]/
│   │       ├── page.tsx                      # Detail page (server)
│   │       └── _analysis-workspace.tsx       # Client workspace
│   └── api/video-analysis/
│       ├── route.ts                          # GET list
│       ├── upload/route.ts                   # POST upload
│       └── [id]/route.ts                     # GET, PATCH, DELETE
├── components/video-analysis/
│   ├── VideoUploadForm.tsx
│   ├── VideoAnalysisCard.tsx
│   ├── AnglesPanel.tsx
│   ├── KeyPositionsPanel.tsx
│   └── AngleIndicator.tsx
└── lib/
    └── pose-angles.ts
```
