# Coach Training Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to toggle between Coach Mode and Training Mode, where Training Mode gives them the full athlete experience via a real AthleteProfile — eliminating all duplicate coach self-training code.

**Architecture:** Add `trainingEnabled` to CoachProfile, `isSelfCoached` to AthleteProfile, `activeMode` to User. Relax middleware + athlete layout auth to allow coaches in Training Mode. Delete ~35 files of coach self-training pages + APIs. Add mode toggle to sidebar. Enhance roster enrollment auto-populate.

**Tech Stack:** Next.js 14.2 App Router, Prisma ORM (PostgreSQL), existing athlete pages and data models.

**Spec:** `docs/superpowers/specs/2026-03-20-coach-training-mode-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/api/user/mode/route.ts` | PUT — toggle activeMode + set cookie |
| `src/app/api/coach/training-mode/route.ts` | POST — enable Training Mode (create AthleteProfile) |
| `src/components/ui/ModeToggle.tsx` | Sidebar mode toggle widget (Coach/Training segmented control) |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `trainingEnabled`, `isSelfCoached`, `activeMode` fields |
| `src/middleware.ts` | Allow coaches with Training Mode to access `/athlete/*` routes |
| `src/app/(dashboard)/athlete/layout.tsx` | Allow COACH role with Training Mode |
| `src/lib/data/athlete.ts` | Relax `requireAthleteSession()` for coaches |
| `src/components/layout/DashboardLayout.tsx` | Mode-aware nav selection + pass mode to sidebar |
| `src/components/ui/Sidebar.tsx` | Remove my-* nav items, render ModeToggle, add mode to DashboardUser |
| `src/app/api/coach/athletes/route.ts` | Exclude `isSelfCoached` from plan limit count |
| `src/app/api/invitations/route.ts` | Exclude `isSelfCoached` from plan limit count |
| `src/app/api/auth/register/route.ts` | Exclude `isSelfCoached` from plan limit count |
| `src/app/api/throws/podium-roster/route.ts` | Enhanced auto-populate with best marks scan |
| `src/app/(dashboard)/coach/throws/roster/page.tsx` | Enhanced auto-import UI |

### Deleted Files (~46 files)
| Directory | Contents |
|-----------|----------|
| `src/app/(dashboard)/coach/my-training/` | 8 files — sessions, insights, records, typing tabs |
| `src/app/(dashboard)/coach/my-lifting/` | 10 files — lifting program + workout logging |
| `src/app/(dashboard)/coach/my-program/` | 17 files — Bondarchuk program + 14 components |
| `src/app/(dashboard)/coach/my-throws/` | 1 file — redirect (already dead) |
| `src/app/api/coach/my-training/` | 6 files — testing, PRs, typing, volume, analysis |
| `src/app/api/coach/my-program/` | 5 files — program gen, onboarding, analytics |

---

### Task 1: Schema Migration — Add Training Mode Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Migration file

- [ ] **Step 1: Update schema.prisma**

Add to `User` model:
```prisma
  activeMode  String  @default("COACH")  // "COACH" | "TRAINING"
```

Add to `CoachProfile` model:
```prisma
  trainingEnabled  Boolean  @default(false)
```

Add to `AthleteProfile` model:
```prisma
  isSelfCoached  Boolean  @default(false)
```

