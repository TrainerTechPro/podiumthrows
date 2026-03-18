# Coach-Created Athlete Profiles & Event Filtering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches create athlete profiles before athletes sign up, log limited session data on their behalf, send invite links for athletes to claim accounts, and filter all UIs to only show the user's selected throwing events.

**Architecture:** Placeholder User pattern — coach creates a real User+AthleteProfile with no password and `claimedAt: null`. All existing roster/session APIs work immediately. Athlete claims via invite link, confirms profile, sets credentials. Event filtering added via `allowedEvents` prop on shared LogSessionWizard component.

**Tech Stack:** Next.js 14.2, React 18, TypeScript, Prisma ORM, PostgreSQL, bcrypt, JWT auth

**Spec:** `docs/superpowers/specs/2026-03-17-coach-athlete-profiles-event-filtering-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| MODIFY | `prisma/schema.prisma` | Add claimedAt to User, events to CoachProfile, athleteProfileId to Invitation, loggedByCoach to AthleteThrowsSession, make passwordHash nullable |
| CREATE | `src/app/api/coach/athletes/route.ts` | POST (create placeholder athlete), GET (list roster with claim status) |
| CREATE | `src/app/api/coach/athletes/[athleteId]/sessions/route.ts` | POST (coach logs limited session for athlete) |
| CREATE | `src/app/api/invitations/verify/route.ts` | GET (verify invite token, return linked profile) |
| CREATE | `src/app/api/auth/register-claim/route.ts` | POST (athlete claims placeholder account) |
| MODIFY | `src/app/api/invitations/route.ts` | Accept athleteProfileId in POST |
| MODIFY | `src/app/api/auth/login/route.ts` | Reject users with null passwordHash |
| MODIFY | `src/app/(dashboard)/athlete/log-session/_log-session-wizard.tsx` | Add allowedEvents + limitedMode props |
| MODIFY | `src/app/(dashboard)/coach/throws/roster/page.tsx` | Add "Add Athlete" form, unclaimed badges, invite buttons |
| MODIFY | `src/app/(auth)/register/page.tsx` | Add claim flow branch when invite has athleteProfileId |
| MODIFY | `src/app/(dashboard)/coach/log-session/page.tsx` | Pass coach's events to wizard |
| MODIFY | `src/app/(dashboard)/athlete/log-session/page.tsx` | Pass athlete's events to wizard |

---

## Chunk 1: Schema & Core APIs

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to schema**

Add `claimedAt` and make `passwordHash` nullable on User (line ~130):
```prisma
passwordHash String?   // null for unclaimed placeholder users
claimedAt    DateTime? // null = coach-created placeholder, set when athlete claims
```

Add `events` to CoachProfile (after line ~165):
```prisma
events EventType[] @default([])
```

Add `athleteProfileId` and relation to Invitation (after line ~773):
```prisma
athleteProfileId String?
athleteProfile   AthleteProfile? @relation(fields: [athleteProfileId], references: [id])
```

Add reverse relation on AthleteProfile (after the existing relations, ~line 237):
```prisma
invitations Invitation[]
```

Add `loggedByCoach` to AthleteThrowsSession (after line ~1293):
```prisma
loggedByCoach Boolean @default(false)
```

- [ ] **Step 2: Generate Prisma client and verify**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Push schema to local DB**

```bash
POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx prisma db push
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add claimedAt, coach events, invitation athleteProfileId, loggedByCoach"
```

---

### Task 2: POST /api/coach/athletes — create placeholder athlete

**Files:**
- Create: `src/app/api/coach/athletes/route.ts`

- [ ] **Step 1: Create the route with POST and GET handlers**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { randomUUID } from "crypto";

/* ── POST — coach creates a placeholder athlete profile ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, plan: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, events } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }
    const validEvents = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
    if (!events.every((e: string) => validEvents.includes(e))) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    // Check plan limits
    const athleteCount = await prisma.athleteProfile.count({
      where: { coachId: coach.id },
    });
    const limit = PLAN_LIMITS[coach.plan as keyof typeof PLAN_LIMITS]?.athletes ?? 3;
    if (athleteCount >= limit) {
      return NextResponse.json(
        { error: `Your ${coach.plan} plan supports up to ${limit} athletes. Upgrade to add more.` },
        { status: 403 }
      );
    }

    // Create placeholder user + athlete profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const placeholderEmail = `unclaimed-${randomUUID()}@placeholder.internal`;
      const user = await tx.user.create({
        data: {
          email: placeholderEmail,
          passwordHash: null,
          role: "ATHLETE",
          claimedAt: null,
        },
      });

      const athleteProfile = await tx.athleteProfile.create({
        data: {
          userId: user.id,
          coachId: coach.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          events,
          gender: "OTHER",
        },
      });

      return athleteProfile;
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating athlete:", error);
    return NextResponse.json({ error: "Failed to create athlete" }, { status: 500 });
  }
}

/* ── GET — list all athletes on coach's roster with claim status ── */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const athletes = await prisma.athleteProfile.findMany({
      where: { coachId: coach.id },
      include: {
        user: {
          select: { email: true, claimedAt: true },
        },
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ ok: true, data: athletes });
  } catch (error) {
    console.error("Error listing athletes:", error);
    return NextResponse.json({ error: "Failed to list athletes" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/athletes/route.ts
git commit -m "feat: add POST/GET /api/coach/athletes for placeholder athlete creation"
```

