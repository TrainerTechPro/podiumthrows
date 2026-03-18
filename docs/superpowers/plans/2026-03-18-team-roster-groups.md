# Team Roster Groups Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches create named teams (e.g., "UCSD", "Private Clients"), assign athletes to them, and filter the roster by team with preference persistence.

**Architecture:** Team and TeamMember models already exist in the Prisma schema — no migration needed. We add 6 new API routes for team CRUD + membership, modify the athletes API to accept a `?teamId` filter, update the preferences interface for `lastTeamId` persistence, build a team management page, add a team selector dropdown to the throws roster page, and add a sidebar link.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript, Prisma ORM, PostgreSQL, lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-18-team-roster-groups-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| MODIFY | `src/app/api/coach/preferences/route.ts` | Add `lastTeamId` to CoachPreferences interface and PUT merge logic |
| CREATE | `src/app/api/coach/teams/route.ts` | GET (list teams), POST (create team) |
| CREATE | `src/app/api/coach/teams/[teamId]/route.ts` | PATCH (update team), DELETE (delete team) |
| CREATE | `src/app/api/coach/teams/[teamId]/members/route.ts` | POST (add athletes to team) |
| CREATE | `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts` | DELETE (remove athlete from team) |
| MODIFY | `src/app/api/coach/athletes/route.ts` | Add optional `?teamId` query param to GET |
| CREATE | `src/app/(dashboard)/coach/teams/page.tsx` | Team management page (CRUD + member management) |
| MODIFY | `src/app/(dashboard)/coach/throws/roster/page.tsx` | Add team selector dropdown + preference persistence |
| MODIFY | `src/components/ui/Sidebar.tsx` | Add "Teams" nav item with UsersRound icon |

---

## Chunk 1: API Routes (Tasks 1-5)

### Task 1: Update preferences interface for lastTeamId

**Files:**
- Modify: `src/app/api/coach/preferences/route.ts`

- [ ] **Step 1: Add lastTeamId to CoachPreferences interface**

At the `CoachPreferences` interface (around line 12), add:

```typescript
export interface CoachPreferences {
  globalDefaultPage?: string;
  workspaceDefaults?: Record<string, string>;
  dashboardLayout?: { widgets: { id: string; visible: boolean; order: number }[] };
  myTraining?: {
    mode?: "competitive" | "recreational";
    primaryEvent?: string;
    gender?: "male" | "female";
  };
  lastTeamId?: string | null;
}
```

- [ ] **Step 2: Update PUT merge logic to handle lastTeamId**

In the PUT handler's merge logic (around line 68-82), add `lastTeamId` to the updated object:

```typescript
lastTeamId: body.lastTeamId !== undefined ? body.lastTeamId : current.lastTeamId,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coach/preferences/route.ts
git commit -m "feat: add lastTeamId to coach preferences for team filter persistence"
```

---

### Task 2: Create GET/POST /api/coach/teams

**Files:**
- Create: `src/app/api/coach/teams/route.ts`

