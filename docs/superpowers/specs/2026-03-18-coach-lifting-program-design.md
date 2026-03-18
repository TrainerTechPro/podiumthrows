# Coach Lifting Program — Design Spec

**Date**: 2026-03-18
**Status**: Approved
**Scope**: Coach self-training lifting program with workout logging, progressive overload tracking, and template-based flexible execution.

---

## Overview

Add a lifting/strength program feature to the coach's "My Training" section. The coach creates or loads a multi-week lifting program (e.g., the Tissue Remodeling Block), then logs workouts against the prescribed template with the ability to modify exercises on the fly. Progressive overload is tracked via auto-populated last-load values and delta indicators.

**Initial scope**: Coach-only. Data model supports `athleteId` for future expansion to athlete-assigned programs.

## Requirements

1. **Program template**: Multi-week, multi-phase programs with prescribed exercises, sets, reps, and RPE targets per workout slot
2. **Flexible logging**: Start from the prescribed template but allow adding, skipping, and reordering exercises with visual modification indicators
3. **Progressive overload**: Auto-populate load inputs with the last workout's value and show +/- delta inline
4. **Isometric support**: Exercises can be time-based (duration in seconds) instead of rep-based
5. **Exercise history**: Per-exercise history drawer showing last 10 logs with load progression
6. **Tissue Remodeling Block seed**: Pre-built template matching the PDF exactly (28 exercises @ 1x20 for weeks 1-2, 12+6 iso @ 1x15 for weeks 3-4, 10+6 iso @ 1x10 for weeks 5-6)

## Data Model

### `LiftingProgram`

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| coachId | String | FK to CoachProfile.id |
| athleteId | String? | FK to AthleteProfile.id (null = coach self-program) |
| name | String | e.g., "Tissue Remodeling Block" |
| goals | String? | JSON array: ["Technique Optimization", "Tendon Health", "Aerobic Capacity"] |
| workoutsPerWeek | Int | Number of workouts per week (4) |
| totalWeeks | Int | Total program duration in weeks (6) |
| rpeTargets | String? | JSON array: ["5-6", "6-7", "7-8", "8-9"] — one per workout slot |
| status | String | ACTIVE / PAUSED / COMPLETED / ARCHIVED |
| startDate | String? | YYYY-MM-DD |
| completedDate | String? | YYYY-MM-DD |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations**: CoachProfile (coach), AthleteProfile? (athlete), LiftingProgramPhase[] (phases), LiftingWorkoutLog[] (logs)

### `LiftingProgramPhase`

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| programId | String | FK to LiftingProgram.id |
| name | String | e.g., "1x20 Phase" |
| method | String | e.g., "1x20", "1x15", "1x10" |
| startWeek | Int | First week of this phase (1-based) |
| endWeek | Int | Last week of this phase |
| order | Int | Display sequence |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations**: LiftingProgram (program), LiftingProgramExercise[] (exercises)

### `LiftingProgramExercise`

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| phaseId | String | FK to LiftingProgramPhase.id |
| name | String | e.g., "DB Goblet Squat", "Half Squat ISO" |
| order | Int | Display sequence within the phase |
| prescribedSets | Int | Default: 1 |
| prescribedReps | String? | "20", "15", "10" — null for isometrics |
| prescribedDuration | String? | "30s", "45s", "60s" — null for standard lifts |
| prescribedLoad | String? | Default load hint, e.g., "bodyweight" |
| isIsometric | Boolean | Drives UI input type (duration vs. reps) |
| durationProgression | String? | JSON array of per-workout durations, e.g., `["30s","45s","45s","60s"]`. Indexed by `workoutNumber - 1`. Null for non-isometric exercises. |
| setsProgression | String? | JSON array of per-workout sets, e.g., `["1","1","1","2"]`. Indexed by `workoutNumber - 1`. Null when sets are constant. |
| notes | String? | Optional exercise notes |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations**: LiftingProgramPhase (phase), LiftingExerciseLog[] (logs)

**Isometric duration progression**: The PDF shows durations increasing across workouts within a week (e.g., Week 3: 30s, 45s, 45s, 60s) and sets changing (e.g., Week 5 Workout 4: 2×90s). The `durationProgression` and `setsProgression` JSON arrays encode per-workout targets indexed by `workoutNumber - 1`. When `POST /api/lifting/workouts` creates exercise logs, it reads `durationProgression[workoutNumber - 1]` and `setsProgression[workoutNumber - 1]` to pre-populate the correct target for that specific workout slot. If the arrays are null or the index is out of bounds, fall back to `prescribedDuration` and `prescribedSets`.

