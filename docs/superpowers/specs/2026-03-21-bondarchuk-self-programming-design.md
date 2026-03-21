# Bondarchuk Self-Programming Questionnaire — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Approach:** Standalone self-programming module (purpose-built wizard, not generic questionnaire template)

---

## Overview

A self-service programming feature that allows paying athletes and self-training coaches to generate Bondarchuk-methodology training programs through an adaptive step-by-step wizard. The system generates rolling mesocycles that auto-progress, coexists with coach-prescribed programs, and respects all Bondarchuk rules.

## Access Control

| User Type | Access | How Determined |
|---|---|---|
| Self-coached athlete (`isSelfCoached: true`) | Full access | `AthleteProfile.isSelfCoached` flag — set during self-registration (no coach invite) |
| Coach in training mode | Full access | `CoachProfile.trainingEnabled: true` — coach has an `AthleteProfile` with `isSelfCoached: true` created by training-mode activation (see `POST /api/coach/training-mode`) |
| Coach-invited athlete (`isSelfCoached: false`) | Blocked — shown upgrade prompt | Default for athletes created via coach invite |

**Implementation:** `canAccessSelfProgram(userId, role)` in `src/lib/authorize.ts`:
- If `role === "ATHLETE"` or `role === "COACH"` (in training mode): look up `AthleteProfile` for the `userId`, check `isSelfCoached === true`
- This works for both cases because coaches in training mode already have an `AthleteProfile` created with `isSelfCoached: true` and `coachId` = their own `CoachProfile.id` (see `/api/coach/training-mode/route.ts` lines 36-47)

**Note on `AthleteProfile.coachId`:** This field is required (non-nullable). Self-coached athletes (including coaches in training mode) have `coachId` set to their own coach profile ID — they are effectively their own coach. This is already established in the training-mode activation flow. For standalone self-coached athletes (future: athletes who register without a coach invite), a system/platform coach profile would serve as the coachId, or the registration flow would need to create a coach profile for them. **V1 scope:** Only coaches in training mode and athletes with `isSelfCoached: true` (who already have a valid `coachId`). No registration flow changes needed.

**Migration of `canAccessProgram`:** The existing `canAccessProgram()` in `src/lib/authorize.ts` references `isCoachSelfProgram`. This must be updated to use the new `source` field (see Data Model). Add handling for `source: ATHLETE_SELF_GENERATED` — the athlete can access their own self-generated program via `TrainingProgram.athleteId`.

## Supported Events

All four throws events: Shot Put, Discus, Hammer, Javelin. Questionnaire adapts per event (implement tables, competition weights, exercise pools, volume targets).

## Program Scope Options

The athlete selects one of three program types:
- **Throws Only** — throwing blocks only (`includeLift: false`)
- **Throws + Lifting** — throwing blocks + strength blocks (`includeLift: true`)
- **Lifting Only** — strength blocks only (uses `LiftingProgram` model, not `TrainingProgram` — out of scope for V1, shown as "Coming Soon")

**V1 scope:** Throws Only and Throws + Lifting. Lifting Only deferred — the existing `LiftingProgram` model is separate from `TrainingProgram` and would require a different generation path.

## Generation Modes

The athlete chooses between:
- **Autopilot** — answers core questions, system generates a complete program with specific exercises, sets, reps, implements. Athlete can review but not modify structure.
- **Guided with Preferences** — same inputs plus exercise preferences (preferred lifts, exercises to avoid, favorite drills). System respects preferences within Bondarchuk constraints.

---

## Wizard Flow

Adaptive step-by-step wizard with animated transitions. Conditional steps appear based on earlier answers.

### Step 1: Program Type
- Throws Only / Throws + Lifting / ~~Lifting Only~~ (disabled, "Coming Soon")
- Always shown

### Step 2: Event Selection
- Shot Put / Discus / Hammer / Javelin
- Gender selection (for competition weight lookup)
- Pre-populated from `AthleteProfile.events` and `AthleteProfile.gender` if available
- Always shown

