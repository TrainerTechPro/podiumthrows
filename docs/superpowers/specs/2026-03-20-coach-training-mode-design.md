# Coach Training Mode — Design Spec

## Goal

Allow coaches who also train themselves to toggle between Coach Mode and Training Mode within a single account. In Training Mode, the coach sees the full athlete experience — same pages, same data models, same flows — eliminating duplicate self-training code and consolidating all training to the athlete path.

## Architecture

A coach enables Training Mode, which creates an `AthleteProfile` linked to their same `User` account (self-coached: `coachId` = own CoachProfile). The `User.activeMode` field persists the current mode. In Training Mode, the coach navigates to `/athlete/*` routes — the existing athlete pages handle everything. Middleware is relaxed to allow coaches with Training Mode to access athlete routes. All coach-specific self-training pages and APIs are deleted.

## Tech Stack

- Prisma schema changes (3 field additions, 1 constraint change)
- Next.js 14.2 middleware update
- Sidebar mode toggle (client component)
- Deletion of ~35 files of coach self-training code
- Enhancement to roster enrollment auto-populate

---

## 1. Data Model

### 1.1 Schema Changes

**User model** — add mode persistence:
```prisma
model User {
  // ... existing fields ...
  activeMode  String  @default("COACH")  // "COACH" | "TRAINING"
}
```

**CoachProfile** — add training feature flag:
```prisma
model CoachProfile {
  // ... existing fields ...
  trainingEnabled  Boolean  @default(false)
}
```

**AthleteProfile** — mark self-coached profiles:
```prisma
model AthleteProfile {
  // ... existing fields ...
  userId    String    @unique   // KEEP @unique — a User can already have both a CoachProfile AND an AthleteProfile since they are separate FK columns
  isSelfCoached  Boolean  @default(false)
}
```

The `@unique` constraint stays. A User can already have both a `CoachProfile` (via `CoachProfile.userId @unique`) and an `AthleteProfile` (via `AthleteProfile.userId @unique`) simultaneously — they are independent 1:1 relations on separate models. No schema constraint prevents dual profiles. The only change is adding the `isSelfCoached` column.

### 1.2 Training Mode Activation

When a coach enables Training Mode (via settings toggle or first-time prompt):

1. Set `CoachProfile.trainingEnabled = true`
2. Create an `AthleteProfile`:
   - `userId` = coach's userId
   - `coachId` = coach's CoachProfile.id (self-coached)
   - `firstName` = CoachProfile.firstName
   - `lastName` = CoachProfile.lastName
   - `events` = CoachProfile.events (copy EventType[])
   - `gender` = `"OTHER"` (default — coach updates in settings later; matches existing registration pattern)
   - `isSelfCoached` = true
3. Set `User.activeMode = "TRAINING"` (starts them in Training Mode immediately)
4. The coach now appears on their own roster with a "You" badge

### 1.3 Subscription Limit Exclusion

When counting athletes for plan limits (FREE=3, PRO=25, ELITE=unlimited), the query must exclude `isSelfCoached = true`:

```typescript
const athleteCount = await prisma.athleteProfile.count({
  where: { coachId, isSelfCoached: false },
});
```

Update ALL locations where athlete counts are computed for plan limit checks:
- `src/lib/data/coach.ts` — main athlete count functions
- `src/app/api/coach/athletes/route.ts` — raw `count({ where: { coachId } })` check
- `src/app/api/invitations/route.ts` — `_count: { select: { athletes: true } }` pattern
- `src/app/api/auth/register/route.ts` — same `_count` pattern

All must add `isSelfCoached: false` to the where clause.

---

## 2. Mode Toggle & Routing

### 2.1 Mode Toggle API

New endpoint: `PUT /api/user/mode`

```typescript
Body: { mode: "COACH" | "TRAINING" }
Response: { ok: true }
```

Updates `User.activeMode`. Validates that `mode === "TRAINING"` is only allowed when `CoachProfile.trainingEnabled === true`.

### 2.2 Middleware Changes

File: `src/middleware.ts`

Current behavior (line ~65):
```typescript
if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
  response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
}
```