- [ ] **Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name add_coach_training_mode
npx prisma generate
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add trainingEnabled, isSelfCoached, activeMode schema fields"
```

---

### Task 2: Mode Toggle API + Training Mode Activation

**Files:**
- Create: `src/app/api/user/mode/route.ts`
- Create: `src/app/api/coach/training-mode/route.ts`

- [ ] **Step 1: Create mode toggle endpoint**

Create `src/app/api/user/mode/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode } = await req.json();
    if (mode !== "COACH" && mode !== "TRAINING") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Only coaches can switch modes
    if (session.role !== "COACH") {
      return NextResponse.json({ error: "Only coaches can switch modes" }, { status: 403 });
    }

    // If switching to training, verify trainingEnabled
    if (mode === "TRAINING") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { trainingEnabled: true },
      });
      if (!coach?.trainingEnabled) {
        return NextResponse.json({ error: "Training mode not enabled" }, { status: 403 });
      }
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { activeMode: mode },
    });

    const response = NextResponse.json({ ok: true });
    // Set cookie for middleware to read without DB call
    response.cookies.set("active-mode", mode, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to update mode" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create training mode activation endpoint**

Create `src/app/api/coach/training-mode/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, firstName: true, lastName: true, events: true, trainingEnabled: true },
    });
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    if (coach.trainingEnabled) {
      return NextResponse.json({ error: "Training mode already enabled" }, { status: 400 });
    }

    // Create AthleteProfile for the coach (self-coached)
    const athlete = await prisma.athleteProfile.create({
      data: {
        userId: session.userId,
        coachId: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        events: coach.events,
        gender: "OTHER",
        isSelfCoached: true,
      },
    });

    // Enable training mode on coach profile
    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: { trainingEnabled: true },
    });

    // Set active mode to TRAINING
    await prisma.user.update({
      where: { id: session.userId },
      data: { activeMode: "TRAINING" },
    });

    // Auto-enroll in throws roster if coach has events
    if (coach.events.length > 0) {
      const eventMap: Record<string, string> = { SHOT_PUT: "SP", DISCUS: "DT", HAMMER: "HT", JAVELIN: "JT" };
      const genderMap: Record<string, string> = { MALE: "M", FEMALE: "F" };
      // Create ThrowsProfile (auto-enrollment)
      const firstEvent = eventMap[coach.events[0]] || "SP";
      await prisma.throwsProfile.create({
        data: {
          athleteId: athlete.id,
          enrolledBy: coach.id,
          event: firstEvent,
          gender: genderMap[/* coach gender if available */] || "M",
          status: "active",
        },
      }).catch(() => {
        // Silently skip if ThrowsProfile already exists or schema doesn't support it
      });
    }

    const response = NextResponse.json({ ok: true, data: { athleteId: athlete.id } }, { status: 201 });
    response.cookies.set("active-mode", "TRAINING", {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Failed to enable training mode" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/mode/ src/app/api/coach/training-mode/
git commit -m "feat: add mode toggle API and training mode activation endpoint"
```

---

### Task 3: Auth Relaxation — Middleware + Athlete Layout + requireAthleteSession

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/app/(dashboard)/athlete/layout.tsx`
- Modify: `src/lib/data/athlete.ts`

- [ ] **Step 1: Update middleware**

In `src/middleware.ts`, find the block (around line 69):
```typescript
if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
  response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
}
```

Replace with:
```typescript
if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
  // Allow coaches with Training Mode to access athlete routes
  const activeMode = request.cookies.get("active-mode")?.value;
  if (payload.role !== "COACH" || activeMode !== "TRAINING") {
    response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
  }
}
```

Also add a cookie sync safeguard later in the middleware (after the response is determined). If the user is a COACH and `active-mode` cookie is missing, query `User.activeMode` from the DB and re-set the cookie. This prevents cookie loss (browser clear, incognito) from locking coaches out. Since middleware CAN set cookies on the response, do it here:
```typescript
// Cookie sync: if COACH and no active-mode cookie, set it from DB
if (payload?.role === "COACH" && !request.cookies.has("active-mode")) {
  // Import prisma edge client or use a lightweight DB call
  // Set response cookie: response.cookies.set("active-mode", dbMode, {...})
}
```
Note: If the edge middleware can't import Prisma (edge runtime), fall back to defaulting the cookie to "COACH" when missing. The PUT /api/user/mode endpoint always sets it, so it only goes missing on cookie clear — defaulting to COACH is safe (coach can re-toggle).

- [ ] **Step 2: Update athlete layout**

In `src/app/(dashboard)/athlete/layout.tsx`, replace:
```typescript
if (!session || session.role !== "ATHLETE") redirect("/login");
```

With:
```typescript
if (!session) redirect("/login");
const isCoachTraining = session.role === "COACH";
if (session.role !== "ATHLETE" && !isCoachTraining) redirect("/login");
```

Also update the `athleteProfile` query — if no athlete profile found and user is a coach, redirect to `/coach/dashboard` instead of `/login`:
```typescript
if (!athlete) {
  redirect(isCoachTraining ? "/coach/dashboard" : "/login");
}
```

Update the DashboardUser construction to pass mode info:
```typescript
const user: DashboardUser = {
  name: `${athlete.firstName} ${athlete.lastName}`,
  email: athlete.user.email,
  role: session.role as "COACH" | "ATHLETE",
  avatarUrl: athlete.avatarUrl ?? undefined,
  activeMode: isCoachTraining ? "TRAINING" : undefined,
  trainingEnabled: isCoachTraining,
};
```

Also in the layout, read `User.activeMode` from the DB and re-set the cookie if it's missing (sync safeguard):
```typescript
if (isCoachTraining) {
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { activeMode: true },
  });
  // Cookie sync will be handled by the response (cookies can't be set in server components,
  // but middleware handles the cookie-based check — the DB is the source of truth here)
}
```

- [ ] **Step 3: Update requireAthleteSession**

In `src/lib/data/athlete.ts`, in the `requireAthleteSession` function, replace:
```typescript
if (!session || session.role !== "ATHLETE") redirect("/login");
```

With:
```typescript
if (!session) redirect("/login");
if (session.role !== "ATHLETE" && session.role !== "COACH") redirect("/login");
```

The rest of the function works unchanged — `findUnique({ where: { userId } })` finds the coach's AthleteProfile since it shares the same userId.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts "src/app/(dashboard)/athlete/layout.tsx" src/lib/data/athlete.ts
git commit -m "feat: allow coaches with Training Mode to access athlete routes"
```