### Step 3: Experience & PRs
- Years throwing
- Competition level (high school, collegiate, post-collegiate, elite)
- Current PR in selected event (used for implement table lookup and volume targets via `QUALIFICATION_THRESHOLDS`)
- **Goal distance** (meters — target PR, used by `ProgramConfig.goalDistance`)
- **Current approximate weekly volume** (throws/week — optional, used by `ProgramConfig.currentWeeklyVolume`)
- Always shown

### Step 4: Available Implements
- Checklist of implement weights, pre-populated from event/gender implement table (`IMPLEMENT_TABLES`)
- Athlete checks which weights they own/have access to
- If athlete has existing `EquipmentInventory`, pre-populate from there
- Always shown

### Step 5: Athlete Typing (Conditional)
- **Shown only if** athlete has no existing `ThrowsTyping` data (or `CoachTyping` for coaches in training mode)
- 3-4 key questions covering: adaptation speed, transfer type, recovery profile
- Option to skip — system uses sensible defaults (moderate adaptation, balanced transfer, moderate recovery)
- If existing typing data exists, this step is skipped and data is used automatically

### Step 6: Training Schedule
- Days per week (2-5) — aligned with engine's `SchedulePreferences.daysPerWeek` range and `TrainingProgram.daysPerWeek` (2-5)
- Sessions per day (1 or 2 — Bondarchuk 2-a-day model as option)
- Preferred training days (day-of-week selector)
- Program start date
- Always shown

### Step 7: Competition Dates (Optional)
- Add upcoming competition dates with name and priority (A-meet/B-meet/C-meet)
- If provided: target date = first A-meet date, phases reverse-engineered to peak on it
- If skipped: target date = start date + 16 weeks (4 mesocycles), rolling mesocycles with no specific peak
- Optional — athlete can skip

### Step 8: Goals & Mode
- Primary goal: Improve Distance / Improve Technique / Improve Consistency
- Mode selection: Autopilot vs. Guided with Preferences
- Always shown

### Step 9: Exercise Preferences (Conditional — Guided Mode Only)
- **Shown only if** athlete selected "Guided with Preferences" in step 8
- Preferred lifts (from global + coach + personal exercise library)
- Exercises to avoid (injury, preference)
- Favorite drills
- Exercise sources: global exercises (`isGlobal: true`) + coach's exercises (via `AthleteProfile.coachId` → `Exercise.coachId`) + athlete's own exercises (via `Exercise.athleteProfileId`)

### Step 10: Review & Generate
- Summary of all inputs
- Preview of program structure: phases, weekly split, session types
- Loading state during generation (shimmer skeleton of program summary with "Generating your program..." message, ~2-5 seconds)
- On success: `celebration()` toast + redirect to program hub
- On validation error: error toast with actionable message (e.g., "Not enough implements selected for descending sequence"), user stays on review step to fix
- On engine error: error toast "Something went wrong. Please try again.", retry button
- Confirm button (desktop) / `SlideToConfirm` (mobile)
- Always shown

---

## Data Model

### Schema Changes

**1. New enum and field on `TrainingProgram`:**
```prisma
enum ProgramSource {
  COACH_PRESCRIBED
  COACH_SELF_TRAINING
  ATHLETE_SELF_GENERATED
}
```

Add to `TrainingProgram`:
```prisma
source  ProgramSource  @default(COACH_PRESCRIBED)
```

This replaces the role of the existing `isCoachSelfProgram` boolean. Migration: set `source = COACH_SELF_TRAINING` where `isCoachSelfProgram = true`, then remove `isCoachSelfProgram` field. All existing queries filtering on `isCoachSelfProgram` updated to filter on `source`.

For athlete self-programs, `coachId` on `TrainingProgram` should reference the athlete's own coach (which for `isSelfCoached` athletes is themselves). This maintains FK integrity and allows exercise lookup through the coach's library. All existing queries that filter `TrainingProgram` by `coachId` will naturally include self-programs since `isSelfCoached` athletes have a valid `coachId`. No `OR` clause needed.

**2. Add `athleteProfileId` to `Exercise`:**
```prisma
// Add to Exercise model:
athleteProfileId  String?
athleteProfile    AthleteProfile? @relation(fields: [athleteProfileId], references: [id], onDelete: SetNull)

// Add index:
@@index([athleteProfileId])
```

