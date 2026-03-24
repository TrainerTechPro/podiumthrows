# Athlete Master Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 6-tab athlete profile page that replaces the current redirect, serving as the athlete's single source of truth for core info, competition goals, implement performance, strength numbers, technical profile, and injury history.

**Architecture:** Server Component page fetches data in parallel from AthleteProfile, ThrowsPR, ThrowsInjury, and ThrowsProfile. Passes to a Client Component managing 6 icon-tabs. Tabs 1-4 are editable forms (per-tab save via PATCH /api/athlete/profile). Tabs 5-6 are read-only (coach-managed).

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma, Tailwind CSS, Lucide React icons, custom component library (Tabs, AnimatedNumber, NumberFlow, ScrollProgressBar, StaggeredList, ProgressBar, Toast, EmptyState).

**Spec:** `docs/superpowers/specs/2026-03-24-athlete-master-profile-design.md`

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:228-315` (AthleteProfile model)
- Create: migration file via `prisma migrate dev`

- [ ] **Step 1: Add new fields to AthleteProfile model**

In `prisma/schema.prisma`, inside the `model AthleteProfile` block, add after the `dashboardConfig Json?` line (line ~256):

```prisma
  // Master Profile — Core Info (Section 1)
  turnDirection   String?   // "LEFT" | "RIGHT"
  classStanding   String?   // "FR" | "SO" | "JR" | "SR" | "GRAD" | "PRO"
  gradYear        Int?

  // Master Profile — Competition & Distance Bands (Section 2)
  competitionGoals Json?

  // Master Profile — Strength Numbers (Section 4)
  strengthNumbers  Json?

  // Master Profile — Technical Profile (Section 5, coach-managed)
  technicalProfile Json?

  // Master Profile — Movement Restrictions (Section 6, coach-managed)
  movementRestrictions Json?
```

- [ ] **Step 2: Run migration**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx prisma migrate dev --name add-athlete-master-profile-fields
```

Expected: Migration creates and applies successfully. 7 new columns on AthleteProfile (3 scalar + 4 JSON).

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add athlete master profile fields to schema

