# Bondarchuk Self-Programming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-service Bondarchuk programming wizard that lets paying athletes and self-training coaches generate rolling training programs through an adaptive questionnaire.

**Architecture:** A 10-step adaptive wizard collects athlete inputs, an adapter transforms them into `ProgramConfig`, and the existing `generateProgram()` engine produces the mesocycle. A `SelfProgramConfig` model stores wizard answers for rolling auto-progression. Programs coexist with coach-prescribed programs using a `ProgramSource` enum.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma ORM, Vitest, existing Bondarchuk engine (`src/lib/throws/engine/`)

**Spec:** `docs/superpowers/specs/2026-03-21-bondarchuk-self-programming-design.md`

---

## File Structure

### New Files
```
prisma/migrations/YYYYMMDD_self_programming/migration.sql  — schema migration

src/lib/self-program/defaults.ts          — DEFAULT_FACILITIES, DEFAULT_LIFTING_PRS, DEFAULT_TYPING
src/lib/self-program/adapter.ts           — SelfProgramConfig → ProgramConfig transformer
src/lib/self-program/coexistence.ts       — coach/self program session merging logic
src/lib/self-program/__tests__/adapter.test.ts
src/lib/self-program/__tests__/coexistence.test.ts

src/app/api/athlete/self-program/route.ts                    — POST: create draft
src/app/api/athlete/self-program/[id]/route.ts               — GET/PUT/DELETE
src/app/api/athlete/self-program/[id]/generate/route.ts      — POST: first generation
src/app/api/athlete/self-program/[id]/generate-next/route.ts — POST: rolling generation

src/app/(dashboard)/athlete/self-program/page.tsx                   — hub page (server)
src/app/(dashboard)/athlete/self-program/_hub.tsx                    — hub client component
src/app/(dashboard)/athlete/self-program/create/page.tsx             — wizard page (server)
src/app/(dashboard)/athlete/self-program/create/_wizard.tsx          — wizard client component
src/app/(dashboard)/athlete/self-program/create/_steps/step-program-type.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-event.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-experience.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-implements.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-typing.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-schedule.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-competitions.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-goals.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-preferences.tsx
src/app/(dashboard)/athlete/self-program/create/_steps/step-review.tsx
src/app/(dashboard)/athlete/self-program/[id]/page.tsx              — program detail page
src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx   — detail client component
```

### Modified Files
```
prisma/schema.prisma                      — ProgramSource enum, SelfProgramConfig model, Exercise.athleteProfileId
src/lib/authorize.ts                      — canAccessSelfProgram(), update canAccessProgram()
src/components/ui/Sidebar.tsx             — add Self Program to ATHLETE_NAV_SECTIONS
```

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

- [ ] **Step 1: Add ProgramSource enum and SelfProgramConfig model to schema**

Open `prisma/schema.prisma`. Add the following:

After the existing enums (near line 30):
```prisma
enum ProgramSource {
  COACH_PRESCRIBED
  COACH_SELF_TRAINING
  ATHLETE_SELF_GENERATED
}
```

Add `source` field to `TrainingProgram` model (after `isCoachSelfProgram` at line 2045):
```prisma
  source             ProgramSource @default(COACH_PRESCRIBED)
```

Add `athleteProfileId` to `Exercise` model (after `coachId` field at line 309):
```prisma
  athleteProfileId String?
  athleteProfile   AthleteProfile? @relation(fields: [athleteProfileId], references: [id], onDelete: SetNull)
```

Add `@@index([athleteProfileId])` to Exercise (after `@@index([isGlobal])` at line 331):
```prisma
  @@index([athleteProfileId])
```

Add reverse relation `exercises Exercise[]` to `AthleteProfile` (after `throwsProfiles` at line 277):
```prisma
  exercises                Exercise[]
```

Add `selfProgramConfigs SelfProgramConfig[]` to `AthleteProfile` (after `exercises`):
```prisma
  selfProgramConfigs       SelfProgramConfig[]
```

Add `selfProgramConfig SelfProgramConfig?` to `TrainingProgram` (after `adaptationCheckpoints` at line 2090):
```prisma
  selfProgramConfig     SelfProgramConfig?
```