- [ ] **Step 1: Create route with GET and POST handlers**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── GET — list all teams for the authenticated coach ── */
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

    const teams = await prisma.team.findMany({
      where: { coachId: coach.id },
      include: {
        members: {
          include: {
            athlete: {
              select: { events: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const data = teams.map((team) => {
      const eventBreakdown: Record<string, number> = {};
      for (const member of team.members) {
        for (const ev of member.athlete.events) {
          eventBreakdown[ev] = (eventBreakdown[ev] ?? 0) + 1;
        }
      }
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.members.length,
        eventBreakdown,
        createdAt: team.createdAt,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Error listing teams:", error);
    return NextResponse.json({ error: "Failed to list teams" }, { status: 500 });
  }
}

/* ── POST — create a new team ── */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
    }

    // Check uniqueness (case-insensitive)
    const existing = await prisma.team.findFirst({
      where: {
        coachId: coach.id,
        name: { equals: name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists" }, { status: 409 });
    }

    const team = await prisma.team.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, data: team }, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/teams/route.ts
git commit -m "feat: add GET/POST /api/coach/teams for team CRUD"
```

---

### Task 3: Create PATCH/DELETE /api/coach/teams/[teamId]

**Files:**
- Create: `src/app/api/coach/teams/[teamId]/route.ts`

- [ ] **Step 1: Create route with PATCH and DELETE handlers**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── PATCH — update team name/description ── */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return NextResponse.json({ error: "Team name must be 100 characters or less" }, { status: 400 });
      }
      // Check uniqueness (case-insensitive, exclude current team)
      const existing = await prisma.team.findFirst({
        where: {
          coachId: coach.id,
          id: { not: teamId },
          name: { equals: name.trim(), mode: "insensitive" },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "A team with this name already exists" }, { status: 409 });
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Error updating team:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

/* ── DELETE — delete team (cascade removes members, not athletes) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.team.delete({ where: { id: teamId } });

    // Clear lastTeamId preference if it pointed to the deleted team
    try {
      const prefs = JSON.parse(coach.preferences || "{}");
      if (prefs.lastTeamId === teamId) {
        prefs.lastTeamId = null;
        await prisma.coachProfile.update({
          where: { id: coach.id },
          data: { preferences: JSON.stringify(prefs) },
        });
      }
    } catch {
      // Non-critical — preference cleanup is best-effort
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/teams/\[teamId\]/route.ts
git commit -m "feat: add PATCH/DELETE /api/coach/teams/[teamId]"
```

---

### Task 4: Create team membership routes

**Files:**
- Create: `src/app/api/coach/teams/[teamId]/members/route.ts`
- Create: `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts`

- [ ] **Step 1: Create POST handler for adding members**

File: `src/app/api/coach/teams/[teamId]/members/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── POST — add athletes to a team ── */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const { athleteIds } = body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json({ error: "At least one athlete ID is required" }, { status: 400 });
    }
    if (athleteIds.length > 100) {
      return NextResponse.json({ error: "Maximum 100 athletes per request" }, { status: 400 });
    }

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(athletes.map((a) => a.id));

    // Get existing memberships to skip duplicates
    const existing = await prisma.teamMember.findMany({
      where: { teamId, athleteId: { in: athleteIds } },
      select: { athleteId: true },
    });
    const existingIds = new Set(existing.map((m) => m.athleteId));

    const toAdd = athleteIds.filter(
      (id: string) => validIds.has(id) && !existingIds.has(id)
    );

    if (toAdd.length > 0) {
      await prisma.teamMember.createMany({
        data: toAdd.map((athleteId: string) => ({ teamId, athleteId })),
      });
    }

    return NextResponse.json({ ok: true, added: toAdd.length });
  } catch (error) {
    console.error("Error adding team members:", error);
    return NextResponse.json({ error: "Failed to add team members" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create DELETE handler for removing a member**

File: `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ── DELETE — remove athlete from team (idempotent) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, athleteId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    // Verify team belongs to coach
    const team = await prisma.team.findFirst({
      where: { id: teamId, coachId: coach.id },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Delete membership (idempotent — no error if not found)
    await prisma.teamMember.deleteMany({
      where: { teamId, athleteId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coach/teams/\[teamId\]/members/
git commit -m "feat: add team membership routes (add/remove athletes)"
```

---

### Task 5: Add teamId filter to GET /api/coach/athletes

**Files:**
- Modify: `src/app/api/coach/athletes/route.ts`

- [ ] **Step 1: Update GET handler to accept teamId query param**

In the GET handler, after verifying the coach, extract `teamId` from the query string and build a dynamic where clause:

```typescript
export async function GET(request: NextRequest) {
  // ... existing auth + coach lookup ...

  const teamId = request.nextUrl.searchParams.get("teamId");

  // Build where clause
  let where: Record<string, unknown> = { coachId: coach.id };

  if (teamId === "unassigned") {
    where = {
      coachId: coach.id,
      teamMemberships: { none: {} },
    };
  } else if (teamId) {
    where = {
      coachId: coach.id,
      teamMemberships: { some: { teamId } },
    };
  }

  const athletes = await prisma.athleteProfile.findMany({
    where,
    include: {
      user: {
        select: { email: true, claimedAt: true },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ ok: true, data: athletes });
}
```

Note: The GET handler currently does not accept a `request` parameter. Change the signature from `export async function GET()` to `export async function GET(request: NextRequest)` and add the `NextRequest` import if not already present.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/athletes/route.ts
git commit -m "feat: add teamId filter to GET /api/coach/athletes"
```

---

## Chunk 2: UI — Team Management Page (Task 6)

### Task 6: Build /coach/teams page

**Files:**
- Create: `src/app/(dashboard)/coach/teams/page.tsx`

- [ ] **Step 1: Create the team management page**

Build a `"use client"` component. Key state variables:

```typescript
const [teams, setTeams] = useState<TeamData[]>([]);
const [loading, setLoading] = useState(true);
const [showCreateForm, setShowCreateForm] = useState(false);
const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
const [managingTeamId, setManagingTeamId] = useState<string | null>(null);
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
const [formName, setFormName] = useState("");
const [formDescription, setFormDescription] = useState("");
const [formLoading, setFormLoading] = useState(false);
const [formError, setFormError] = useState("");
// For manage members panel:
const [allAthletes, setAllAthletes] = useState<RosterAthlete[]>([]);
const [teamMembers, setTeamMembers] = useState<RosterAthlete[]>([]);
const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
```

Data fetching pattern (same as roster page):
```typescript
function loadTeams() {
  setLoading(true);
  fetch("/api/coach/teams").then(r => r.json())
    .then(data => { if (data.ok) setTeams(data.data); })
    .finally(() => setLoading(false));
}
useEffect(() => { loadTeams(); }, []);
```

When "Manage Members" is clicked, fetch both the team's current members and all roster athletes:
```typescript
async function openManageMembers(teamId: string) {
  setManagingTeamId(teamId);
  const [rosterRes, teamRes] = await Promise.all([
    fetch("/api/coach/athletes").then(r => r.json()),
    fetch(`/api/coach/athletes?teamId=${teamId}`).then(r => r.json()),
  ]);
  if (rosterRes.ok) setAllAthletes(rosterRes.data);
  if (teamRes.ok) setTeamMembers(teamRes.data);
  setSelectedToAdd(new Set());
}
```

**Event breakdown display note:** The `eventBreakdown` keys are `EventType` enum values (e.g., `SHOT_PUT`, `DISCUS`). Map them to display labels:
```typescript
const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "SP", DISCUS: "DT", HAMMER: "HT", JAVELIN: "JT",
};
```

Layout structure:
- Loading: shimmer skeleton (3 card-sized blocks)
- Error: error banner with retry button
- Empty state: icon + "No teams yet" + description + "Create Team" button
- Team cards: responsive grid (`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`)
- Create/Edit form: inline panel with `card` class, same pattern as Add Athlete form on roster page
- Manage Members: inline panel showing current members with remove buttons + checklist of available athletes with "Add Selected" button

All mutations use `csrfHeaders()` from `@/lib/csrf-client`. Use `UserAvatar` from `@/components/user-avatar` for member avatars.

Style classes: `card`, `btn-primary`, `btn-secondary`, `input`, gold/amber accents consistent with the app theme. Follow the roster page pattern from `src/app/(dashboard)/coach/throws/roster/page.tsx` for inline forms.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/coach/teams/page.tsx
git commit -m "feat: add team management page with CRUD and member management"
```

---

## Chunk 3: Roster Filter + Sidebar (Tasks 7-8)

### Task 7: Add team selector to throws roster page

**Files:**
- Modify: `src/app/(dashboard)/coach/throws/roster/page.tsx`

- [ ] **Step 1: Add team state and fetch teams on mount**

Add state for teams and selected team:

```typescript
const [teams, setTeams] = useState<{ id: string; name: string; memberCount: number }[]>([]);
const [selectedTeamId, setSelectedTeamId] = useState<string>("");
const [teamsLoaded, setTeamsLoaded] = useState(false);
```

Add a one-time effect to fetch teams and the saved preference:

```typescript
useEffect(() => {
  Promise.all([
    fetch("/api/coach/teams").then((r) => r.json()),
    fetch("/api/coach/preferences").then((r) => r.json()),
  ]).then(([teamsData, prefsData]) => {
    if (teamsData.ok) setTeams(teamsData.data);
    // NOTE: preferences API returns { success: true, data: { ... } } NOT { ok: true }
    const lastTeam = prefsData?.success ? prefsData.data?.lastTeamId : null;
    const teamIds = new Set((teamsData.data ?? []).map((t: { id: string }) => t.id));
    if (lastTeam && teamIds.has(lastTeam)) {
      setSelectedTeamId(lastTeam);
    }
    setTeamsLoaded(true);
  }).catch(() => setTeamsLoaded(true));
}, []);
```

Wait for `teamsLoaded` before calling `fetchData` so the first data fetch respects the persisted team filter.

- [ ] **Step 2: Add team selector dropdown to page header**

Place a `<select>` between the page heading and the stats strip:

```tsx
<select
  value={selectedTeamId}
  onChange={(e) => handleTeamChange(e.target.value)}
  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
>
  <option value="">All Athletes</option>
  {teams.map((t) => (
    <option key={t.id} value={t.id}>
      {t.name} ({t.memberCount})
    </option>
  ))}
  <option value="unassigned">Unassigned</option>
</select>
```

- [ ] **Step 3: Implement handleTeamChange with persistence**

```typescript
function handleTeamChange(teamId: string) {
  setSelectedTeamId(teamId);
  // Persist to preferences (fire-and-forget)
  fetch("/api/coach/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ lastTeamId: teamId || null }),
  }).catch(() => {});
  // Re-fetch data with filter
  fetchData(teamId);
}
```

- [ ] **Step 4: Update fetchData to pass teamId to all data sources**

The roster page fetches from 3 endpoints: `/api/throws/podium-roster`, `/api/athletes`, and `/api/coach/athletes`. Only `/api/coach/athletes` supports `?teamId`. For the other two, apply client-side filtering using the `rosterAthletes` data (which has team membership info).

Update the `fetchData` callback:

```typescript
const fetchData = useCallback((teamId?: string) => {
  const teamParam = teamId !== undefined ? teamId : selectedTeamId;
  const qs = teamParam ? `?teamId=${teamParam}` : "";
  setLoading(true);
  Promise.all([
    fetch("/api/throws/podium-roster").then((r) => r.json()),
    fetch("/api/athletes").then((r) => r.json()),
    fetch(`/api/coach/athletes${qs}`).then((r) => r.json()),
  ])
  .then(([podiumData, athletesData, rosterData]) => {
    // rosterData is already filtered by teamId via the API
    if (rosterData.ok) setRosterAthletes(rosterData.data);
    const filteredIds = new Set(
      (rosterData.data ?? []).map((a: { id: string }) => a.id)
    );

    // Client-side filter podium and allAthletes to match team selection
    if (podiumData.success) {
      const podium = teamParam
        ? podiumData.data.filter((p: { athleteId: string }) => filteredIds.has(p.athleteId))
        : podiumData.data;
      setPodiumAthletes(podium);
    }
    if (athletesData.success) {
      let list = Array.isArray(athletesData.data)
        ? athletesData.data
        : athletesData.data ? [athletesData.data] : [];
      if (teamParam) list = list.filter((a: { id: string }) => filteredIds.has(a.id));
      setAllAthletes(list);
    }
    setLoading(false);
  })
  .catch(() => setLoading(false));
}, [selectedTeamId]);
```

This approach: the `/api/coach/athletes` endpoint does the authoritative team filtering, then the other two lists are cross-referenced client-side using the filtered athlete IDs.

- [ ] **Step 5: Auto-assign new athletes to selected team**

In the existing `handleAddAthlete` function, after the successful `POST /api/coach/athletes` call, if `selectedTeamId` is set and not "unassigned", also add the new athlete to the team:

```typescript
if (selectedTeamId && selectedTeamId !== "unassigned" && data.data?.id) {
  await fetch(`/api/coach/teams/${selectedTeamId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify({ athleteIds: [data.data.id] }),
  }).catch(() => {});
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/coach/throws/roster/page.tsx
git commit -m "feat: add team selector dropdown to throws roster with preference persistence"
```

---

### Task 8: Add Teams to sidebar + final verification

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Add UsersRound import and Teams nav item**

Add `UsersRound` to the lucide-react imports (line 9).

In `COACH_NAV_SECTIONS`, add a Teams entry in the main section after Athletes:

```typescript
{ label: "Teams", href: "/coach/teams", icon: <UsersRound {...iconSize} /> },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "mfa\|otplib\|qrcode\|throwComment"
```

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: add Teams to coach sidebar navigation"
```

- [ ] **Step 5: Push to remote**

```bash
git push origin main
```
