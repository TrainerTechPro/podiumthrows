# Coach Lifting Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coach self-training lifting program feature with the Tissue Remodeling Block pre-loaded, workout logging with progressive overload tracking, and flexible exercise management.

**Architecture:** 5 new Prisma models (LiftingProgram → LiftingProgramPhase → LiftingProgramExercise for templates; LiftingWorkoutLog → LiftingExerciseLog for logging). 6 API routes under `/api/lifting/`. 2 new pages under `/coach/my-lifting/`. Seed data as TypeScript constant.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, PostgreSQL, Tailwind CSS, custom component library (no shadcn).

**Spec:** `docs/superpowers/specs/2026-03-18-coach-lifting-program-design.md`

---

### Task 1: Prisma Schema — Add 5 New Models + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add 5 new models to schema.prisma**

Add after the `CoachDrillLog` model (around line 1400). Models: `LiftingProgram`, `LiftingProgramPhase`, `LiftingProgramExercise`, `LiftingWorkoutLog`, `LiftingExerciseLog` — exactly as specified in the design spec. Include all `@@unique` and `@@index` constraints.

Also add back-relations to `CoachProfile`:
```prisma
liftingPrograms    LiftingProgram[]
liftingWorkoutLogs LiftingWorkoutLog[]
```

And to `AthleteProfile`:
```prisma
liftingPrograms    LiftingProgram[]
liftingWorkoutLogs LiftingWorkoutLog[]
```

- [ ] **Step 2: Generate and apply migration**

Run: `npx prisma migrate dev --name add_lifting_program`
Expected: Migration created and applied successfully.

- [ ] **Step 3: Verify with prisma generate**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "schema: add lifting program models (5 new tables)"
```

---

### Task 2: Seed Data — Tissue Remodeling Block Template

**Files:**
- Create: `src/lib/lifting-templates/tissue-remodeling.ts`

- [ ] **Step 1: Create the template file**

Export a typed constant `TISSUE_REMODELING_TEMPLATE` containing the full program structure with all 3 phases, all exercises, isometric progressions (`durationProgression` and `setsProgression` arrays), matching the PDF exactly. Use a TypeScript interface for the shape.

Phase 1 (1x20, weeks 1-2): 28 exercises — DB Goblet Squat through Belly Breathing.
Phase 2 (1x15, weeks 3-4): 12 main exercises + 6 isometric holds with `durationProgression` per week:
- Week 3 isos: `["30s","45s","45s","60s"]`
- Week 4 isos: `["45s","60s","45s","60s"]`

Since phases span 2 weeks but iso progressions differ per week, encode the phase-2 iso exercises with **Week 3 progressions** and include a `week4DurationProgression` or handle it by having the API route compute the correct progression based on `weekNumber` within the phase. Simpler approach: store per-phase-week progressions as a map in the template, and the API route resolves the correct one.

Phase 3 (1x10, weeks 5-6): 10 main exercises + 6 isometric holds with:
- Week 5 isos: `["75s","90s","90s","90s"]` with setsProgression `["1","1","1","2"]`
- Week 6 isos: `["90s","90s","90s","90s"]` with setsProgression `["1","2","1","2"]`

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/lifting-templates/
git commit -m "feat: add Tissue Remodeling Block template data"
```

---

### Task 3: API — Programs CRUD (GET list, POST create, GET detail, PATCH update)

**Files:**
- Create: `src/app/api/lifting/programs/route.ts` — GET (list) + POST (create)
- Create: `src/app/api/lifting/programs/[id]/route.ts` — GET (full detail) + PATCH (update)

- [ ] **Step 1: Create programs/route.ts**

Auth pattern (copy from `src/app/api/coach/athletes/route.ts`):
```typescript
const session = await getSession();
if (!session || session.role !== "COACH") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const coach = await prisma.coachProfile.findUnique({
  where: { userId: session.userId },
  select: { id: true },
});
if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });
```

**GET**: Return all `LiftingProgram` where `coachId = coach.id`, ordered by `createdAt desc`. Include `phases` count and `workoutLogs` count for summary.

**POST**: Accept nested payload per spec. Use `prisma.liftingProgram.create()` with nested `phases.create` and `exercises.create`. Validate: name required, phases array non-empty, exercises have unique orders within phase. Set `status: "ACTIVE"`.

- [ ] **Step 2: Create programs/[id]/route.ts**

**GET**: Fetch full program with `include: { phases: { include: { exercises: true }, orderBy: { order: 'asc' } }, workoutLogs: { include: { exerciseLogs: { orderBy: { order: 'asc' } } }, orderBy: [{ weekNumber: 'asc' }, { workoutNumber: 'asc' }] } }`. Verify `coachId` matches session.