Add the full `SelfProgramConfig` model at the end of the file (before the closing):
```prisma
// ── SELF-PROGRAMMING ──────────────────────────────────────────────────────

model SelfProgramConfig {
  id                String          @id @default(cuid())
  athleteProfileId  String
  athleteProfile    AthleteProfile  @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  trainingProgramId String?         @unique
  trainingProgram   TrainingProgram? @relation(fields: [trainingProgramId], references: [id], onDelete: SetNull)

  // Wizard answers
  programType         String          // "THROWS_ONLY" | "THROWS_AND_LIFTING"
  event               String          // "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN"
  gender              String          // "MALE" | "FEMALE"
  yearsExperience     Int
  competitionLevel    String          // "HIGH_SCHOOL" | "COLLEGIATE" | "POST_COLLEGIATE" | "ELITE"
  currentPR           Float           // meters
  goalDistance         Float           // target PR meters
  currentWeeklyVolume Int?            // throws/week
  availableImplements Json            // [{weightKg, type}]
  daysPerWeek         Int             // 2-5
  sessionsPerDay      Int             // 1 or 2
  preferredDays       Json            // ["MONDAY", ...]
  startDate           DateTime
  competitionDates    Json?           // [{date, name, priority}]
  primaryGoal         String          // "DISTANCE" | "TECHNIQUE" | "CONSISTENCY"
  generationMode      String          // "AUTOPILOT" | "GUIDED"
  exercisePreferences Json?           // {preferred: [], avoided: [], favoriteDrills: []}

  // Typing
  usedExistingTyping Boolean         @default(false)
  inlineTypingData   Json?

  // Rolling program state
  isActive          Boolean          @default(true)
  isDraft           Boolean          @default(true)
  generationCount   Int              @default(0)
  currentPhaseIndex Int              @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([athleteProfileId, isActive])
}
```

- [ ] **Step 2: Run migration**

Run: `npm run db:migrate -- --name self_programming`

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify migration**

Run: `npx prisma validate`

Expected: No errors.

- [ ] **Step 4: Data migration for isCoachSelfProgram → source**

Create and run a one-time script or add SQL to the migration. The migration SQL should include:

```sql
UPDATE "TrainingProgram" SET "source" = 'COACH_SELF_TRAINING' WHERE "isCoachSelfProgram" = true;
```

**Note:** Do NOT remove `isCoachSelfProgram` yet — it will be removed in a follow-up task after all queries are migrated. This prevents breaking existing code during the transition.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SelfProgramConfig model, ProgramSource enum, Exercise.athleteProfileId"
```

---

## Task 2: Defaults Module

**Files:**
- Create: `src/lib/self-program/defaults.ts`
- Test: `src/lib/self-program/__tests__/adapter.test.ts` (test file created here, tested in Task 3)

- [ ] **Step 1: Create defaults module**

Create `src/lib/self-program/defaults.ts`:

```typescript
import type { FacilityConfig, LiftingPrs, TypingSnapshot } from "@/lib/throws/engine/types";

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

export const DEFAULT_LIFTING_PRS: LiftingPrs = {
  bodyWeightKg: 80,
};

export const DEFAULT_TYPING: TypingSnapshot = {
  adaptationGroup: 2,
  sessionsToForm: 24,
  recommendedMethod: "complex",
  transferType: "balanced",
  selfFeelingAccuracy: "moderate",
  recoveryProfile: "moderate",
};
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/self-program/defaults.ts
git commit -m "feat: add self-program defaults (facilities, lifting PRs, typing)"
```

---

## Task 3: Engine Adapter

**Files:**
- Create: `src/lib/self-program/adapter.ts`
- Create: `src/lib/self-program/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing tests for the adapter**