### `LiftingWorkoutLog`

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| programId | String | FK to LiftingProgram.id |
| phaseId | String? | FK to LiftingProgramPhase.id |
| coachId | String | FK to CoachProfile.id |
| athleteId | String? | FK to AthleteProfile.id (null = coach) |
| weekNumber | Int | 1-6 |
| workoutNumber | Int | 1-4 within the week |
| targetRpe | String? | e.g., "7-8" from program RPE targets |
| actualRpe | Float? | Logged post-workout |
| date | String | YYYY-MM-DD |
| status | String | IN_PROGRESS / COMPLETED / SKIPPED (default: IN_PROGRESS) |
| notes | String? | Free text |
| durationMinutes | Int? | Total workout duration |
| completedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Relations**: LiftingProgram (program), LiftingProgramPhase? (phase), CoachProfile (coach), LiftingExerciseLog[] (exerciseLogs)

### `LiftingExerciseLog`

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| workoutLogId | String | FK to LiftingWorkoutLog.id |
| programExerciseId | String? | FK to LiftingProgramExercise.id (null = ad-hoc) |
| exerciseName | String | Denormalized for history queries |
| order | Int | Actual sequence in the workout |
| sets | Int? | Actual sets performed |
| reps | Int? | Actual reps (null for isometrics) |
| load | Float? | Weight used |
| loadUnit | String | "lbs" or "kg" (default: "lbs") |
| duration | Int? | Seconds (for isometrics) |
| isSkipped | Boolean | Default: false |
| isAdded | Boolean | Default: false (true = not in template) |
| isModified | Boolean | Default: false (true = sets/reps differ from prescription) |
| previousLoad | Float? | Auto-populated from last log of same exercise |
| notes | String? | Per-exercise notes |
| createdAt | DateTime | |

**Relations**: LiftingWorkoutLog (workoutLog), LiftingProgramExercise? (programExercise)

**`previousLoad` is a write-once snapshot**: When `POST /api/lifting/workouts` creates exercise logs, it queries the most recent `LiftingExerciseLog` for the same `exerciseName` and `coachId`, and stores that load value as `previousLoad`. This value is not updated retroactively. The delta badge uses this snapshot as-is. This is acceptable because workouts are typically logged sequentially and retroactive edits are rare.

**Indexes and constraints**:
- `LiftingProgram`: `@@index([coachId])`, `@@index([athleteId])`, `@@index([status])`
- `LiftingProgramPhase`: `@@unique([programId, order])`, `@@index([programId])`
- `LiftingProgramExercise`: `@@unique([phaseId, order])`, `@@index([phaseId])`
- `LiftingWorkoutLog`: `@@unique([programId, weekNumber, workoutNumber, coachId])`, `@@index([coachId, date])`, `@@index([athleteId, date])`
- `LiftingExerciseLog`: `@@index([workoutLogId, order])`, `@@index([exerciseName, createdAt])`

**Back-relations required on existing models**:
- `CoachProfile`: add `liftingPrograms LiftingProgram[]` and `liftingWorkoutLogs LiftingWorkoutLog[]`
- `AthleteProfile`: add `liftingPrograms LiftingProgram[]` and `liftingWorkoutLogs LiftingWorkoutLog[]`

## API Routes

### `GET /api/lifting/programs`
List all programs for the authenticated coach. Returns summary data (no exercises).

### `POST /api/lifting/programs`
Create a program with nested phases and exercises in one call. Accepts:
```typescript
{
  name: string;
  goals?: string[];
  workoutsPerWeek: number;
  totalWeeks: number;
  rpeTargets?: string[];
  startDate?: string;
  phases: {
    name: string;
    method: string;
    startWeek: number;
    endWeek: number;
    exercises: {
      name: string;
      order: number;
      prescribedSets: number;
      prescribedReps?: string;
      prescribedDuration?: string;
      prescribedLoad?: string;
      isIsometric: boolean;
      durationProgression?: string[]; // e.g., ["30s","45s","45s","60s"]
      setsProgression?: string[];     // e.g., ["1","1","1","2"]
    }[];
  }[];
}
```

### `GET /api/lifting/programs/[id]`
Full program with phases, exercises, and all workout logs (with exercise logs). Used to render the program hub and week grid.

### `PATCH /api/lifting/programs/[id]`
Update program status, name, dates.