**PATCH**: Update allowed fields: `name`, `status`, `startDate`, `completedDate`. Verify ownership.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lifting/programs/
git commit -m "feat: add lifting program CRUD API routes"
```

---

### Task 4: API — Workouts (POST start, PATCH save/complete)

**Files:**
- Create: `src/app/api/lifting/workouts/route.ts` — POST (start workout)
- Create: `src/app/api/lifting/workouts/[id]/route.ts` — PATCH (save/complete)

- [ ] **Step 1: Create workouts/route.ts (POST)**

Accept `{ programId, weekNumber, workoutNumber, date }`.

Logic:
1. Auth check (same pattern as Task 3).
2. Fetch program with phases+exercises. Verify ownership.
3. Determine which phase this week falls in (`phase.startWeek <= weekNumber <= phase.endWeek`).
4. Resolve RPE target from `program.rpeTargets[workoutNumber - 1]`.
5. Create `LiftingWorkoutLog` with status `IN_PROGRESS`.
6. For each exercise in the phase:
   - Query most recent `LiftingExerciseLog` for same `exerciseName` + `coachId` (via workoutLog join) to get `previousLoad`.
   - For isometric exercises: resolve duration from `durationProgression[workoutNumber - 1]` (adjusting for which week within the phase if progressions differ per week — use the template's per-week map).
   - For isometric exercises: resolve sets from `setsProgression[workoutNumber - 1]`.
   - Create `LiftingExerciseLog` with pre-populated values.
7. Return the created workout log with exercise logs.

The unique constraint `@@unique([programId, weekNumber, workoutNumber, coachId])` prevents double-creates — catch Prisma unique constraint error and return 409.

- [ ] **Step 2: Create workouts/[id]/route.ts (PATCH)**

Accept payload per spec. Logic:
1. Auth check.
2. Fetch workout log, verify ownership.
3. Update workout-level fields (status, actualRpe, notes, durationMinutes).
4. For each exercise log in payload:
   - If `id` provided: update existing `LiftingExerciseLog`.
   - If no `id`: create new `LiftingExerciseLog` (ad-hoc exercise).
5. If `status === "COMPLETED"`: set `completedAt = new Date()`.
6. Return updated workout log with exercise logs.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lifting/workouts/
git commit -m "feat: add workout start and save API routes"
```

---

### Task 5: API — Exercise History

**Files:**
- Create: `src/app/api/lifting/exercises/history/route.ts`

- [ ] **Step 1: Create history route**

**GET**: Accept `name` (required) and `limit` (default 10) query params.
Derive `coachId` from session (NOT from query params).
Query `LiftingExerciseLog` where `exerciseName = name` and the parent `workoutLog.coachId = coach.id`, ordered by `createdAt desc`, limited to N.
Include `workoutLog: { select: { weekNumber, workoutNumber, date } }` for context.
Return array of logs.

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/app/api/lifting/exercises/
git commit -m "feat: add exercise history API route"
```

---

### Task 6: Sidebar Navigation — Add "My Lifting"

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Add nav item**

In `COACH_NAV_SECTIONS`, in the "My Training" section (around line 240), add:
```typescript
{ label: "My Lifting", href: "/coach/my-lifting", icon: <Dumbbell {...iconSize} />, matchPaths: ["/coach/my-lifting"] },
```

`Dumbbell` is already imported from lucide-react (line 14).

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/ui/Sidebar.tsx
git commit -m "feat: add My Lifting to coach sidebar navigation"
```

---

### Task 7: Program Hub Page — `/coach/my-lifting`

**Files:**
- Create: `src/app/(dashboard)/coach/my-lifting/page.tsx` — Server component
- Create: `src/app/(dashboard)/coach/my-lifting/_empty-state.tsx` — Empty state component
- Create: `src/app/(dashboard)/coach/my-lifting/_program-header.tsx` — Program header card
- Create: `src/app/(dashboard)/coach/my-lifting/_week-grid.tsx` — Week/workout grid (client component)

- [ ] **Step 1: Create page.tsx (server component)**

Pattern matches `src/app/(dashboard)/coach/my-training/page.tsx`:
- Auth via `getSession()`, redirect if not COACH.
- Fetch coach's active lifting program via `prisma.liftingProgram.findFirst({ where: { coachId, status: "ACTIVE" } })` with full includes.
- If no program: render `<EmptyState />`.
- If program exists: render `<ProgramHeader>` + `<WeekGrid>`.

- [ ] **Step 2: Create _empty-state.tsx**

Two buttons:
- "Load Tissue Remodeling Block" — POST to `/api/lifting/programs` with the template data (client-side fetch).
- "Create Custom Program" — disabled for v1, shows "Coming soon" tooltip.

Use existing Button component from `@/components/ui/Button`, Card from `@/components/ui/Card`.

- [ ] **Step 3: Create _program-header.tsx**