Add reverse relation to `AthleteProfile`:
```prisma
exercises  Exercise[]
```

Exercise ownership: `isGlobal: true` = system exercises, `coachId != null` = coach exercises, `athleteProfileId != null` = athlete exercises. An exercise has at most one owner (enforced at application level — never set both `coachId` and `athleteProfileId`).

**3. New model: `SelfProgramConfig`**

Stores wizard answers for regeneration, rolling program evolution, and draft save-and-resume.

```prisma
model SelfProgramConfig {
  id                String          @id @default(cuid())
  athleteProfileId  String
  athleteProfile    AthleteProfile  @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  trainingProgramId String?         @unique
  trainingProgram   TrainingProgram? @relation(fields: [trainingProgramId], references: [id], onDelete: SetNull)

  // Wizard answers
  programType       String          // "THROWS_ONLY" | "THROWS_AND_LIFTING"
  event             String          // "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN"
  gender            String          // "MALE" | "FEMALE"
  yearsExperience   Int
  competitionLevel  String          // "HIGH_SCHOOL" | "COLLEGIATE" | "POST_COLLEGIATE" | "ELITE"
  currentPR         Float           // in meters
  goalDistance       Float           // target PR in meters
  currentWeeklyVolume Int?          // approximate throws/week currently
  availableImplements Json          // [{weightKg: 7.26, type: "shot"}]
  daysPerWeek       Int             // 2-5
  sessionsPerDay    Int             // 1 or 2
  preferredDays     Json            // ["MONDAY", "TUESDAY", ...]
  startDate         DateTime
  competitionDates  Json?           // [{date: "2026-05-15", name: "Conference Champs", priority: "A"}]
  primaryGoal       String          // "DISTANCE" | "TECHNIQUE" | "CONSISTENCY"
  generationMode    String          // "AUTOPILOT" | "GUIDED"
  exercisePreferences Json?         // {preferred: [...ids], avoided: [...ids], favoriteDrills: [...ids]}

  // Typing (inline or referenced)
  usedExistingTyping Boolean        @default(false)
  inlineTypingData   Json?          // if no ThrowsTyping exists and athlete answered inline questions

  // Rolling program state
  isActive          Boolean         @default(true)
  isDraft           Boolean         @default(true)  // true while wizard is in progress
  generationCount   Int             @default(0)     // number of mesocycles generated
  currentPhaseIndex Int             @default(0)     // which phase in the sequence

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([athleteProfileId, isActive])
}
```

Add reverse relation to `AthleteProfile`:
```prisma
selfProgramConfigs  SelfProgramConfig[]
```

Add reverse relation to `TrainingProgram`:
```prisma
selfProgramConfig   SelfProgramConfig?
```

**Rolling program strategy:** Each `SelfProgramConfig` links to ONE `TrainingProgram`. Rolling mesocycles append new `ProgramPhase` records (and their `ProgramSession` children) to the same `TrainingProgram`. The `trainingProgramId` `@unique` constraint is correct — one config, one program, many phases. `generationCount` tracks how many phases have been appended. The `generate-next` endpoint creates a new `ProgramPhase` with `phaseOrder = generationCount + 1` and its `ProgramSession` records, then increments `generationCount`.

**Constraint: One active non-draft self-program per athlete.** Enforced at the application level in the generate endpoint — if an active, non-draft `SelfProgramConfig` already exists for this athlete, return 409 Conflict. The athlete must deactivate the current program before creating a new one. (Multiple drafts are replaced, not blocked — see Draft Lifecycle.)

### Draft Lifecycle

1. **Draft creation:** When athlete starts the wizard, a `SelfProgramConfig` is created with `isDraft: true`. Wizard progress is saved on each step via PUT.
2. **Resume:** Hub page checks for `isDraft: true` records. If found, shows "Continue your program setup" CTA linking to `/athlete/self-program/create?draft={id}`. Wizard loads existing answers.
3. **Completion:** On "Generate" confirmation, `isDraft` → `false`, program is generated, `trainingProgramId` is linked.
4. **Stale drafts:** Drafts older than 30 days with no update are cleaned up by a weekly cron job (soft delete: `isActive: false`).
5. **One draft at a time:** If a draft exists and athlete starts a new wizard, the old draft is replaced (deleted and recreated).