---

### Task 4: Sidebar Mode Toggle + DashboardLayout Updates

**Files:**
- Create: `src/components/ui/ModeToggle.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx`
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Create ModeToggle component**

Create `src/components/ui/ModeToggle.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

interface ModeToggleProps {
  activeMode: "COACH" | "TRAINING";
  className?: string;
}

export function ModeToggle({ activeMode, className }: ModeToggleProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(mode: "COACH" | "TRAINING") {
    if (mode === activeMode || switching) return;
    setSwitching(true);
    try {
      await fetch("/api/user/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode }),
      });
      router.push(mode === "COACH" ? "/coach/dashboard" : "/athlete/dashboard");
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className={cn("flex rounded-xl bg-[var(--muted-bg)] p-1 gap-1", className)}>
      {(["COACH", "TRAINING"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => handleSwitch(mode)}
          disabled={switching}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
            activeMode === mode
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-card"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          {mode === "COACH" ? "Coach" : "Training"}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update DashboardUser type + DashboardLayout**

In `src/components/layout/DashboardLayout.tsx`, add to the `DashboardUser` type:
```typescript
export interface DashboardUser {
  // ... existing fields
  activeMode?: string;      // "COACH" | "TRAINING"
  trainingEnabled?: boolean;
}
```

Update nav selection:
```typescript
const isTrainingMode = user.role === "COACH" && user.activeMode === "TRAINING";
const baseSections =
  navSections ??
  (isTrainingMode
    ? ATHLETE_NAV_SECTIONS
    : user.role === "COACH"
      ? COACH_NAV_SECTIONS
      : ATHLETE_NAV_SECTIONS);
```

Pass `trainingEnabled` and `activeMode` to the Sidebar component.

- [ ] **Step 3: Update Sidebar**

In `src/components/ui/Sidebar.tsx`:

1. Remove these nav items from `COACH_NAV_SECTIONS` Training group children:
   - `My Training` (`/coach/my-training`)
   - `My Lifting` (`/coach/my-lifting`)
   - `My Throws` (`/coach/my-throws`)
   - `My Program` (`/coach/my-program`)

2. Remove `/coach/my-training`, `/coach/my-lifting`, `/coach/my-throws`, `/coach/my-program` from the Training parent `matchPaths`.

3. Import and render `<ModeToggle>` in the sidebar header area (below user name/avatar), only when `trainingEnabled === true`. Pass `activeMode` prop.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ModeToggle.tsx src/components/layout/DashboardLayout.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: add mode toggle to sidebar, remove my-* nav items"
```

---

### Task 5: Delete Coach Self-Training Pages + API Routes

**Files:**
- Delete: 4 page directories + 2 API directories (~46 files)
- Create: Redirect pages for deleted routes

- [ ] **Step 1: Delete page directories**

```bash
rm -rf "src/app/(dashboard)/coach/my-training"
rm -rf "src/app/(dashboard)/coach/my-lifting"
rm -rf "src/app/(dashboard)/coach/my-program"
rm -rf "src/app/(dashboard)/coach/my-throws"
```

- [ ] **Step 2: Create redirect pages**

Create `src/app/(dashboard)/coach/my-training/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function MyTrainingRedirect() {
  redirect("/athlete/dashboard");
}
```

Create `src/app/(dashboard)/coach/my-lifting/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function MyLiftingRedirect() {
  redirect("/athlete/dashboard");
}
```

Create `src/app/(dashboard)/coach/my-program/page.tsx`:
```typescript
import { redirect } from "next/navigation";
export default function MyProgramRedirect() {
  redirect("/athlete/dashboard");
}
```

- [ ] **Step 3: Delete API directories**

```bash
rm -rf "src/app/api/coach/my-training"
rm -rf "src/app/api/coach/my-program"
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

Run `grep -rn "my-training\|my-lifting\|my-program\|CoachTraining\|coach-training" src/ --include="*.ts" --include="*.tsx"` to find orphaned references. Fix any import errors. If any shared components from `my-program/_components/` are imported by files outside that directory, keep those specific files and move them to a shared location.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete coach self-training pages and APIs, add redirects"
```

---

### Task 6: Plan Limit Exclusion for Self-Coached Athletes

**Files:**
- Modify: `src/app/api/coach/athletes/route.ts`
- Modify: `src/app/api/invitations/route.ts`
- Modify: `src/lib/data/coach.ts` (if athlete counts are computed there)