Server component displaying:
- Program name (Outfit font, large).
- Goal pills (small rounded badges with amber accent).
- Current phase badge (computed from current week).
- Progress bar using existing `ProgressBar` component.
- RPE scale: 4 colored segments (green `#22c55e`, yellow `#eab308`, orange `#f97316`, red `#ef4444`) with labels.

- [ ] **Step 4: Create _week-grid.tsx (client component)**

`"use client"` — handles click navigation.
6 rows × 4 columns grid. Each cell:
- Color-coded by RPE target (workout 1=green, 2=yellow, 3=orange, 4=red border).
- Status icon: empty circle / checkmark / dash.
- Date + actual RPE if completed.
- Phase divider rows between phase transitions.
- Click → `router.push(/coach/my-lifting/workout/${logId})` if log exists, or trigger workout start if no log.

- [ ] **Step 5: Create loading.tsx**

```tsx
export default function Loading() {
  return <div className="animate-pulse space-y-4 p-6">
    <div className="h-40 bg-surface-200 dark:bg-surface-800 rounded-xl" />
    <div className="h-64 bg-surface-200 dark:bg-surface-800 rounded-xl" />
  </div>;
}
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/\\(dashboard\\)/coach/my-lifting/
git commit -m "feat: add My Lifting program hub page with week grid"
```

---

### Task 8: Workout Logger Page — `/coach/my-lifting/workout/[logId]`

**Files:**
- Create: `src/app/(dashboard)/coach/my-lifting/workout/[logId]/page.tsx` — Server component
- Create: `src/app/(dashboard)/coach/my-lifting/workout/[logId]/_workout-client.tsx` — Main client component
- Create: `src/app/(dashboard)/coach/my-lifting/workout/[logId]/_exercise-row.tsx` — Exercise row component
- Create: `src/app/(dashboard)/coach/my-lifting/workout/[logId]/_exercise-history-drawer.tsx` — History drawer
- Create: `src/app/(dashboard)/coach/my-lifting/workout/[logId]/_add-exercise-modal.tsx` — Add exercise modal

- [ ] **Step 1: Create page.tsx (server component)**

Fetch `LiftingWorkoutLog` by `logId` with full includes (exerciseLogs with programExercise). Auth check. Pass data to `<WorkoutClient>`.

- [ ] **Step 2: Create _workout-client.tsx**

`"use client"` — main orchestrator component.
- Local state for exercise logs (managed as array).
- Debounced auto-save: on any input change, set 1.5s timer, PATCH `/api/lifting/workouts/[id]` with current state. Show "Saving..." / "Saved" indicator.
- "Complete Workout" button opens completion modal (RPE input + notes + save).
- Renders `<ExerciseRow>` for each exercise log.
- Renders "Add Exercise" button at bottom.
- Sticky bottom bar with actions.

- [ ] **Step 3: Create _exercise-row.tsx**

Single exercise row. Props: exercise log data, prescribed data, onChange callback.
- Row number + exercise name (clickable → triggers history drawer).
- Prescribed badge (dimmed "1×15").
- For standard exercises: load input (number), delta badge.
- For isometric exercises: duration input (seconds), "bodyweight" label.
- Skip toggle button.
- Notes expand/collapse.
- Visual modification indicators (dimmed+strikethrough for skip, "Added" badge, "Modified" badge).

- [ ] **Step 4: Create _exercise-history-drawer.tsx**

Slide-in panel from right. Fetches from `/api/lifting/exercises/history?name=X&limit=10`.
Shows list of past logs with date, load, reps/duration, week/workout context.
Text-based load trend line.

- [ ] **Step 5: Create _add-exercise-modal.tsx**

Simple modal with text input for exercise name. On confirm, adds a new exercise log to the client state with `isAdded: true`.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/\\(dashboard\\)/coach/my-lifting/workout/
git commit -m "feat: add workout logger page with exercise rows, history drawer, and auto-save"
```

---

### Task 9: Integration Test — Full Flow

**Files:**
- No new test files (manual verification via dev server)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: 0 errors (warnings OK).

- [ ] **Step 3: Start dev server and verify**

Run: `npm run dev`

Manual checks:
1. Navigate to `/coach/my-lifting` — see empty state.
2. Click "Load Tissue Remodeling Block" — program loads, week grid appears.
3. Click a workout cell — workout starts, exercise list appears with prescribed exercises.
4. Enter loads for a few exercises, verify auto-save indicator.
5. Skip an exercise — verify strikethrough.
6. Add an exercise — verify "Added" badge.
7. Click exercise name — verify history drawer (empty on first use).
8. Complete workout — verify RPE prompt and completion.
9. Return to hub — verify checkmark on completed workout.
10. Start second workout — verify `previousLoad` auto-populated from first workout.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration testing feedback"
```