Create `src/lib/self-program/__tests__/adapter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildProgramConfig } from "../adapter";
import type { SelfProgramConfig } from "@prisma/client";

const baseSelfConfig: Omit<SelfProgramConfig, "id" | "createdAt" | "updatedAt"> = {
  athleteProfileId: "athlete-1",
  trainingProgramId: null,
  programType: "THROWS_AND_LIFTING",
  event: "SHOT_PUT",
  gender: "MALE",
  yearsExperience: 5,
  competitionLevel: "COLLEGIATE",
  currentPR: 16.5,
  goalDistance: 18.0,
  currentWeeklyVolume: 80,
  availableImplements: [
    { weightKg: 7.26, type: "shot" },
    { weightKg: 8, type: "shot" },
    { weightKg: 9, type: "shot" },
  ],
  daysPerWeek: 4,
  sessionsPerDay: 1,
  preferredDays: ["MONDAY", "TUESDAY", "THURSDAY", "FRIDAY"],
  startDate: new Date("2026-04-01"),
  competitionDates: [{ date: "2026-06-15", name: "Conference Champs", priority: "A" }],
  primaryGoal: "DISTANCE",
  generationMode: "AUTOPILOT",
  exercisePreferences: null,
  usedExistingTyping: false,
  inlineTypingData: null,
  isActive: true,
  isDraft: false,
  generationCount: 0,
  currentPhaseIndex: 0,
};

describe("buildProgramConfig", () => {
  it("maps event and gender codes correctly", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.event).toBe("SHOT_PUT");
    expect(result.eventCode).toBe("SP");
    expect(result.gender).toBe("MALE");
    expect(result.genderCode).toBe("M");
  });

  it("derives distanceBand from PR", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.distanceBand).toBeTruthy();
    expect(typeof result.distanceBand).toBe("string");
  });

  it("uses first A-meet as targetDate when competitions exist", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.targetDate).toBe("2026-06-15");
  });

  it("defaults targetDate to startDate + 16 weeks when no competitions", () => {
    const noComps = { ...baseSelfConfig, competitionDates: null };
    const result = buildProgramConfig(noComps, null, null);
    // startDate 2026-04-01 + 16 weeks = 2026-07-22
    expect(result.targetDate).toBe("2026-07-22");
  });

  it("uses existing typing data when provided", () => {
    const typing = {
      adaptationGroup: 1,
      sessionsToForm: 12,
      recommendedMethod: "stage-complex",
      transferType: "heavy-dominant",
      selfFeelingAccuracy: "high",
      recoveryProfile: "fast",
    };
    const result = buildProgramConfig(baseSelfConfig, typing, null);
    expect(result.adaptationGroup).toBe(1);
    expect(result.sessionsToForm).toBe(12);
    expect(result.recommendedMethod).toBe("stage-complex");
  });

  it("uses inline typing data when no existing typing", () => {
    const withInline = {
      ...baseSelfConfig,
      inlineTypingData: {
        adaptationGroup: 3,
        sessionsToForm: 36,
        recommendedMethod: "block-complex",
        transferType: "competition-dominant",
        recoveryProfile: "slow",
      },
    };
    const result = buildProgramConfig(withInline, null, null);
    expect(result.adaptationGroup).toBe(3);
    expect(result.recommendedMethod).toBe("block-complex");
  });

  it("falls back to defaults when no typing data at all", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.adaptationGroup).toBe(2);
    expect(result.recommendedMethod).toBe("complex");
  });

  it("maps includeLift from programType", () => {
    const throwsOnly = { ...baseSelfConfig, programType: "THROWS_ONLY" };
    expect(buildProgramConfig(throwsOnly, null, null).includeLift).toBe(false);
    expect(buildProgramConfig(baseSelfConfig, null, null).includeLift).toBe(true);
  });

  it("uses default facilities", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.facilities.hasCage).toBe(true);
    expect(result.facilities.gymEquipment.barbell).toBe(true);
  });

  it("parses performanceBenchmarks into liftingPrs", () => {
    const benchmarks = JSON.stringify({ squat1RM: 180, bench1RM: 120, bodyWeight: 95 });
    const result = buildProgramConfig(baseSelfConfig, null, benchmarks);
    expect(result.liftingPrs.squatKg).toBe(180);
    expect(result.liftingPrs.benchKg).toBe(120);
    expect(result.liftingPrs.bodyWeightKg).toBe(95);
  });

  it("uses default liftingPrs when no benchmarks", () => {
    const result = buildProgramConfig(baseSelfConfig, null, null);
    expect(result.liftingPrs.bodyWeightKg).toBe(80);
    expect(result.liftingPrs.squatKg).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/self-program/__tests__/adapter.test.ts`

Expected: FAIL — `buildProgramConfig` not found.

- [ ] **Step 3: Implement the adapter**

Create `src/lib/self-program/adapter.ts`:

```typescript
import type { ProgramConfig, TypingSnapshot, ImplementEntry } from "@/lib/throws/engine/types";
import type { SelfProgramConfig } from "@prisma/client";
import {
  EVENT_CODE_MAP,
  GENDER_CODE_MAP,
  classifyBand,
} from "@/lib/throws/constants";
import type { ThrowEvent, Gender, EventCode, GenderCode } from "@/lib/throws/constants";
import { DEFAULT_FACILITIES, DEFAULT_LIFTING_PRS, DEFAULT_TYPING } from "./defaults";

/**
 * Transform a SelfProgramConfig into a ProgramConfig for the generation engine.
 *
 * @param config - The wizard answers stored in SelfProgramConfig
 * @param existingTyping - ThrowsTyping or CoachTyping data if available (null if not)
 * @param performanceBenchmarks - AthleteProfile.performanceBenchmarks JSON string (null if not)
 * @param bodyWeightKg - AthleteProfile.weightKg (optional override for default)
 */
export function buildProgramConfig(
  config: Omit<SelfProgramConfig, "id" | "createdAt" | "updatedAt">,
  existingTyping: TypingSnapshot | null,
  performanceBenchmarks: string | null,
  bodyWeightKg?: number | null,
): ProgramConfig {
  const event = config.event as ThrowEvent;
  const gender = config.gender as Gender;
  const eventCode = EVENT_CODE_MAP[event];
  const genderCode = GENDER_CODE_MAP[gender];

  // Distance band
  const distanceBand = classifyBand(eventCode, genderCode, config.currentPR) ?? "developing";

  // Target date: first A-meet, or startDate + 16 weeks
  let targetDate: string;
  const competitions = config.competitionDates as Array<{ date: string; name: string; priority: string }> | null;
  const aMeet = competitions?.find((c) => c.priority === "A");
  if (aMeet) {
    targetDate = aMeet.date;
  } else {
    const start = new Date(config.startDate);
    start.setDate(start.getDate() + 16 * 7);
    targetDate = start.toISOString().slice(0, 10);
  }

  // Start date formatted
  const startDate = new Date(config.startDate).toISOString().slice(0, 10);

  // Typing: existing > inline > defaults
  const typing: TypingSnapshot = existingTyping
    ?? (config.inlineTypingData as TypingSnapshot | null)
    ?? DEFAULT_TYPING;

  // Implements
  const availableImplements = config.availableImplements as ImplementEntry[];

  // Lifting PRs from benchmarks
  const liftingPrs = parseLiftingPrs(performanceBenchmarks, bodyWeightKg);

  return {
    athleteId: config.athleteProfileId,
    event,
    eventCode,
    gender,
    genderCode,
    competitionPr: config.currentPR,
    distanceBand,
    startDate,
    targetDate,
    goalDistance: config.goalDistance,
    daysPerWeek: config.daysPerWeek,
    sessionsPerDay: config.sessionsPerDay,
    includeLift: config.programType === "THROWS_AND_LIFTING",
    adaptationGroup: typing.adaptationGroup,
    sessionsToForm: typing.sessionsToForm,
    recommendedMethod: typing.recommendedMethod,
    transferType: typing.transferType,
    recoveryProfile: typing.recoveryProfile,
    availableImplements,
    facilities: DEFAULT_FACILITIES,
    liftingPrs,
    yearsThrowing: config.yearsExperience,
    currentWeeklyVolume: config.currentWeeklyVolume ?? undefined,
  };
}

function parseLiftingPrs(
  benchmarksJson: string | null,
  bodyWeightKg?: number | null,
) {
  if (!benchmarksJson) {
    return { ...DEFAULT_LIFTING_PRS, bodyWeightKg: bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg };
  }
  try {
    const b = JSON.parse(benchmarksJson) as Record<string, number | undefined>;
    return {
      squatKg: b.squat1RM,
      benchKg: b.bench1RM,
      cleanKg: b.cleanAndJerk1RM,
      snatchKg: b.snatch1RM,
      ohpKg: b.overheadPress1RM,
      deadliftKg: b.deadlift1RM,
      bodyWeightKg: b.bodyWeight ?? bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg,
    };
  } catch {
    return { ...DEFAULT_LIFTING_PRS, bodyWeightKg: bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/self-program/__tests__/adapter.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/self-program/adapter.ts src/lib/self-program/__tests__/adapter.test.ts
git commit -m "feat: add self-program adapter (SelfProgramConfig → ProgramConfig)"
```

---

## Task 4: Access Control

**Files:**
- Modify: `src/lib/authorize.ts`

- [ ] **Step 1: Read current authorize.ts**

Read `src/lib/authorize.ts` to find `canAccessProgram` and understand the existing pattern.

- [ ] **Step 2: Add canAccessSelfProgram function**

Add to `src/lib/authorize.ts`:

```typescript
/**
 * Check if a user can access the self-programming feature.
 * Requires isSelfCoached: true on their AthleteProfile.
 * Works for both athletes and coaches in training mode (who have an AthleteProfile).
 */
export async function canAccessSelfProgram(userId: string): Promise<boolean> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { isSelfCoached: true },
  });
  return athlete?.isSelfCoached === true;
}
```

- [ ] **Step 3: Update canAccessProgram to use source field**

In the existing `canAccessProgram` function, find references to `isCoachSelfProgram` and add parallel checks for the `source` field. Keep backward compatibility until `isCoachSelfProgram` is fully removed:

Where it checks `isCoachSelfProgram`, add:
```typescript
// Support both old and new fields during migration
const isCoachSelf = program.isCoachSelfProgram || program.source === "COACH_SELF_TRAINING";
const isAthleteSelf = program.source === "ATHLETE_SELF_GENERATED";
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorize.ts
git commit -m "feat: add canAccessSelfProgram, update canAccessProgram for ProgramSource"
```

---

## Task 5: API Routes — Draft CRUD

**Files:**
- Create: `src/app/api/athlete/self-program/route.ts`
- Create: `src/app/api/athlete/self-program/[id]/route.ts`