- [ ] **Step 1: Update athletes route plan limit check**

In `src/app/api/coach/athletes/route.ts`, find:
```typescript
const athleteCount = await prisma.athleteProfile.count({
  where: { coachId: coach.id },
});
```

Replace with:
```typescript
const athleteCount = await prisma.athleteProfile.count({
  where: { coachId: coach.id, isSelfCoached: false },
});
```

- [ ] **Step 2: Update invitations route plan limit check**

In `src/app/api/invitations/route.ts`, find the `_count: { select: { athletes: true } }` pattern. This counts ALL athletes. Add a separate count query:

Replace the `coach._count.athletes >= limit` check with:
```typescript
const realAthleteCount = await prisma.athleteProfile.count({
  where: { coachId: coach.id, isSelfCoached: false },
});
if (limit !== Infinity && realAthleteCount >= limit) { ... }
```

- [ ] **Step 3: Update register route plan limit check**

In `src/app/api/auth/register/route.ts`, find the `_count: { select: { athletes: true } }` pattern and add a separate count query with `isSelfCoached: false`, same as the invitations fix.

- [ ] **Step 4: Check coach.ts data layer**

Search `src/lib/data/coach.ts` for any `athleteProfile.count` or `_count.athletes` patterns and add `isSelfCoached: false` filter where plan limits are checked.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/coach/athletes/route.ts src/app/api/invitations/route.ts src/app/api/auth/register/route.ts src/lib/data/coach.ts
git commit -m "fix: exclude self-coached athletes from plan limit counts"
```

---

### Task 7: Roster Enrollment Auto-Populate Enhancement

**Files:**
- Modify: `src/app/api/throws/podium-roster/route.ts`
- Modify: `src/app/(dashboard)/coach/throws/roster/page.tsx`

- [ ] **Step 1: Enhance enrollment API**

In `src/app/api/throws/podium-roster/route.ts` POST handler, after creating the ThrowsProfile, add a best marks scan:

```typescript
// After creating ThrowsProfile, scan for existing best marks
const bestMarks = await prisma.throwLog.groupBy({
  by: ["event", "implementWeight"],
  where: { athleteId: body.athleteId },
  _max: { distance: true },
});

// Also check AthleteThrowsSession drill logs
const drillBests = await prisma.athleteDrillLog.groupBy({
  by: ["drillType"],
  where: {
    session: { athleteId: body.athleteId },
    bestMark: { not: null },
  },
  _max: { bestMark: true },
});
```

Use the best competition-weight mark to populate `competitionPb` on the ThrowsProfile if the coach didn't provide one. Also pull `heightCm`, `weightKg`, `dateOfBirth` from AthleteProfile and store on ThrowsProfile if the schema supports it (or include in the response for the UI to display).

- [ ] **Step 2: Enhance roster page auto-import**

In `src/app/(dashboard)/coach/throws/roster/page.tsx`, in the `handleEnrollAthleteChange` function, enhance the auto-import to also show:
- Height/weight from AthleteProfile
- Number of existing PRs found
- A small info badge: "Auto-imported from profile" when data was pulled

The existing auto-import logic (lines 228-252) already handles events, gender, and best PR. Enhance it to fetch more data points from the athlete's profile.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/throws/podium-roster/route.ts "src/app/(dashboard)/coach/throws/roster/page.tsx"
git commit -m "feat: enhance roster enrollment with auto-populate from athlete profile + best marks scan"
```

---

### Task 8: Final Verification + Cleanup

**Files:**
- Verify all files compile and lint clean

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `npx next lint`
Expected: 0 new errors

- [ ] **Step 3: Verify auth flow**

Check that:
- Middleware allows coaches with `active-mode=TRAINING` cookie to access `/athlete/*` routes
- Athlete layout allows `session.role === "COACH"` through
- `requireAthleteSession()` allows COACH role
- Athlete pages can find the coach's AthleteProfile via `findUnique({ where: { userId } })`

- [ ] **Step 4: Verify sidebar**

Check that:
- My Training, My Lifting, My Throws, My Program nav items are gone from `COACH_NAV_SECTIONS`
- ModeToggle renders when `trainingEnabled === true`
- Switching mode navigates to correct dashboard

- [ ] **Step 5: Verify plan limits**

Check that all athlete count queries include `isSelfCoached: false`:
- `src/app/api/coach/athletes/route.ts`
- `src/app/api/invitations/route.ts`
- Any other locations in `src/lib/data/coach.ts`

- [ ] **Step 6: Check for orphaned references to dormant models**

Verify `CoachThrowsSession`, `CoachDrillLog`, `CoachPR`, `CoachTyping`, `CoachTestingRecord` models still exist in schema but have zero code references in `src/` (all pages/APIs that used them are deleted).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Coach Training Mode — complete implementation"
```