New behavior:
```typescript
if (pathname.startsWith("/athlete") && payload.role !== "ATHLETE") {
  // Allow coaches with Training Mode to access athlete routes
  if (payload.role === "COACH") {
    // Check activeMode from the JWT or a cookie
    const mode = request.cookies.get("active-mode")?.value;
    if (mode !== "TRAINING") {
      response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
    }
    // If mode === "TRAINING", allow through
  } else {
    response = NextResponse.redirect(new URL("/coach/dashboard", request.url));
  }
}
```

**Mode cookie**: The `PUT /api/user/mode` endpoint sets an `active-mode` cookie (non-HttpOnly, SameSite=Strict) so the middleware can read it without a database call. The cookie value mirrors `User.activeMode`.

**Cookie sync safeguard**: The `active-mode` cookie is an optimization for middleware — the source of truth is `User.activeMode` in the database. If the cookie is missing or cleared (incognito, browser clear), the athlete layout (server component) reads `User.activeMode` from the DB and re-sets the cookie via a response header. This prevents a coach in Training Mode from being locked out of athlete routes after a cookie loss.

### 2.3 DashboardLayout Changes

File: `src/components/layout/DashboardLayout.tsx`

Current logic (line ~266):
```typescript
const baseSections = user.role === "COACH" ? COACH_NAV_SECTIONS : ATHLETE_NAV_SECTIONS;
```

New logic:
```typescript
const isTrainingMode = user.role === "COACH" && user.activeMode === "TRAINING";
const baseSections = isTrainingMode ? ATHLETE_NAV_SECTIONS : (user.role === "COACH" ? COACH_NAV_SECTIONS : ATHLETE_NAV_SECTIONS);
```

The `DashboardUser` type needs `activeMode?: string` and `trainingEnabled?: boolean` added.

### 2.4 Sidebar Mode Toggle Widget

In the sidebar (below the user avatar/name area), render a segmented control when `trainingEnabled === true`:

```
[ Coach | Training ]
```

- Styled like the existing `_mode-selector.tsx` in the dashboard (segmented pill buttons)
- Calls `PUT /api/user/mode` on toggle
- Sets the `active-mode` cookie
- Calls `router.push("/coach/dashboard")` or `router.push("/athlete/dashboard")` based on selection
- In Training Mode, the coach name displays with a small "Training" badge

### 2.5 Athlete Page Auth — requireAthleteSession

File: `src/lib/data/athlete.ts`

The `requireAthleteSession()` function fetches `AthleteProfile` by `userId`. Since the coach now has an AthleteProfile (created during activation), this function will find it and return it. No changes needed to this function.

However, the function currently checks `session.role === "ATHLETE"`. This needs to be relaxed:
```typescript
// Current:
if (!session || session.role !== "ATHLETE") redirect("/login");

// New:
if (!session) redirect("/login");
if (session.role !== "ATHLETE" && session.role !== "COACH") redirect("/login");
// If COACH, verify they have Training Mode enabled + an AthleteProfile exists
```

**Also update `src/app/(dashboard)/athlete/layout.tsx`** — this layout has its own independent `session.role !== "ATHLETE"` guard (line ~12) that runs on every athlete page load. Apply the same relaxation here, or the middleware fix alone won't be enough. Both the layout guard and `requireAthleteSession()` must allow `COACH` role with Training Mode.

---

## 3. Code Removal

### 3.1 Pages to Delete

| Directory | File Count | Purpose |
|-----------|-----------|---------|
| `src/app/(dashboard)/coach/my-training/` | 8 files | Session logging, insights, records, typing |
| `src/app/(dashboard)/coach/my-lifting/` | 10 files | Lifting program view + workout logging |
| `src/app/(dashboard)/coach/my-program/` | 16 files | Bondarchuk program generation + analytics |
| `src/app/(dashboard)/coach/my-throws/` | 1 file | Already a redirect |

**Total: ~35 files deleted.**

Replace each directory's `page.tsx` with a redirect:
```typescript
import { redirect } from "next/navigation";
export default function MyTrainingRedirect() {
  redirect("/athlete/dashboard");
}
```