- [ ] **Step 1: Create POST route for draft creation**

Create `src/app/api/athlete/self-program/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canAccessSelfProgram(session.userId))) {
      return NextResponse.json(
        { error: "Self-programming requires a self-coached account" },
        { status: 403 },
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // Replace existing draft if one exists
    await prisma.selfProgramConfig.deleteMany({
      where: { athleteProfileId: athlete.id, isDraft: true },
    });

    const config = await prisma.selfProgramConfig.create({
      data: {
        athleteProfileId: athlete.id,
        programType: (body.programType as string) || "THROWS_AND_LIFTING",
        event: (body.event as string) || "",
        gender: (body.gender as string) || "",
        yearsExperience: 0,
        competitionLevel: "",
        currentPR: 0,
        goalDistance: 0,
        availableImplements: [],
        daysPerWeek: 4,
        sessionsPerDay: 1,
        preferredDays: [],
        startDate: new Date(),
        primaryGoal: "DISTANCE",
        generationMode: "AUTOPILOT",
        isDraft: true,
        isActive: true,
      },
    });

    return NextResponse.json({ id: config.id }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/self-program", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create GET/PUT/DELETE route**

Create `src/app/api/athlete/self-program/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const config = await prisma.selfProgramConfig.findUnique({
      where: { id: params.id },
      include: {
        trainingProgram: {
          include: {
            phases: { orderBy: { phaseOrder: "asc" } },
            sessions: { where: { status: { not: "PLANNED" } }, select: { id: true, status: true } },
          },
        },
      },
    });

    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (err) {
    logger.error("GET /api/athlete/self-program/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const existing = await prisma.selfProgramConfig.findUnique({ where: { id: params.id } });
    if (!existing || existing.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // Allow updating wizard fields — only accepted fields are written
    const allowedFields = [
      "programType", "event", "gender", "yearsExperience", "competitionLevel",
      "currentPR", "goalDistance", "currentWeeklyVolume", "availableImplements",
      "daysPerWeek", "sessionsPerDay", "preferredDays", "startDate",
      "competitionDates", "primaryGoal", "generationMode", "exercisePreferences",
      "usedExistingTyping", "inlineTypingData",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = field === "startDate" ? new Date(body[field] as string) : body[field];
      }
    }

    const updated = await prisma.selfProgramConfig.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PUT /api/athlete/self-program/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const config = await prisma.selfProgramConfig.findUnique({ where: { id: params.id } });
    if (!config || config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Deactivate, don't delete
    await prisma.$transaction([
      prisma.selfProgramConfig.update({
        where: { id: params.id },
        data: { isActive: false },
      }),
      ...(config.trainingProgramId
        ? [prisma.trainingProgram.update({
            where: { id: config.trainingProgramId },
            data: { status: "ARCHIVED" },
          })]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/self-program/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/athlete/self-program/
git commit -m "feat: add self-program API routes (POST draft, GET/PUT/DELETE)"
```

---

## Task 6: API Routes — Generate & Generate-Next

**Files:**
- Create: `src/app/api/athlete/self-program/[id]/generate/route.ts`
- Create: `src/app/api/athlete/self-program/[id]/generate-next/route.ts`

- [ ] **Step 1: Create generate route (first mesocycle)**

Create `src/app/api/athlete/self-program/[id]/generate/route.ts`. This route:
1. Validates the config is complete and not already generated
2. Checks no other active non-draft self-program exists (409 if so)
3. Builds `ProgramConfig` via the adapter
4. Runs Bondarchuk validation — `severity: "error"` blocks generation
5. Calls `generateProgram()`
6. Writes `TrainingProgram` + `ProgramPhase` + `ProgramSession` records
7. Links `SelfProgramConfig.trainingProgramId`
8. Sets `isDraft: false`

Key imports: `buildProgramConfig` from `@/lib/self-program/adapter`, `generateProgram` from `@/lib/throws/engine`, `validateImplementSequence`, `validateBlockStructure`, `validateCrossBlockSequence`, `validateWeightDifferential` from `@/lib/bondarchuk`.

The route should follow the pattern in the existing `/api/throws/program/generate-for-athlete/route.ts` for how it persists `GeneratedProgram` to the database. Read that file first to understand the exact Prisma create pattern for `TrainingProgram` → `ProgramPhase` → `ProgramSession`.

Set `source: "ATHLETE_SELF_GENERATED"` on the `TrainingProgram`. For coaches in training mode, also check and set `isCoachSelfProgram: true` (backward compat until migration is complete).

- [ ] **Step 2: Create generate-next route (rolling mesocycle)**

Create `src/app/api/athlete/self-program/[id]/generate-next/route.ts`. This route:
1. Loads the existing `SelfProgramConfig` + `TrainingProgram` + current active phase
2. Determines next phase type based on progression rules (Accumulation → Transmutation → Realization → loop)
3. Checks competition calendar — if A-meet within 2 weeks, use Competition phase
4. Loads recent `ThrowsCheckIn` data to modulate volume
5. Builds a single-phase `ProgramConfig` with updated start/target dates
6. Calls engine to generate the next phase
7. Appends `ProgramPhase` + `ProgramSession` records to existing `TrainingProgram`
8. Increments `generationCount` and `currentPhaseIndex`

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/athlete/self-program/[id]/generate/ src/app/api/athlete/self-program/[id]/generate-next/
git commit -m "feat: add self-program generation endpoints (first + rolling mesocycle)"
```

---

## Task 7: Sidebar Navigation

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Read the Sidebar file**

Read `src/components/ui/Sidebar.tsx` around line 444-497 to see `ATHLETE_NAV_SECTIONS`.

- [ ] **Step 2: Add Self Program nav item**

Add a "Self Program" item to the first section of `ATHLETE_NAV_SECTIONS`, after "Log Session" (line 452). Import `Dumbbell` (or `Zap`) from lucide-react:

```typescript
{
  label: "Self Program",
  href: "/athlete/self-program",
  icon: <Dumbbell {...iconSize} />,
  matchPaths: ["/athlete/self-program"],
},
```

**Note:** Access gating happens on the page level (server component checks `canAccessSelfProgram`), not in the sidebar. The nav item is always visible — if the athlete isn't self-coached, the page shows the upgrade prompt.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: add Self Program to athlete sidebar nav"
```

---

## Task 8: Wizard — Core Component

**Files:**
- Create: `src/app/(dashboard)/athlete/self-program/create/page.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_wizard.tsx`

- [ ] **Step 1: Create the wizard page (server component)**

Create `src/app/(dashboard)/athlete/self-program/create/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { SelfProgramWizard } from "./_wizard";

export default async function SelfProgramCreatePage({
  searchParams,
}: {
  searchParams: { draft?: string };
}) {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");
  if (!(await canAccessSelfProgram(session.userId))) redirect("/athlete/self-program");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      events: true,
      gender: true,
      weightKg: true,
      performanceBenchmarks: true,
      throwsTyping: { select: { adaptationGroup: true, sessionsToForm: true, recommendedMethod: true, transferType: true, selfFeelingAccuracy: true, recoveryProfile: true } },
      equipmentInventory: { select: { implements: true } },
      coachId: true,
    },
  });
  if (!athlete) redirect("/login");

  // Load existing draft if specified
  let draft = null;
  if (searchParams.draft) {
    draft = await prisma.selfProgramConfig.findUnique({
      where: { id: searchParams.draft, athleteProfileId: athlete.id, isDraft: true },
    });
  }

  // Load available exercises (global + coach + athlete-owned)
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { isGlobal: true },
        { coachId: athlete.coachId },
        { athleteProfileId: athlete.id },
      ],
    },
    select: { id: true, name: true, category: true, event: true, implementWeight: true },
    orderBy: { name: "asc" },
  });

  return (
    <SelfProgramWizard
      athleteId={athlete.id}
      athleteEvents={athlete.events}
      athleteGender={athlete.gender}
      athleteWeightKg={athlete.weightKg}
      hasTypingData={!!athlete.throwsTyping}
      existingImplements={athlete.equipmentInventory?.implements ?? null}
      exercises={exercises}
      draft={draft}
    />
  );
}
```

- [ ] **Step 2: Create the wizard client component shell**

Create `src/app/(dashboard)/athlete/self-program/create/_wizard.tsx`. This is a large client component following the pattern of `_program-builder-wizard.tsx`. It should:

1. Define `WizardFormState` interface matching all `SelfProgramConfig` wizard fields
2. Define `STEPS` array: `["Program Type", "Event", "Experience & PRs", "Implements", "Typing", "Schedule", "Competitions", "Goals & Mode", "Preferences", "Review"]`
3. Use `useState` for: `step`, `form`, `errors`, `generating`, `generatedResult`
4. Use `useCallback` for `update` function (clear field errors on change)
5. `validateStep(step)` function that validates current step fields
6. `nextStep()` / `prevStep()` with validation
7. Auto-save draft via `PUT /api/athlete/self-program/[id]` on step navigation (debounced)
8. `handleGenerate()` that POSTs to `/api/athlete/self-program/[id]/generate/`
9. Render step progress bar at top, current step component, back/next buttons
10. Use `ScrollProgressBar` at top
11. Mobile: `SlideToConfirm` on final step

Adaptive logic:
- Step 5 (Typing): skip if `hasTypingData` prop is true
- Step 7 (Competitions): always shown but skippable
- Step 9 (Preferences): skip if `form.generationMode === "AUTOPILOT"`

Compute `visibleSteps` based on form state to handle step numbering.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/self-program/create/
git commit -m "feat: add self-program wizard page and core component shell"
```