### `POST /api/lifting/workouts`
Start a new workout. Creates a `LiftingWorkoutLog` and pre-populates `LiftingExerciseLog` entries from the phase's prescribed exercises. Auto-populates `previousLoad` from the most recent log of each exercise. Accepts:
```typescript
{
  programId: string;
  weekNumber: number;
  workoutNumber: number;
  date: string; // YYYY-MM-DD
}
```

### `PATCH /api/lifting/workouts/[id]`
Save workout progress. Upserts exercise logs, updates status, RPE, notes. Called on auto-save (debounced) and on "Complete Workout". Accepts:
```typescript
{
  status?: "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  actualRpe?: number;
  notes?: string;
  durationMinutes?: number;
  exerciseLogs: {
    id?: string; // existing log ID for update, omit for new
    programExerciseId?: string;
    exerciseName: string;
    order: number;
    sets?: number;
    reps?: number;
    load?: number;
    loadUnit?: string;
    duration?: number;
    isSkipped?: boolean;
    isAdded?: boolean;
    isModified?: boolean;
    notes?: string;
  }[];
}
```

### `GET /api/lifting/exercises/history?name=<exerciseName>&limit=10`
Returns last N logs for a specific exercise name, ordered by date descending. Used for the exercise history drawer. The `coachId` is derived server-side from `getSession()` — never passed as a query parameter (prevents IDOR).

## UI Design

### Navigation
New item in the "My Training" sidebar section:
```
My Training
  My Program          (existing)
  Log Session         (existing)
  My Training Log     (existing)
  My Lifting          (NEW — Dumbbell icon)
```

### Page: `/coach/my-lifting` — Program Hub

**Empty state**: Card with "No lifting programs yet" message and "Load Tissue Remodeling Block" button + "Create Custom Program" button.

**Active program view**:

**Header card**:
- Program name in large text
- Goal badges (small pills)
- Current phase badge with method (e.g., "1x15 Phase")
- Progress bar: weeks completed / total weeks
- RPE scale: 4 colored segments (green/yellow/orange/red) matching the PDF

**Week grid** (below header):
- 6 rows (weeks) × 4 columns (workouts)
- Each cell shows:
  - Workout number label ("W1", "W2", "W3", "W4")
  - RPE target color-coded (matching the green-yellow-orange-red from the PDF)
  - Status: empty circle (not started), spinner (in progress), checkmark (completed), dash (skipped)
  - Date if logged
  - Actual RPE if completed
- Current week highlighted
- Clicking a cell navigates to the workout logger

**Phase labels**: Row spanning dividers between phase transitions (e.g., "1x20 Phase" above weeks 1-2, "1x15 Phase" above weeks 3-4)

### Page: `/coach/my-lifting/workout/[logId]` — Workout Logger

**Header**:
- Back arrow to program hub
- "Week 3, Workout 2" title
- RPE target badge (colored: "RPE 6-7")
- Phase method label ("1x15")

**Exercise list** (scrollable):
Each exercise row:
- Row number + exercise name (tappable → opens history drawer)
- Prescribed sets × reps badge (dimmed, e.g., "1×15")
- **Load input**: number field, auto-populated with `previousLoad`
- **Delta badge**: "+5" in green or "−5" in red (only shown when `previousLoad` exists and current differs)
- **Skip button**: toggles strikethrough + dimmed styling
- **Notes button**: expand/collapse per-exercise notes textarea

For isometric exercises:
- Load input replaced with duration input (seconds)
- "bodyweight" label shown
- Same skip/notes functionality

**Modification indicators**:
- Skipped: row dimmed, exercise name has strikethrough
- Added: subtle border-left accent + "Added" mini badge
- Modified: "Modified" mini badge if sets/reps changed

**Bottom bar** (sticky):
- "Add Exercise" button (opens search/type input)
- "Complete Workout" button (primary action → modal asking for actual RPE + optional notes + save)

**Auto-save**: Debounced PATCH (1.5s after last input change) saves current state. Visual "Saved" indicator in header.

### Component: Exercise History Drawer
Triggered by tapping exercise name. Slides in from right.
- Exercise name as title
- List of last 10 logs: date, load (with unit), reps or duration, workout context (week/workout number)
- Load trend: simple text-based progression (e.g., "20 → 25 → 25 → 30 lbs")
- Close button

## Seed Data: Tissue Remodeling Block

Stored as a TypeScript constant in `src/lib/lifting-templates/tissue-remodeling.ts`.