Or delete entirely and let 404 handling catch it (simpler, less maintenance).

### 3.2 API Routes to Delete

| Directory | Purpose |
|-----------|---------|
| `src/app/api/coach/my-training/` | Testing records, PRs, typing, volume, analysis |
| `src/app/api/coach/my-program/` | Program generation, onboarding, analytics |

### 3.3 Sidebar Nav Items to Remove

Remove from `COACH_NAV_SECTIONS` in `src/components/ui/Sidebar.tsx`:
- "My Training" (`/coach/my-training`)
- "My Lifting" (`/coach/my-lifting`)
- "My Throws" (`/coach/my-throws`)
- "My Program" (`/coach/my-program`)

Also remove these paths from the Training parent's `matchPaths` array.

### 3.4 Schema Models — Keep for Now

These models remain in `prisma/schema.prisma` but are no longer referenced by any code:
- `CoachThrowsSession`, `CoachDrillLog`
- `CoachPR`
- `CoachTyping`
- `CoachTestingRecord`

Reason: Existing coaches may have training data in these tables. A future data migration can move records to their AthleteProfile's standard models. Deleting the tables now would lose data.

---

## 4. Roster Enrollment Auto-Populate

### 4.1 Problem

When a coach enrolls an athlete into the Podium throws roster, the `ThrowsProfile` is created with minimal data even though `AthleteProfile` already has gender, events, height, weight, and throw history.

### 4.2 Fix — Enhanced Auto-Import at Enrollment

**API change**: Modify `POST /api/throws/podium-roster` to:

1. **Pull profile data** from `AthleteProfile`:
   - `gender` → map MALE→"M", FEMALE→"F"
   - `events` → map EventType[] to EventCode[] (SHOT_PUT→"SP", DISCUS→"DT", HAMMER→"HT", JAVELIN→"JT")
   - `heightCm`, `weightKg` → pass through
   - `dateOfBirth` → pass through for age-class weight lookups

2. **Scan for best marks** across existing throw data:
   - Query `ThrowLog` for best distance per event+implement
   - Query `AthleteThrowsSession` drill logs for best marks
   - Query `ThrowsBlockLog` for best distances
   - Use the highest mark at competition weight as `competitionPb`

3. **Pre-populate the enrollment form** (client-side):
   - When the coach selects an athlete in the enrollment dropdown, fetch their profile + best marks
   - Auto-fill gender, events, competition PB
   - Show "N PRs found" indicator
   - Coach can still override any auto-filled value

### 4.3 Self-Coached Enrollment

When a coach enables Training Mode and their AthleteProfile is created, they are auto-added to their own roster. The enrollment auto-populate pulls from their CoachProfile (events, name). Any existing `CoachPR` data is shown as reference ("You have N marks from your previous training log") but NOT auto-migrated — the coach starts fresh in the athlete system.

---

## 5. What We're NOT Building (YAGNI)

- No data migration from CoachThrowsSession to athlete models (future follow-up)
- No cross-coach athlete scenario (self-coached only)
- No separate Training Mode dashboard (uses real athlete dashboard)
- No changes to athlete-facing pages (they already work)
- No subscription/billing changes (self-coached doesn't count toward limits)
- No Training Mode settings page (simple toggle in sidebar)
- No schema model deletion (dormant models stay until data migration)

---

## 6. Migration Strategy

Single migration: `add-coach-training-mode`

```sql
-- Add activeMode to User
ALTER TABLE "User" ADD COLUMN "activeMode" TEXT NOT NULL DEFAULT 'COACH';

-- Add trainingEnabled to CoachProfile
ALTER TABLE "CoachProfile" ADD COLUMN "trainingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add isSelfCoached to AthleteProfile
ALTER TABLE "AthleteProfile" ADD COLUMN "isSelfCoached" BOOLEAN NOT NULL DEFAULT false;
```

No data loss. All existing profiles preserved. The `@unique` on `AthleteProfile.userId` stays — it already allows a User to have both profiles since CoachProfile and AthleteProfile are independent models.