Add turnDirection, classStanding, gradYear (scalar), competitionGoals,
strengthNumbers, technicalProfile, movementRestrictions (JSON) to
AthleteProfile for the 6-section master profile page."
```

---

## Task 2: Refactor PATCH API for Partial Updates

**Files:**
- Modify: `src/app/api/athlete/profile/route.ts:57-164`

- [ ] **Step 1: Refactor the PATCH handler to accept partial payloads**

Replace the validation block (lines 77-85) and data construction. The key change: only validate fields that are present. Build Prisma `data` object conditionally.

```typescript
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Validate name fields only if they are present in the payload
    if ("firstName" in body || "lastName" in body) {
      if (
        ("firstName" in body && (typeof body.firstName !== "string" || body.firstName.trim().length === 0)) ||
        ("lastName" in body && (typeof body.lastName !== "string" || body.lastName.trim().length === 0))
      ) {
        return NextResponse.json(
          { error: "First name and last name cannot be empty." },
          { status: 400 }
        );
      }
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, gender: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Build data object conditionally from provided fields
    const data: Record<string, unknown> = {};

    if (typeof body.firstName === "string") data.firstName = body.firstName.trim();
    if (typeof body.lastName === "string") data.lastName = body.lastName.trim();
    if (Array.isArray(body.events)) data.events = body.events;
    if (typeof body.gender === "string") data.gender = body.gender;
    if ("dateOfBirth" in body) {
      data.dateOfBirth = typeof body.dateOfBirth === "string" && body.dateOfBirth
        ? new Date(body.dateOfBirth)
        : null;
    }
    if ("heightCm" in body) data.heightCm = typeof body.heightCm === "number" ? body.heightCm : null;
    if ("weightKg" in body) data.weightKg = typeof body.weightKg === "number" ? body.weightKg : null;

    // New master profile fields
    if ("turnDirection" in body) data.turnDirection = body.turnDirection || null;
    if ("classStanding" in body) data.classStanding = body.classStanding || null;
    if ("gradYear" in body) data.gradYear = typeof body.gradYear === "number" ? body.gradYear : null;
    if ("competitionGoals" in body) data.competitionGoals = body.competitionGoals ?? null;
    if ("strengthNumbers" in body) data.strengthNumbers = body.strengthNumbers ?? null;

    if (body.completeOnboarding === true) {
      data.onboardingCompletedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data,
      select: {
        id: true, firstName: true, lastName: true, events: true, gender: true,
        dateOfBirth: true, heightCm: true, weightKg: true,
        turnDirection: true, classStanding: true, gradYear: true,
      },
    });

    // Keep existing competitionPBs ThrowLog creation logic
    if (Array.isArray(body.competitionPBs) && body.competitionPBs.length > 0) {
      const resolvedGender = (typeof body.gender === "string" ? body.gender : athlete.gender) as Gender;
      const genderCode = GENDER_CODE_MAP[resolvedGender] ?? "M";

      const pbEntries = (body.competitionPBs as { event: string; distance: number }[])
        .filter((pb) => pb.event && typeof pb.distance === "number" && pb.distance > 0)
        .map((pb) => {
          const eventCode = EVENT_CODE_MAP[pb.event as ThrowEvent];
          const compWeight = eventCode
            ? COMPETITION_WEIGHTS[eventCode]?.[genderCode] ?? 7.26
            : 7.26;
          return {
            athleteId: athlete.id,
            event: pb.event as never,
            implementWeight: compWeight,
            distance: pb.distance,
            isPersonalBest: true,
            isCompetition: true,
            notes: "Competition PB (self-reported during onboarding)",
            date: new Date(),
          };
        });

      if (pbEntries.length > 0) {
        await prisma.throwLog.createMany({ data: pbEntries });
      }
    }

    return NextResponse.json({
      ...updated,
      dateOfBirth: updated.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/athlete/profile/route.ts
git commit -m "refactor: support partial updates in athlete profile PATCH

Allow per-tab saves by only validating and updating fields present in
the request body. Adds support for new master profile fields:
turnDirection, classStanding, gradYear, competitionGoals, strengthNumbers."
```

---

## Task 3: Profile Types

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_types.ts`

- [ ] **Step 1: Create shared types for the profile tabs**

```typescript
// Types shared across all profile tab components

import type { EventType, Gender } from "@prisma/client";

/* ─── AthleteProfile data from server component ─────────────────────── */

export type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  events: EventType[];
  gender: Gender;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  turnDirection: string | null;
  classStanding: string | null;
  gradYear: number | null;
  competitionGoals: CompetitionGoalsMap | null;
  strengthNumbers: StrengthNumbersData | null;
  technicalProfile: TechnicalProfileData | null;
  movementRestrictions: MovementRestrictionsData | null;
  email: string;
};

/* ─── Section 2: Competition & Distance Bands ───────────────────────── */

export type CompetitionMark = {
  distance: number;
  date: string;
  meet: string;
};

export type CompetitionGoalsEntry = {
  competitionPR: CompetitionMark;
  seasonBest: CompetitionMark;
  seasonGoal: number;
  careerGoal: number;
  targetBand: string;
};

export type CompetitionGoalsMap = Record<string, CompetitionGoalsEntry>;

/* ─── Section 4: Strength Numbers ───────────────────────────────────── */

export type LiftEntry = {
  current: number;
  date: string;
  goal: number;
  correlation: string;
};

export type StrengthNumbersData = {
  lifts: Record<string, LiftEntry>;
  tests: { standingLJ: number; tripleJump: number };
  ratios: { squatBW: number; cleanBW: number; snatchBW: number };
};

/* ─── Section 5: Technical Profile ──────────────────────────────────── */

export type TechnicalCue = {
  phase: string;
  cue: string;
  why: string;
};

export type TechnicalCueFail = {
  cue: string;
  why: string;
};

export type TechnicalProfileData = {
  primaryLimiter: string;
  strengths: string[];
  weaknesses: string[];
  cuesWork: TechnicalCue[];
  cuesFail: TechnicalCueFail[];
};

/* ─── Section 6: Movement Restrictions ──────────────────────────────── */

export type MovementRestrictionsData = {
  fullOverhead: boolean;
  fullHipRotation: boolean;
  deepSquat: boolean;
  singleLegStability: boolean;
  notes: string;
};

/* ─── ThrowsPR (from Prisma) ────────────────────────────────────────── */

export type ThrowsPRRecord = {
  id: string;
  event: string;
  implement: string;
  distance: number;
  achievedAt: string;
  source: string | null;
};

/* ─── ThrowsInjury (from Prisma) ────────────────────────────────────── */

export type ThrowsInjuryRecord = {
  id: string;
  injuryDate: string;
  returnToThrowDate: string | null;
  fullReturnDate: string | null;
  bodyPart: string;
  side: string | null;
  severity: string;
  type: string | null;
  throwsBanned: boolean;
  heavyBanned: boolean;
  strengthBanned: boolean;
  modifiedLoad: boolean;
  description: string | null;
  treatmentPlan: string | null;
  recovered: boolean;
  recoveredDate: string | null;
};

/* ─── ThrowsProfile (per-event enrollment) ──────────────────────────── */

export type ThrowsProfileSummary = {
  event: string;
  competitionPb: number | null;
  currentDistanceBand: string | null;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

export const LIFTS = [
  { key: "backSquat", label: "Back Squat" },
  { key: "frontSquat", label: "Front Squat" },
  { key: "snatch", label: "Snatch" },
  { key: "powerClean", label: "Power Clean" },
  { key: "benchPress", label: "Bench Press" },
] as const;

export const CLASS_STANDINGS = [
  { value: "FR", label: "FR" },
  { value: "SO", label: "SO" },
  { value: "JR", label: "JR" },
  { value: "SR", label: "SR" },
  { value: "GRAD", label: "Grad" },
  { value: "PRO", label: "Pro" },
] as const;

export const EVENTS_LIST = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

export const GENDERS_LIST = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_types.ts
git commit -m "feat: add shared types for athlete master profile tabs"
```

---

## Task 4: Server Component (page.tsx)

**Files:**
- Rewrite: `src/app/(dashboard)/athlete/profile/page.tsx` (currently 7 lines — a redirect)
- Create: `src/app/(dashboard)/athlete/profile/loading.tsx`

- [ ] **Step 1: Write the server component page**

```typescript
import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { ProfileTabs } from "./_profile-tabs";
import type {
  ProfileData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
  CompetitionGoalsMap,
  StrengthNumbersData,
  TechnicalProfileData,
  MovementRestrictionsData,
} from "./_types";

export default async function AthleteProfilePage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athleteBase = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athleteBase) redirect("/login");

  const athleteId = athleteBase.id;

  // Parallel data fetch
  const [profileRaw, throwsPRsRaw, injuriesRaw, throwsProfilesRaw] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        heightCm: true,
        weightKg: true,
        turnDirection: true,
        classStanding: true,
        gradYear: true,
        competitionGoals: true,
        strengthNumbers: true,
        technicalProfile: true,
        movementRestrictions: true,
        user: { select: { email: true } },
      },
    }),
    prisma.throwsPR.findMany({
      where: { athleteId },
      orderBy: { distance: "desc" },
      select: {
        id: true,
        event: true,
        implement: true,
        distance: true,
        achievedAt: true,
        source: true,
      },
    }),
    prisma.throwsInjury.findMany({
      where: { athleteId },
      orderBy: { injuryDate: "desc" },
      select: {
        id: true,
        injuryDate: true,
        returnToThrowDate: true,
        fullReturnDate: true,
        bodyPart: true,
        side: true,
        severity: true,
        type: true,
        throwsBanned: true,
        heavyBanned: true,
        strengthBanned: true,
        modifiedLoad: true,
        description: true,
        treatmentPlan: true,
        recovered: true,
        recoveredDate: true,
      },
    }),
    prisma.throwsProfile.findMany({
      where: { athleteId },
      select: {
        event: true,
        competitionPb: true,
        currentDistanceBand: true,
      },
    }),
  ]);

  if (!profileRaw) redirect("/login");

  // Serialize for client component
  const profile: ProfileData = {
    id: profileRaw.id,
    firstName: profileRaw.firstName,
    lastName: profileRaw.lastName,
    events: profileRaw.events,
    gender: profileRaw.gender,
    dateOfBirth: profileRaw.dateOfBirth?.toISOString().split("T")[0] ?? null,
    avatarUrl: profileRaw.avatarUrl,
    heightCm: profileRaw.heightCm,
    weightKg: profileRaw.weightKg,
    turnDirection: profileRaw.turnDirection,
    classStanding: profileRaw.classStanding,
    gradYear: profileRaw.gradYear,
    competitionGoals: (profileRaw.competitionGoals as CompetitionGoalsMap) ?? null,
    strengthNumbers: (profileRaw.strengthNumbers as StrengthNumbersData) ?? null,
    technicalProfile: (profileRaw.technicalProfile as TechnicalProfileData) ?? null,
    movementRestrictions: (profileRaw.movementRestrictions as MovementRestrictionsData) ?? null,
    email: profileRaw.user.email,
  };

  const throwsPRs: ThrowsPRRecord[] = throwsPRsRaw;
  const injuries: ThrowsInjuryRecord[] = injuriesRaw;
  const throwsProfiles: ThrowsProfileSummary[] = throwsProfilesRaw;

  return (
    <div className="max-w-2xl mx-auto">
      <ScrollProgressBar />
      <ProfileTabs
        profile={profile}
        throwsPRs={throwsPRs}
        injuries={injuries}
        throwsProfiles={throwsProfiles}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write loading skeleton**

```typescript
export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-spring-up">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="skeleton h-64 w-full rounded-xl" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Will show errors for missing `_profile-tabs.tsx` — expected. Verify no OTHER errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/page.tsx src/app/(dashboard)/athlete/profile/loading.tsx
git commit -m "feat: add server component and loading skeleton for athlete master profile

Parallel fetch from AthleteProfile, ThrowsPR, ThrowsInjury, ThrowsProfile.
Serializes all data and passes to ProfileTabs client component."
```

---

## Task 5: Icon Tab Bar + ProfileTabs Shell

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx`

- [ ] **Step 1: Build the icon tab bar and shell**

This is the main client component. It renders the icon tab bar and switches between tab content. Each tab component will be built in subsequent tasks — start with placeholder divs.

```typescript
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  User,
  Trophy,
  Scale,
  Dumbbell,
  Target,
  ShieldAlert,
} from "lucide-react";
import type {
  ProfileData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
} from "./_types";

const TABS = [
  { id: "core", label: "Core", icon: User },
  { id: "competition", label: "Comp", icon: Trophy },
  { id: "implements", label: "Impl", icon: Scale },
  { id: "strength", label: "Strength", icon: Dumbbell },
  { id: "technical", label: "Tech", icon: Target },
  { id: "injury", label: "Injury", icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  profile: ProfileData;
  throwsPRs: ThrowsPRRecord[];
  injuries: ThrowsInjuryRecord[];
  throwsProfiles: ThrowsProfileSummary[];
};

export function ProfileTabs({ profile, throwsPRs, injuries, throwsProfiles }: Props) {
  const [active, setActive] = useState<TabId>("core");

  return (
    <div className="space-y-6 animate-spring-up">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          My Profile
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Your complete athlete profile — training data, goals, and health.
        </p>
      </div>

      {/* Icon tab bar */}
      <div className="grid grid-cols-6 gap-1 p-1 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-all text-center",
                isActive
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]/50"
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] font-semibold leading-tight hidden min-[360px]:block",
                  isActive && "text-primary-600 dark:text-primary-400"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content — key forces remount for fade-in transition */}
      <div key={active} className="min-h-[400px] animate-fade-slide-in">
        {active === "core" && (
          <div className="card p-4 text-sm text-muted">Core Info — coming next</div>
        )}
        {active === "competition" && (
          <div className="card p-4 text-sm text-muted">Competition — coming next</div>
        )}
        {active === "implements" && (
          <div className="card p-4 text-sm text-muted">Implements — coming next</div>
        )}
        {active === "strength" && (
          <div className="card p-4 text-sm text-muted">Strength — coming next</div>
        )}
        {active === "technical" && (
          <div className="card p-4 text-sm text-muted">Technical — coming next</div>
        )}
        {active === "injury" && (
          <div className="card p-4 text-sm text-muted">Injury — coming next</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Visually verify in browser**

Navigate to `/athlete/profile`. Should see the page header, 6 icon tabs, and placeholder content. Tabs should switch on click. On mobile, labels should hide below 360px.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add icon tab bar shell for athlete master profile

6 Lucide icon tabs (Core, Comp, Impl, Strength, Tech, Injury) with
amber/gold active state. Labels hide on very small screens. Placeholder
content for each tab — real content in subsequent commits."
```

---

## Task 6: Tab 1 — Core Info

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-core.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Core Info form**

This is largely the existing settings form reorganized. Adds turnDirection and classStanding/gradYear.

Create `_tab-core.tsx` with:
- Name fields (first + last, 2-col on sm:)
- Class standing pill toggle + grad year
- Turn direction L/R toggle
- Events selectable cards
- Gender pill toggle
- Date of birth
- Height/weight (2-col on sm:)
- Save button using PATCH /api/athlete/profile
- Success/error feedback via useToast()

Key patterns to follow from existing `_form.tsx` in settings:
- `csrfHeaders()` for CSRF protection
- `useTransition` for pending state
- Same pill toggle pattern for gender/events
- Same input class: `className="input w-full"`

- [ ] **Step 2: Wire into ProfileTabs**

Replace the `core` placeholder in `_profile-tabs.tsx`:

```typescript
import { TabCore } from "./_tab-core";
// ...
{active === "core" && <TabCore profile={profile} />}
```

- [ ] **Step 3: Run typecheck and test in browser**

```bash
npx tsc --noEmit
```

Navigate to `/athlete/profile`, fill in fields, save. Verify toast shows success. Refresh page — data should persist.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-core.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Core Info tab to athlete master profile

Editable form for name, class standing, turn direction, events, gender,
DOB, height, weight. Per-tab save via PATCH /api/athlete/profile."
```

---

## Task 7: Tab 2 — Competition & Distance Bands

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-competition.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Competition tab**

Per-event collapsible cards (only for athlete's selected events). Each shows:
- Competition PR: distance + date + meet name inputs
- Season Best: distance + date + meet name inputs
- Season Goal + Career Goal: number inputs
- Current Distance Band: read-only from `throwsProfiles` prop (matched by event)
- Target Band: editable input

On mobile: cards stack and are collapsible (tap header to expand/collapse). On desktop: expanded by default.

Save writes to `competitionGoals` JSON field via PATCH.

- [ ] **Step 2: Wire into ProfileTabs**

```typescript
import { TabCompetition } from "./_tab-competition";
// ...
{active === "competition" && (
  <TabCompetition profile={profile} throwsProfiles={throwsProfiles} />
)}
```

- [ ] **Step 3: Run typecheck and test**

```bash
npx tsc --noEmit
```

Test: select events in Core tab, switch to Competition tab — should show cards for those events only. Fill in data, save, refresh, verify persistence.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-competition.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Competition & Distance Bands tab

Per-event collapsible cards with PR, season best, goals, and distance bands.
Current band read-only from ThrowsProfile, target band editable."
```

---

## Task 8: Tab 3 — Implement Performance (Read-Only)

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-implements.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Implements tab**

Read-only display of ThrowsPR data grouped by event. For each event:
- Table on desktop (implement weight, best distance, date, differential vs competition implement)
- Stacked cards on mobile
- **Descending order by implement weight** (heaviest first — Bondarchuk rule)
- Competition implement identified using `COMPETITION_WEIGHTS` from `src/lib/throws/constants.ts`
- Differential auto-calculated: `(pr.distance / competitionPR.distance) * 100`
- Color coding: green (85-100% ratio), amber (75-85%), red (<75% or >115%)
- Empty state via `<EmptyState>` component

Import `COMPETITION_WEIGHTS`, `EVENT_CODE_MAP`, `GENDER_CODE_MAP` from `@/lib/throws/constants`.

- [ ] **Step 2: Wire into ProfileTabs**

```typescript
import { TabImplements } from "./_tab-implements";
// ...
{active === "implements" && (
  <TabImplements
    throwsPRs={throwsPRs}
    events={profile.events}
    gender={profile.gender}
  />
)}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-implements.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Implement Performance tab (read-only)

Groups ThrowsPR records by event. Descending weight order. Auto-calculates
differentials vs competition implement with color-coded ratio compliance."
```

---

## Task 9: Tab 4 — Strength Numbers

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-strength.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Strength Numbers form**

- Lift cards for each of the 5 lifts (Back Squat, Front Squat, Snatch, Power Clean, Bench Press)
- Each card: current max (kg), date tested, goal (kg), correlation dropdown (STRONG/MODERATE/WEAK/UNKNOWN)
- Athletic tests section: Standing Long Jump (mm), Triple Jump (m)
- Auto-calculated S:BW ratios using `profile.weightKg`:
  - Squat/BW (target 2.0), Clean/BW (target 1.3), Snatch/BW (target 1.0)
  - Display as ProgressBar with target markers
  - Use `<NumberFlow>` for the live ratio values as lifts change
- Stacked cards on mobile, 2-col grid on `sm:`
- Save writes `strengthNumbers` JSON via PATCH

- [ ] **Step 2: Wire into ProfileTabs**

```typescript
import { TabStrength } from "./_tab-strength";
// ...
{active === "strength" && <TabStrength profile={profile} />}
```

- [ ] **Step 3: Run typecheck and test**

```bash
npx tsc --noEmit
```

Test: fill in squat max, verify S:BW ratio updates live. Save, refresh, verify persistence.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-strength.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Strength Numbers tab with live S:BW ratios

5 lift cards + athletic tests. Auto-calculated strength-to-bodyweight
ratios with progress bars and NumberFlow for live updates."
```

---

## Task 10: Tab 5 — Technical Profile (Read-Only)

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-technical.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Technical Profile tab**

Read-only display of `profile.technicalProfile` JSON:
- "Managed by your coach" badge at top (amber/gold small badge)
- Primary Limiter: callout card with amber border
- Strengths: green-tinted chips
- Weaknesses: numbered amber chips (1, 2, 3)
- Cues That Work: grouped by phase (Winds/Entry, Turns/Middle, Finish/Release), each in a card
- Cues That Don't Work: red-tinted cards
- Empty state: "Your coach hasn't set up your technical profile yet." via `<EmptyState>`

Use `<StaggeredList>` for the cues grid.

- [ ] **Step 2: Wire into ProfileTabs**

```typescript
import { TabTechnical } from "./_tab-technical";
// ...
{active === "technical" && <TabTechnical profile={profile} />}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-technical.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Technical Profile tab (read-only, coach-managed)

Displays primary limiter, strengths/weaknesses chips, and phase-grouped
cues. Shows 'Managed by your coach' badge and empty state."
```

---

## Task 11: Tab 6 — Injury & Health (Read-Only)

**Files:**
- Create: `src/app/(dashboard)/athlete/profile/_tab-injury.tsx`
- Modify: `src/app/(dashboard)/athlete/profile/_profile-tabs.tsx` (swap placeholder)

- [ ] **Step 1: Build the Injury & Health tab**

Read-only display from `ThrowsInjury[]` + `profile.movementRestrictions` JSON:

**Current Limitations** (injuries where `recovered === false`):
- Alert cards: bodyPart + side, severity, description
- Training impact from booleans: throwsBanned → "No throwing", heavyBanned → "No heavy implements", strengthBanned → "No strength work", modifiedLoad → "Modified load only"
- treatmentPlan if present
- Color: amber border for moderate, red for severe

**Injury History** (all injuries, most recent first):
- Timeline layout with dates, body part, severity, recovery dates
- Recovered entries in muted style

**Movement Restrictions Checklist:**
- 4 items with checkmark (emerald) or X (red): fullOverhead, fullHipRotation, deepSquat, singleLegStability
- Notes below if present

"Managed by your coach" badge at top. Empty state via `<EmptyState>`.

- [ ] **Step 2: Wire into ProfileTabs**

```typescript
import { TabInjury } from "./_tab-injury";
// ...
{active === "injury" && (
  <TabInjury injuries={injuries} profile={profile} />
)}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/profile/_tab-injury.tsx src/app/(dashboard)/athlete/profile/_profile-tabs.tsx
git commit -m "feat: add Injury & Health tab (read-only, coach-managed)

Current limitations with training impact flags, injury history timeline,
and movement restrictions checklist. Coach-managed with empty states."
```

---

## Task 12: Final Verification

**Files:** None new — verification pass.

- [ ] **Step 1: Run full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Test all 6 tabs end-to-end**

1. Log in as athlete (athlete1@example.com / athlete123)
2. Navigate to `/athlete/profile`
3. **Tab 1 (Core):** Fill name, class standing, turn direction, events, gender, DOB, height, weight. Save. Refresh. Verify persistence.
4. **Tab 2 (Competition):** Fill competition PR, season best, goals for each event. Save. Refresh. Verify.
5. **Tab 3 (Implements):** Verify ThrowsPR data displays (may be empty for seed data). Check empty state.
6. **Tab 4 (Strength):** Fill lift maxes. Verify S:BW ratios update live. Save. Refresh.
7. **Tab 5 (Technical):** Verify empty state shows. (No coach data yet.)
8. **Tab 6 (Injury):** Verify empty state shows. (No injury data yet.)
9. Test mobile viewport (375px) — all tabs should work, labels hide below 360px.

- [ ] **Step 4: Check that /athlete/settings still works**

Navigate to `/athlete/settings` — should still show the settings form with Whoop integration. Both pages should work during the transition.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "fix: cleanup from final verification pass"
```

Only commit if there are actual changes. Skip if clean.