### Event Change After Generation

If an athlete changes their events in `AthleteProfile.events` and removes the event their self-program was built for, the program remains active until manually deactivated. The hub page shows a warning banner: "Your program is for [event], which is no longer in your profile. Consider regenerating."

---

## Program Generation Logic

### Engine Adapter: `src/lib/self-program/generate.ts`

The wizard collects a `SelfProgramConfig`. The adapter transforms it into a `ProgramConfig` (from `src/lib/throws/engine/types.ts`) and calls `generateProgram()`.

**Adapter field mapping:**

| SelfProgramConfig | ProgramConfig | Derivation |
|---|---|---|
| `event` | `event`, `eventCode` | Direct mapping + code lookup |
| `gender` | `gender`, `genderCode` | Direct mapping + code lookup |
| `currentPR` | `competitionPr` | Direct |
| `currentPR` | `distanceBand` | Derived via `getDistanceBand(event, gender, pr)` from constants |
| `startDate` | `startDate` | Direct (formatted YYYY-MM-DD) |
| `competitionDates[0]` or `startDate + 16w` | `targetDate` | First A-meet date, or startDate + 16 weeks if no competitions |
| `goalDistance` | `goalDistance` | Direct |
| `daysPerWeek` | `daysPerWeek` | Direct (2-5, validated by wizard) |
| `sessionsPerDay` | `sessionsPerDay` | Direct |
| `programType` | `includeLift` | `THROWS_AND_LIFTING` → true, `THROWS_ONLY` → false |
| typing data or defaults | `adaptationGroup`, `sessionsToForm`, `recommendedMethod`, `transferType`, `recoveryProfile` | From `ThrowsTyping` / `CoachTyping` / `inlineTypingData` / defaults |
| `availableImplements` | `availableImplements` | Direct (already `ImplementEntry[]` format) |
| n/a | `facilities` | Default (see below) |
| `AthleteProfile.performanceBenchmarks` | `liftingPrs` | Parse from existing benchmarks JSON (see below) |
| `yearsExperience` | `yearsThrowing` | Direct |
| `currentWeeklyVolume` | `currentWeeklyVolume` | Direct (optional) |

**Default `facilities` object** (in `src/lib/self-program/defaults.ts`):
```typescript
export const DEFAULT_FACILITIES: FacilityConfig = {
  hasCage: true,
  hasRing: true,
  hasFieldAccess: true,
  hasGym: true,
  gymEquipment: {
    barbell: true,
    squatRack: true,
    platform: true,
    dumbbells: true,
    cables: true,
    medBalls: true,
    boxes: true,
    bands: true,
  },
};
```

**Default `liftingPrs` object** (when `AthleteProfile.performanceBenchmarks` is null):
```typescript
export const DEFAULT_LIFTING_PRS: LiftingPrs = {
  bodyWeightKg: 80, // overridden by AthleteProfile.weightKg if available
};
// All other fields (squatKg, benchKg, etc.) left undefined — engine handles missing values
```

### Rolling Program Logic

1. Generate first mesocycle on wizard completion (synchronous — engine runs in <5 seconds)
2. Track session completion: count `ProgramSession` records with `status: COMPLETED` or `SKIPPED` vs total in current phase
3. **Auto-generation trigger:** When athlete opens the training page or self-program hub, check if current mesocycle is >=80% complete by calendar (current date >= 80% through the phase date range). If so, auto-generate next phase via client-triggered API call to `/api/athlete/self-program/[id]/generate-next/`
4. **80% definition:** `(today - phaseStartDate) / (phaseEndDate - phaseStartDate) >= 0.8`. Calendar-based, not completion-based, so athletes who skip sessions still get their next phase on time.
5. Phase progression: Accumulation -> Transmutation -> Realization -> (loop back to Accumulation, or transition to Competition phase if next competition date is within 2 weeks)
6. If competition dates exist, phases are time-bound to peak correctly — Realization ends on competition week
7. Daily check-in data (readiness, implement feelings from `ThrowsCheckIn`) modulates volume in next generated phase: low average readiness -> reduce volume by 10-15%
8. `generationCount` incremented on each new phase generation
9. New phases are appended to the same `TrainingProgram` as additional `ProgramPhase` records with `phaseOrder = generationCount + 1`

