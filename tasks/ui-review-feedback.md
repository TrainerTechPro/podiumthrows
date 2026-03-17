# UI Review Feedback — March 2026

**Source:** External user testing session (coach/athlete perspective)

---

## Feedback Summary

### Pros (Keep)
- Intuitive navigation
- Near-premium feel
- Session logging, coach planned sessions, video sharing, team functionality
- Goals and achievements system

### Issues Fixed (This PR)

#### 1. Meters/Feet Toggle
**Problem:** Distance input required manual text entry when there are only 2 options.
**Fix:** Added a segmented `m` / `ft` toggle to the athlete throw log form. When "ft" is selected, input is converted to meters before storing (DB always stores meters).
**File:** `src/app/(dashboard)/athlete/throws/log/_throw-log-form.tsx`

#### 2. Practice Videos Not Appearing in Video Library
**Problem:** Videos uploaded during practice sessions were stored only as raw URLs in `PracticeAttempt.videoUrl`. They never appeared in the coach or athlete video library (`/coach/videos`, `/athlete/videos`) because those pages query the `VideoUpload` table.
**Fix:** The practice video upload API now also creates a `VideoUpload` record, linking the video to the coach, athlete, and event. Practice attempt videos now appear in the video library automatically.
**Files:** `src/app/api/throws/practice/video-upload/route.ts`, `src/app/(dashboard)/coach/throws/practice/[sessionId]/page.tsx`

### Issues Documented (Future Work)

#### 3. Coach-Athlete Communication
**Need:** A way for athlete and coach to communicate about a single throw or entire session (comments, annotations, feedback threads).
**Status:** Not yet implemented. Would require new DB models (e.g., `ThrowComment`, `SessionThread`) and UI components.

#### 4. Individual Session Planning
**Need:** Coach ability to plan sessions for individual athletes (not just team-wide).
**Status:** Partially available via throws builder — may need UX improvements for per-athlete assignment.

#### 5. Game Day Features
**Nice to have:** Competition day workflow — warm-up tracking, attempt selection, live results.
**Status:** Not yet implemented.

#### 6. Custom Drills with Video
**Nice to have:** Coach-created drill library with attached demonstration videos.
**Status:** Drill video system exists (`DrillVideo` model) but is separate from the main video library.

#### 7. Team Group Chat
**Nice to have:** In-app messaging between team members.
**Status:** Not yet implemented.

### Video Storage Architecture Warning

The reviewer flagged uncertainty about where uploaded videos are stored. Current architecture:

| Storage Layer | Details |
|---|---|
| **Production** | Cloudflare R2 (S3-compatible object storage) |
| **Development** | Local filesystem fallback (`public/uploads/`) |
| **Database** | URL references in `VideoUpload`, `DrillVideo`, `PracticeAttempt` tables |

**Three disconnected video systems exist:**
1. `VideoUpload` — Main video library (coach uploads, analysis, sharing)
2. `DrillVideo` — Short drill clips (≤10s)
3. `PracticeAttempt.videoUrl` — Inline practice videos (now also creates `VideoUpload` ✅)

**Remaining gap:** `DrillVideo` records still don't appear in the main video library. Consider unifying under a single `VideoUpload` model with a `source` field.