---

### Task 3: POST /api/coach/athletes/[athleteId]/sessions — coach logs for athlete

**Files:**
- Create: `src/app/api/coach/athletes/[athleteId]/sessions/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { athleteId: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { athleteId } = params;

    // Verify athlete belongs to this coach
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true, events: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await request.json();
    const { event, date, drillLogs } = body;

    // Validate event is in athlete's events
    if (!event || !athlete.events.includes(event)) {
      return NextResponse.json(
        { error: `Invalid event. Athlete trains: ${athlete.events.join(", ")}` },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!Array.isArray(drillLogs) || drillLogs.length === 0) {
      return NextResponse.json({ error: "At least one drill log is required" }, { status: 400 });
    }

    // Create session with drill logs (limited — no readiness/feedback)
    const athleteSession = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event,
        date,
        loggedByCoach: true,
        // Readiness and feedback fields left null (limited mode)
        drillLogs: {
          create: drillLogs.map((drill: { drillType: string; implementWeight?: number; throwCount?: number; bestMark?: number; notes?: string }) => ({
            drillType: drill.drillType,
            implementWeight: drill.implementWeight ?? null,
            throwCount: drill.throwCount ?? null,
            bestMark: drill.bestMark ?? null,
            notes: drill.notes ?? null,
          })),
        },
      },
      include: { drillLogs: true },
    });

    return NextResponse.json({ ok: true, data: athleteSession }, { status: 201 });
  } catch (error) {
    console.error("Error logging session for athlete:", error);
    return NextResponse.json({ error: "Failed to log session" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/athletes/\[athleteId\]/sessions/route.ts
git commit -m "feat: add POST /api/coach/athletes/[athleteId]/sessions for coach-logged sessions"
```

---

### Task 4: GET /api/invitations/verify — verify invite token

**Files:**
- Create: `src/app/api/invitations/verify/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        athleteProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
          },
        },
        coach: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ ok: false, error: "Invalid invite token" }, { status: 404 });
    }

    if (invitation.status === "ACCEPTED") {
      return NextResponse.json({ ok: false, error: "This invite has already been used." }, { status: 410 });
    }

    if (invitation.status === "REVOKED") {
      return NextResponse.json({ ok: false, error: "This invite has been revoked." }, { status: 410 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        invitation: {
          id: invitation.id,
          token: invitation.token,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        athleteProfile: invitation.athleteProfile ?? null,
        coachName: `${invitation.coach.firstName} ${invitation.coach.lastName}`,
      },
    });
  } catch (error) {
    console.error("Error verifying invitation:", error);
    return NextResponse.json({ ok: false, error: "Failed to verify invitation" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invitations/verify/route.ts
git commit -m "feat: add GET /api/invitations/verify for invite token verification"
```

---

### Task 5: POST /api/auth/register-claim — athlete claims account