---

## Task 9: Wizard — Step Components

**Files:**
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-program-type.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-event.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-experience.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-implements.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-typing.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-schedule.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-competitions.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-goals.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-preferences.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/create/_steps/step-review.tsx`

Each step component receives `form`, `update`, `errors` as props. Follow the existing wizard step pattern from `_program-builder-wizard.tsx` (inline sub-components).

- [ ] **Step 1: Create StepProgramType**

Three large cards: "Throws Only", "Throws + Lifting", "Lifting Only" (disabled). Use `card-interactive` class. Selected card gets amber border.

- [ ] **Step 2: Create StepEvent**

Event cards (Shot Put, Discus, Hammer, Javelin) with event-specific icons. Gender toggle (Male/Female). Pre-populate from `athleteEvents` and `athleteGender` props.

- [ ] **Step 3: Create StepExperience**

Numeric inputs: years throwing, current PR (meters), goal distance (meters). Dropdown: competition level. Optional: current weekly volume. Use `NumberFlow` for the PR display.

- [ ] **Step 4: Create StepImplements**

Checklist of implement weights from `IMPLEMENT_TABLES` (filtered by event/gender). Pre-check from `existingImplements` prop if available. Each implement shows weight in kg with the type. Warn if fewer than 2 implements selected (limits descending sequence options).

- [ ] **Step 5: Create StepTyping**

3-4 questions: adaptation speed (scale 1-3), transfer type (radio: heavy-dominant/balanced/competition-dominant), recovery profile (radio: fast/moderate/slow). "Skip and use defaults" button. Only shown when `hasTypingData` is false.

- [ ] **Step 6: Create StepSchedule**

Days per week (2-5 slider or button group). Sessions per day (1 or 2 toggle). Preferred days (7-day checkbox row). Start date (date picker). Use `NumberFlow` for days count.

- [ ] **Step 7: Create StepCompetitions**

List with "Add Competition" button. Each entry: date picker, name input, priority dropdown (A/B/C). Remove button. "Skip — no upcoming competitions" link.

- [ ] **Step 8: Create StepGoals**

Primary goal: three cards (Distance, Technique, Consistency) with descriptions. Mode: two cards (Autopilot, Guided with Preferences) with descriptions.

- [ ] **Step 9: Create StepPreferences**

Three sections: Preferred exercises (searchable multi-select from `exercises` prop), exercises to avoid (same), favorite drills (filtered to drills). Only shown in Guided mode.

- [ ] **Step 10: Create StepReview**

Summary of all inputs in a structured card layout. Each section shows the step's answers with an "Edit" link to jump back. Program structure preview (phase count, weekly split). Generate button (desktop) / `SlideToConfirm` (mobile). Loading/error/success states per spec.

- [ ] **Step 11: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/(dashboard)/athlete/self-program/create/_steps/
git commit -m "feat: add all 10 self-program wizard step components"
```