### Bondarchuk Validation

All generated programs pass through existing validators in `src/lib/bondarchuk.ts`. The validators return `BondarchukWarning[]` with `severity: "error" | "warning"`.

**Blocking policy for self-programs:**
- `severity: "error"` warnings are **hard blockers** — generation is prevented, and the athlete sees the error on the Review step with a link to fix the relevant wizard step. (Coaches can override these in the coach program builder, but athletes cannot.)
- `severity: "warning"` warnings are **displayed but non-blocking** — shown as informational notes on the Review step (e.g., "Heavy implement is 22% above competition weight — consider adding an intermediate weight").

Validators applied:
- `validateImplementSequence()` — descending weight order within blocks
- `validateBlockStructure()` — no consecutive throwing blocks
- `validateCrossBlockSequence()` — later blocks use equal/lighter implements
- `validateWeightDifferential()` — flag implements >20% from competition weight

### Default Typing Values (when no typing data and athlete skips inline questions)

| Parameter | Default | Rationale |
|---|---|---|
| Adaptation group | 2 (Moderate) | Middle ground, safe for unknown athletes |
| Sessions to form | 24 | Standard moderate-adaptation estimate |
| Transfer type | Balanced | No bias toward heavy or competition dominant |
| Recommended method | Complex | Most common starting method |
| Optimal complex duration | 4 weeks | Standard moderate-adaptation mesocycle |
| Recovery profile | Moderate | Conservative assumption |

---

## Coach Program Coexistence

### Priority Rules

- Coach-prescribed sessions (`source: COACH_PRESCRIBED`) are always primary
- Self-generated sessions (`source: ATHLETE_SELF_GENERATED` or `COACH_SELF_TRAINING`) are supplementary
- On conflict days (both programs prescribe sessions):
  - If both have throwing blocks -> coach's throwing blocks win, self-program throwing blocks hidden
  - If both have lifting -> both shown, combined volume flagged if it exceeds targets
- Self-program can detect coach-covered days and shift sessions to open days

### Volume Tracking

- Weekly volume summary aggregates across both sources
- Shows contribution breakdown: "Coach: 45 throws / Self: 30 throws / Total: 75"
- Warnings if combined volume exceeds `ANNUAL_VOLUME_TARGETS` weekly thresholds

---

## Routes

### Pages