**Files:**
- Create: `src/app/api/auth/register-claim/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`register-claim:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, email, password, firstName, lastName, events } = body;

    if (!token || !email || !password) {
      return NextResponse.json({ error: "Token, email, and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { athleteProfile: true },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    if (!invitation.athleteProfileId || !invitation.athleteProfile) {
      return NextResponse.json({ error: "This invite is not linked to an athlete profile" }, { status: 400 });
    }

    // Check email not taken
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser && existingUser.id !== invitation.athleteProfile.userId) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    // Update placeholder user and profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Activate the user
      const user = await tx.user.update({
        where: { id: invitation.athleteProfile!.userId },
        data: {
          email: normalizedEmail,
          passwordHash: hashed,
          claimedAt: new Date(),
        },
      });

      // Update profile with any edits from the athlete
      const profile = await tx.athleteProfile.update({
        where: { id: invitation.athleteProfileId! },
        data: {
          ...(firstName?.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName?.trim() ? { lastName: lastName.trim() } : {}),
          ...(Array.isArray(events) && events.length > 0 ? { events } : {}),
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      return { user, profile };
    });

    // Create JWT and set cookie
    const jwt = await signToken({
      userId: result.user.id,
      role: result.user.role,
      email: result.user.email,
    });

    const response = NextResponse.json({
      ok: true,
      data: { userId: result.user.id, role: result.user.role },
    });

    setAuthCookie(response, jwt);
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error("Error claiming account:", error);
    return NextResponse.json({ error: "Failed to claim account" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register-claim/route.ts
git commit -m "feat: add POST /api/auth/register-claim for athlete account claiming"
```

---

### Task 6: Modify existing invitation and login routes

**Files:**
- Modify: `src/app/api/invitations/route.ts`
- Modify: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: Add athleteProfileId support to POST /api/invitations**

In `src/app/api/invitations/route.ts`, in the POST handler, after extracting the body fields, also extract `athleteProfileId`:

```typescript
const { email, mode, athleteProfileId } = body;
```

When creating the invitation, include `athleteProfileId` if provided:

```typescript
const invitation = await prisma.invitation.create({
  data: {
    coachId: coach.id,
    email: normalizedEmail || null,
    token: randomBytes(32).toString("hex"),
    status: "PENDING",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...(athleteProfileId ? { athleteProfileId } : {}),
  },
});
```

- [ ] **Step 2: Add null passwordHash guard to login**

In `src/app/api/auth/login/route.ts`, after finding the user and before comparing passwords, add:

```typescript
if (!user.passwordHash) {
  return NextResponse.json(
    { error: "This account hasn't been activated yet. Check your invite link from your coach." },
    { status: 403 }
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invitations/route.ts src/app/api/auth/login/route.ts
git commit -m "feat: support athleteProfileId on invitations, guard login against unclaimed users"
```

---

## Chunk 2: Event Filtering & UI

### Task 7: Add allowedEvents + limitedMode to LogSessionWizard

**Files:**
- Modify: `src/app/(dashboard)/athlete/log-session/_log-session-wizard.tsx`

- [ ] **Step 1: Update WizardProps interface and component signature**

At line 163, update the interface:

```typescript
interface WizardProps {
  /** API endpoint for saving */
  apiEndpoint?: string;
  /** Where to navigate after "View Sessions" */
  sessionsPath?: string;
  /** Only show these events (empty/undefined = show all) */
  allowedEvents?: string[];
  /** Limited mode: skip readiness & feedback steps (for coach logging on behalf of athlete) */
  limitedMode?: boolean;
}
```

Update the component signature at line 170:

```typescript
export function LogSessionWizard({
  apiEndpoint = "/api/athlete/log-session",
  sessionsPath = "/athlete/sessions",
  allowedEvents,
  limitedMode = false,
}: WizardProps) {
```

- [ ] **Step 2: Filter events in the event selection step**

Near the top of the component, compute the filtered events list:

```typescript
const filteredEvents = allowedEvents?.length
  ? EVENTS.filter((e) => allowedEvents.includes(e.value))
  : EVENTS;
```

If `filteredEvents` has exactly one item, auto-select it. Add after the state declarations:

```typescript
// Auto-select if only one event
useState(() => {
  if (filteredEvents.length === 1 && !event) {
    setEvent(filteredEvents[0].value);
  }
});
```

In the event selection UI, replace references to `EVENTS` with `filteredEvents`.

- [ ] **Step 3: Handle limitedMode step flow**

Update the `STEP_ORDER` to be dynamic based on `limitedMode`:

```typescript
const steps: Step[] = limitedMode
  ? ["event", "drills", "done"]
  : ["event", "readiness", "drills", "feedback", "done"];
```

Replace all references to `STEP_ORDER` with `steps`. The "next" and "back" navigation uses these steps.

When `limitedMode` is true, the readiness and feedback steps are skipped entirely. The submit payload should omit readiness/feedback fields.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/athlete/log-session/_log-session-wizard.tsx
git commit -m "feat: add allowedEvents and limitedMode props to LogSessionWizard"
```

---

### Task 8: Pass allowedEvents from athlete and coach log-session pages

**Files:**
- Modify: `src/app/(dashboard)/athlete/log-session/page.tsx`
- Modify: `src/app/(dashboard)/coach/log-session/page.tsx`

- [ ] **Step 1: Athlete log-session page — fetch athlete events and pass to wizard**

In `src/app/(dashboard)/athlete/log-session/page.tsx`, fetch the athlete's events (from their profile or session) and pass as `allowedEvents` to the wizard:

```typescript
const [allowedEvents, setAllowedEvents] = useState<string[]>([]);

useEffect(() => {
  fetch("/api/athlete/profile")
    .then((r) => r.json())
    .then((data) => {
      if (data?.events?.length) setAllowedEvents(data.events);
    })
    .catch(() => {}); // fallback: show all events
}, []);
```

Pass to wizard: `<LogSessionWizard allowedEvents={allowedEvents} />`

Note: Check if there's an existing profile fetch on this page that can be extended. If the page already fetches athlete data, add `events` to the select and pass it through.

- [ ] **Step 2: Coach log-session page — fetch coach events and pass to wizard**

In `src/app/(dashboard)/coach/log-session/page.tsx`, fetch the coach's events:

```typescript
const [allowedEvents, setAllowedEvents] = useState<string[]>([]);

useEffect(() => {
  fetch("/api/coach/profile")
    .then((r) => r.json())
    .then((data) => {
      if (data?.events?.length) setAllowedEvents(data.events);
    })
    .catch(() => {}); // fallback: show all events
}, []);
```

Pass to wizard: `<LogSessionWizard apiEndpoint="/api/coach/log-session" sessionsPath="/coach/my-training" allowedEvents={allowedEvents} />`

Note: If `/api/coach/profile` doesn't exist as a GET endpoint, you may need to create it or use an existing endpoint that returns coach profile data. Check `src/app/api/coach/profile/route.ts` — if it exists, extend it to include `events`. If not, create a minimal GET that returns `{ events }`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/athlete/log-session/page.tsx src/app/(dashboard)/coach/log-session/page.tsx
git commit -m "feat: pass allowedEvents to LogSessionWizard on athlete and coach pages"
```

---

### Task 9: Roster page — Add Athlete form + unclaimed badges + invite

**Files:**
- Modify: `src/app/(dashboard)/coach/throws/roster/page.tsx`

- [ ] **Step 1: Add "Add Athlete" form/modal to the roster page**

Add state for the form:

```typescript
const [showAddForm, setShowAddForm] = useState(false);
const [newFirstName, setNewFirstName] = useState("");
const [newLastName, setNewLastName] = useState("");
const [newEvents, setNewEvents] = useState<string[]>([]);
const [addLoading, setAddLoading] = useState(false);
const [addError, setAddError] = useState("");
```

Add the submit handler:

```typescript
async function handleAddAthlete(e: React.FormEvent) {
  e.preventDefault();
  if (!newFirstName.trim() || !newLastName.trim() || newEvents.length === 0) return;
  setAddLoading(true);
  setAddError("");
  try {
    const res = await fetch("/api/coach/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ firstName: newFirstName, lastName: newLastName, events: newEvents }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add athlete");
    setShowAddForm(false);
    setNewFirstName("");
    setNewLastName("");
    setNewEvents([]);
    // Refresh the roster list
    loadAthletes();
  } catch (err: unknown) {
    setAddError(err instanceof Error ? err.message : "Failed to add athlete");
  } finally {
    setAddLoading(false);
  }
}
```

Add the form UI with:
- First name input
- Last name input
- Event checkboxes (Shot Put, Discus, Hammer, Javelin)
- Submit button
- Cancel button

The event checkbox toggle:
```typescript
function toggleEvent(event: string) {
  setNewEvents((prev) =>
    prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
  );
}
```

- [ ] **Step 2: Show unclaimed badge and invite button on athlete rows**

For each athlete in the roster, check `athlete.user?.claimedAt`. If null, show:
- A subtle badge: `"Not yet claimed"` with a muted amber/gold styling
- An "Invite" button that creates an invitation and copies the link

Invite handler:

```typescript
async function handleInvite(athleteId: string) {
  try {
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ mode: "link", athleteProfileId: athleteId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const link = `${window.location.origin}/register?invite=${data.data.token}`;
    await navigator.clipboard.writeText(link);
    // Show success toast or feedback
  } catch (err) {
    console.error("Failed to create invite:", err);
  }
}
```

- [ ] **Step 3: Update the roster data fetching to use new endpoint**

Change the roster page to fetch from `GET /api/coach/athletes` instead of (or in addition to) the existing endpoint, so it gets `claimedAt` status.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/coach/throws/roster/page.tsx
git commit -m "feat: add athlete creation form, unclaimed badges, and invite buttons to roster"
```

---

### Task 10: Register page — claim flow branch

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Detect invite token and fetch profile data**

At the top of the register page component, check for an invite token with a linked profile:

```typescript
const searchParams = useSearchParams();
const inviteToken = searchParams.get("invite");

const [claimProfile, setClaimProfile] = useState<{
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
} | null>(null);
const [coachName, setCoachName] = useState("");
const [claimLoading, setClaimLoading] = useState(false);

useEffect(() => {
  if (!inviteToken) return;
  fetch(`/api/invitations/verify?token=${inviteToken}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.ok && data.data.athleteProfile) {
        setClaimProfile(data.data.athleteProfile);
        setCoachName(data.data.coachName);
      }
    })
    .catch(() => {});
}, [inviteToken]);
```

- [ ] **Step 2: Render claim flow when profile exists**

When `claimProfile` is set, render the claim UI instead of the standard registration form:

**Confirm profile step:**
- Show "Coach {coachName} has set up your profile"
- Display firstName, lastName, events (each editable)
- "Looks good" button to proceed

**Set credentials step:**
- Email input
- Password input
- Submit button

**Submit handler:**

```typescript
async function handleClaim(e: React.FormEvent) {
  e.preventDefault();
  setClaimLoading(true);
  try {
    const res = await fetch("/api/auth/register-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: inviteToken,
        email: claimEmail,
        password: claimPassword,
        firstName: editedFirstName,
        lastName: editedLastName,
        events: editedEvents,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    router.push("/athlete/dashboard");
  } catch (err: unknown) {
    setClaimError(err instanceof Error ? err.message : "Failed to claim account");
  } finally {
    setClaimLoading(false);
  }
}
```

Style the claim flow to match the existing dark theme (bg-[#08080a], amber/gold accents, Outfit headings, DM Sans body).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/register/page.tsx
git commit -m "feat: add account claim flow to registration page for coach-invited athletes"
```

---

### Task 11: Final verification

**Files:**
- All files from Tasks 1-10

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 3: Run build**

```bash
npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Manual verification checklist**

Start dev server and verify:

1. Coach can create a new athlete from roster page (name + events)
2. New athlete appears with "Not yet claimed" badge
3. Coach can generate invite link for the athlete
4. Opening the invite link shows the claim flow (profile confirmation + credentials)
5. After claiming, athlete can log in and see their profile
6. Unclaimed users cannot log in via the login page
7. Coach can log a limited session (drills only, no readiness) for an unclaimed athlete
8. Athlete log-session wizard only shows their selected events
9. Coach self-training wizard only shows their selected events
10. If events array is empty, all four events show (fallback)

- [ ] **Step 5: Commit any fixes**

```bash
git add src/ prisma/
git commit -m "fix: address issues found during final verification"
```

(Skip if no fixes needed.)