---

## Task 10: Hub Page

**Files:**
- Create: `src/app/(dashboard)/athlete/self-program/page.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/_hub.tsx`

- [ ] **Step 1: Create hub server page**

Create `src/app/(dashboard)/athlete/self-program/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { SelfProgramHub } from "./_hub";

export default async function SelfProgramPage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, isSelfCoached: true, events: true },
  });
  if (!athlete) redirect("/login");

  if (!athlete.isSelfCoached) {
    // Show upgrade prompt for non-self-coached athletes
    return <SelfProgramHub state="blocked" />;
  }

  // Check for active program
  const activeConfig = await prisma.selfProgramConfig.findFirst({
    where: { athleteProfileId: athlete.id, isActive: true, isDraft: false },
    include: {
      trainingProgram: {
        include: {
          phases: { orderBy: { phaseOrder: "asc" } },
          sessions: { select: { id: true, status: true, scheduledDate: true, weekNumber: true } },
        },
      },
    },
  });

  // Check for draft
  const draft = await prisma.selfProgramConfig.findFirst({
    where: { athleteProfileId: athlete.id, isDraft: true, isActive: true },
    select: { id: true, updatedAt: true, event: true },
  });

  // Check event mismatch
  const eventMismatch = activeConfig && !athlete.events.includes(activeConfig.event as any);

  return (
    <SelfProgramHub
      state={activeConfig ? "active" : draft ? "draft" : "empty"}
      config={activeConfig}
      draft={draft}
      eventMismatch={eventMismatch ?? false}
    />
  );
}
```