| Route | Purpose |
|---|---|
| `/athlete/self-program/` | Hub — active program status, draft resume, or CTA to create |
| `/athlete/self-program/create/` | Wizard (steps 1-10), accepts `?draft={id}` query param |
| `/athlete/self-program/[id]/` | View/manage active program, current phase, upcoming sessions |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/athlete/self-program/` | POST | Create draft config (wizard start) |
| `/api/athlete/self-program/[id]/` | GET | Fetch config and program status |
| `/api/athlete/self-program/[id]/` | PUT | Update wizard answers (save progress) or update preferences post-generation |
| `/api/athlete/self-program/[id]/` | DELETE | Deactivate program (`isActive: false`, `TrainingProgram.status: ARCHIVED`) |
| `/api/athlete/self-program/[id]/generate/` | POST | Generate program from completed config (first mesocycle) |
| `/api/athlete/self-program/[id]/generate-next/` | POST | Trigger next mesocycle generation (rolling) |

---

## UI/UX

### Wizard
- Numbered step progress indicator at top
- Animated transitions between steps (`animate-fade-slide-in`)
- Back/forward navigation
- Save-and-resume via `SelfProgramConfig` with `isDraft: true`
- `ScrollProgressBar` at top of wizard page
- `SlideToConfirm` on final step (mobile)

### Program Hub (`/athlete/self-program/`)
- **No program, no draft:** Hero CTA card, "Build Your Program" button
- **Draft exists:** "Continue your program setup" card with progress indicator, links to wizard with draft pre-loaded
- **Active program:**
  - Current phase card: phase type badge, week X of Y, `ProgressBar`
  - Next session preview card
  - Competition countdown (if dates set)
  - Phase timeline visualization (Accumulation -> Transmutation -> Realization)
  - "Regenerate" button (re-opens wizard with existing answers pre-filled, deactivates current program)
- **Event mismatch warning:** If program event is not in `AthleteProfile.events`, show warning banner
- Source badge: `SELF_GENERATED` label on all related sessions

### Generation States
- **Loading:** Shimmer skeleton of program summary card + "Generating your program..." text. No spinner — use the existing shimmer pattern.
- **Success:** `celebration()` toast ("Your program is ready!") + fade-in of program summary + redirect to hub after 2 seconds
- **Validation error:** Error toast with specific message from `severity: "error"` warnings. User stays on Review step. Affected wizard step highlighted with amber border and "Fix" link.
- **Engine error:** Error toast "Something went wrong. Please try again." + retry button on Review step.

### Training Page Integration
- Sessions from both sources appear on calendar/timeline
- Self-program sessions: subtle amber left-border indicator
- Coach sessions: standard styling
- Conflict days: coach session primary, self-program collapsed underneath with "Supplementary" label
- Combined weekly volume summary with source breakdown

### Design System Compliance
- Components: `StatCard`, `AnimatedNumber`, `ProgressBar`, `StaggeredList`, `Tabs`, `NumberFlow`, `SlideToConfirm`
- Icons: Lucide React, `strokeWidth={1.75}`, `aria-hidden="true"` on decorative
- Colors: CSS custom properties, semantic tokens, amber/gold primary
- Typography: Outfit headings, DM Sans body
- Cards: `card-interactive` on navigable cards
- Animations: CSS transitions, `prefers-reduced-motion` respected
- Toast: `celebration()` when program is generated

---

## Key Files to Modify/Create

### New Files
- `src/app/(dashboard)/athlete/self-program/page.tsx` — Hub page
- `src/app/(dashboard)/athlete/self-program/create/page.tsx` — Wizard page
- `src/app/(dashboard)/athlete/self-program/create/_wizard.tsx` — Wizard component
- `src/app/(dashboard)/athlete/self-program/create/_steps/` — Individual step components (one per step)
- `src/app/(dashboard)/athlete/self-program/[id]/page.tsx` — Program detail page
- `src/app/api/athlete/self-program/route.ts` — POST: create draft
- `src/app/api/athlete/self-program/[id]/route.ts` — GET/PUT/DELETE
- `src/app/api/athlete/self-program/[id]/generate/route.ts` — POST: first generation
- `src/app/api/athlete/self-program/[id]/generate-next/route.ts` — POST: rolling generation
- `src/lib/self-program/generate.ts` — Adapter: SelfProgramConfig -> ProgramConfig -> generateProgram()
- `src/lib/self-program/coexistence.ts` — Coach/self program merging logic
- `src/lib/self-program/defaults.ts` — Default typing values, facility config, lifting PRs (DEFAULT_FACILITIES, DEFAULT_LIFTING_PRS, DEFAULT_TYPING)

### Modified Files
- `prisma/schema.prisma` — Add `SelfProgramConfig` model, `ProgramSource` enum, `source` field on `TrainingProgram`, `athleteProfileId` + index on `Exercise`, `exercises Exercise[]` on `AthleteProfile`, `selfProgramConfigs SelfProgramConfig[]` on `AthleteProfile`, `selfProgramConfig SelfProgramConfig?` on `TrainingProgram`, remove `isCoachSelfProgram`
- `src/lib/authorize.ts` — Add `canAccessSelfProgram()` helper; update existing `canAccessProgram()` to use `source` field instead of `isCoachSelfProgram`, adding `ATHLETE_SELF_GENERATED` handling
- `src/app/(dashboard)/athlete/_layout-components.tsx` (or equivalent) — Add "Self Program" to sidebar nav (gated)
- `src/app/(dashboard)/athlete/training/` — Integrate self-program sessions with source badges and coexistence UI
- All queries referencing `isCoachSelfProgram` — Migrate to `source` field (`COACH_SELF_TRAINING`)
- Data migration: `UPDATE TrainingProgram SET source = 'COACH_SELF_TRAINING' WHERE isCoachSelfProgram = true`