### Phase 1: 1x20 (Weeks 1-2)
28 exercises, all 1×20:
1. DB Goblet Squat, 2. Hip Abduction, 3. Hip Adduction, 4. Push Up, 5. Inverted Row, 6. Band Knee Drive, 7. 1-Arm DB Overhead Press, 8. Lat Pulldown, 9. Back Raise, 10. Sit-Up, 11. Back Raise w/ Twist, 12. DB Lateral Raise, 13. DB Front Raise, 14. DB Rear Delt Raise, 15. Russian Twist, 16. Reverse Sit-Up, 17. Double-Leg Sissy Squat, 18. Band Hamstring Curl, 19. DB Bicep Curl, 20. Tricep Pushdown, 21. EZ-Bar Reverse Curls, 22. Single-Leg Calf Raise, 23. Anterior Tibialis Raise, 24. DB Supination & Pronation, 25. EZ-Bar Wrist Flexion, 26. EZ-Bar Wrist Extension, 27. Plate Pinch Drop + Catch, 28. Belly Breathing

### Phase 2: 1x15 (Weeks 3-4)
12 main exercises (1×15) + 6 isometric holds:

**Main**: 1. Front Squat, 2. Hip Abduction, 3. Hip Adduction, 4. DB Bench Press, 5. 1-Arm DB Row, 6. Barbell RDL, 7. Standing Band Knee Drive, 8. Single-Leg Hip Thrust, 9. Kneeling 1-Arm Landmine Press, 10. Pull Up, 11. Glute Ham Raise, 12. Hanging Knee Raise

**Isometric holds** (completed after main training):
1. Half Squat ISO, 2. Push Up ISO, 3. Split Squat Right ISO, 4. Split Squat Left ISO, 5. Pull Up ISO, 6. Back Extension ISO

Duration progression per workout per week:
- Week 3: 30s → 45s → 45s → 60s
- Week 4: 45s → 60s → 45s → 60s

### Phase 3: 1x10 (Weeks 5-6)
10 main exercises (1×10) + 6 isometric holds:

**Main**: 1. Back Squat, 2. DB Goblet Lateral Lunge, 3. Barbell Bench Press, 4. Barbell Row, 5. Barbell Deadlift, 6. DB Bulgarian Split Squat, 7. Barbell Military Press, 8. Pull Up, 9. Yessis Glute Ham Raise, 10. Russian Twist

**Isometric holds** (same 6 exercises):
Duration progression per workout per week:
- Week 5: 75s → 90s → 90s → 2×90s
- Week 6: 90s → 2×90s → 90s → 2×90s

## File Structure

```
prisma/schema.prisma                              — 5 new models added
prisma/migrations/XXXXXX_add_lifting_program/     — migration

src/lib/lifting-templates/
  tissue-remodeling.ts                            — seed data constant

src/app/api/lifting/
  programs/route.ts                               — GET (list), POST (create)
  programs/[id]/route.ts                          — GET (full), PATCH (update)
  workouts/route.ts                               — POST (start workout)
  workouts/[id]/route.ts                          — PATCH (save/complete)
  exercises/history/route.ts                      — GET (exercise history)

src/app/(dashboard)/coach/my-lifting/
  page.tsx                                        — Program hub (server component)
  _program-header.tsx                             — Header card with progress
  _week-grid.tsx                                  — Week/workout grid
  _empty-state.tsx                                — No programs yet
  workout/[logId]/
    page.tsx                                      — Workout logger (server component)
    _workout-client.tsx                           — Client component with logging UI
    _exercise-row.tsx                             — Single exercise logging row
    _exercise-history-drawer.tsx                  — Slide-out history panel
    _add-exercise-modal.tsx                       — Add ad-hoc exercise

src/components/ui/Sidebar.tsx                     — Add "My Lifting" nav item
```

## Constraints

- NO new UI dependencies (no shadcn, no external component libraries)
- Use existing Tailwind theme, colors (amber/gold primary), fonts (Outfit headings, DM Sans body)
- Dark mode support via `darkMode: "class"`
- All API routes use existing `getSession()` auth pattern
- Coach-only access initially; `athleteId` fields remain null
- Auto-save uses debounced PATCH, not optimistic UI (keep it simple for v1)

## Out of Scope (v1)

- Athlete assignment UI
- Program builder/editor UI (programs are loaded from templates or created via API)
- Charting/graphs for load progression (text-based for v1)
- PDF import (manual template seeding only)
- Rest timer integration
- Supersets / circuit grouping