- [ ] **Step 2: Create hub client component**

Create `src/app/(dashboard)/athlete/self-program/_hub.tsx`. Three states:

1. **Empty state:** Hero CTA card with Dumbbell icon, "Build Your Bondarchuk Program" heading, description, "Get Started" button linking to `/athlete/self-program/create`
2. **Draft state:** "Continue your program setup" card with event name, last updated, "Continue" button linking to `/athlete/self-program/create?draft={id}`
3. **Active state:** Current phase card (`StatCard` with phase type, week X of Y, `ProgressBar`), next session preview, competition countdown, phase timeline, "Regenerate" button, "Deactivate" button
4. **Blocked state:** Upgrade prompt card explaining the feature requires a self-coached account

Use `card-interactive` on navigable cards, `AnimatedNumber` for stats, `StaggeredList` for card grids.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/self-program/page.tsx src/app/(dashboard)/athlete/self-program/_hub.tsx
git commit -m "feat: add self-program hub page with empty/draft/active/blocked states"
```

---

## Task 11: Program Detail Page

**Files:**
- Create: `src/app/(dashboard)/athlete/self-program/[id]/page.tsx`
- Create: `src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx`

- [ ] **Step 1: Create detail server page**

Server component that loads the `SelfProgramConfig` with full `TrainingProgram` data (phases, sessions). Redirects if not found or not owned by current user. Passes data to client component.

- [ ] **Step 2: Create detail client component**

Shows:
- Program summary card (event, goal, schedule, mode)
- Phase timeline with current phase highlighted (`Tabs` component with underline variant)
- Session list for current phase (grouped by week, showing status badges)
- Volume stats (`AnimatedNumber`, `StatCard`)
- "Generate Next Phase" button (shown when >=80% through current phase)
- Auto-trigger check: on mount, check calendar-based 80% threshold and prompt generation

- [ ] **Step 3: Type check and commit**

```bash
git add src/app/(dashboard)/athlete/self-program/[id]/
git commit -m "feat: add self-program detail page with phase timeline and session list"
```

---

## Task 12: Coexistence Module

**Files:**
- Create: `src/lib/self-program/coexistence.ts`
- Create: `src/lib/self-program/__tests__/coexistence.test.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
- No conflict: coach sessions on Mon/Wed, self sessions on Tue/Thu → all returned
- Throws conflict: both have throwing blocks same day → coach's throwing blocks win
- Lifting conflict: both have lifting same day → both returned, volume flagged
- Volume aggregation: weekly totals sum across sources
- Volume warning: combined exceeds target → warning included

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/self-program/__tests__/coexistence.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement coexistence module**

Create `src/lib/self-program/coexistence.ts`:

```typescript
import type { ProgramSession } from "@prisma/client";

export interface MergedSession {
  session: ProgramSession;
  source: "COACH_PRESCRIBED" | "ATHLETE_SELF_GENERATED" | "COACH_SELF_TRAINING";
  isPrimary: boolean;
  isSupplementary: boolean;
  hidden: boolean; // true if coach session overrides self-program throws
}

export interface WeeklyVolume {
  coachThrows: number;
  selfThrows: number;
  totalThrows: number;
  warning: string | null;
}

export function mergeSessions(
  coachSessions: ProgramSession[],
  selfSessions: ProgramSession[],
  weeklyThrowsTarget: number,
): { sessions: MergedSession[]; volume: WeeklyVolume } {
  // Implementation: group by scheduledDate, apply priority rules
  // Coach throwing blocks win over self-program throwing blocks on same day
  // Both lifting blocks shown, volume flagged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/self-program/__tests__/coexistence.test.ts`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/self-program/coexistence.ts src/lib/self-program/__tests__/coexistence.test.ts
git commit -m "feat: add coach/self program coexistence merging logic"
```

---

## Task 13: Final Integration & Polish

**Files:**
- Modify: Various athlete training pages for source badges
- Verify: Full flow end-to-end

- [ ] **Step 1: Add source badges to training page**

Find the athlete training/sessions page that renders `ProgramSession` lists. Add a subtle amber left-border for `source: ATHLETE_SELF_GENERATED` sessions. Add "Self Program" badge label. Show "Supplementary" label on conflict days where coach session is primary.

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit`

Expected: 0 errors.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 4: Lint check**

Run: `npm run lint`

Expected: No errors (warnings acceptable).

- [ ] **Step 5: Manual smoke test**

1. Log in as a coach with training mode enabled
2. Navigate to `/athlete/self-program/`
3. Click "Build Your Program"
4. Complete all wizard steps
5. Generate program
6. Verify program appears on hub page
7. Verify sessions appear in training view with source badges

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete self-programming integration — source badges, polish"
```
