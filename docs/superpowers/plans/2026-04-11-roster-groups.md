# Roster Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches organize athletes into named groups (e.g., "UCSD Throws", "Private Clients") with filtered roster views and persistence.

**Architecture:** New `Team` + `TeamMember` models (many-to-many). CRUD API under `/api/coach/teams`. Management page at `/coach/teams`. Team filter dropdown on the existing `/coach/athletes` server component page via URL search params. Preferences API (`lastTeamId`) already exists and handles persistence.

**Tech Stack:** Next.js 14.2 App Router, Prisma ORM, PostgreSQL, Zod validation, custom component library (no shadcn)

**Spec:** `docs/superpowers/specs/2026-04-11-roster-groups-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `prisma/migrations/XXXXXX_add_team_models/migration.sql` | Schema migration |
| `src/app/api/coach/teams/route.ts` | GET (list) + POST (create) team |
| `src/app/api/coach/teams/[teamId]/route.ts` | PATCH (update) + DELETE team |
| `src/app/api/coach/teams/[teamId]/members/route.ts` | POST (add members) |
| `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts` | DELETE (remove member) |
| `src/app/(dashboard)/coach/teams/page.tsx` | Teams management page (server shell) |
| `src/app/(dashboard)/coach/teams/_teams-client.tsx` | Teams management client component |
| `src/app/(dashboard)/coach/athletes/_team-filter.tsx` | Team dropdown filter (client component) |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `Team`, `TeamMember` models + relations on `CoachProfile`, `AthleteProfile` |
| `src/lib/api-schemas.ts` | Add `TeamCreateSchema`, `TeamUpdateSchema`, `TeamAddMembersSchema` |
| `src/lib/data/coach.ts` | Add `teamId` parameter to `getAthleteRoster()` |
| `src/app/api/coach/athletes/route.ts` | Fix `teamId` filter to use `teamMemberships` (currently uses `eventGroupMemberships`) |
| `src/app/(dashboard)/coach/athletes/page.tsx` | Read `searchParams.teamId`, fetch teams, pass to filter + roster |
| `src/app/(dashboard)/coach/athletes/_invite.tsx` | Auto-assign new athlete to selected team |
| `src/components/ui/Sidebar.tsx` | Add "Groups" nav item under Athletes section |

---

## Task 1: Schema — Add Team and TeamMember models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Team model after EventGroupMember (around line 978)**

```prisma
// ─── ROSTER GROUPS (Coach-Defined Teams) ────────────────────────────────────

model Team {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name        String
  description String?
  members     TeamMember[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([coachId])
}

model TeamMember {
  id        String         @id @default(cuid())
  teamId    String
  team      Team           @relation(fields: [teamId], references: [id], onDelete: Cascade)
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  joinedAt  DateTime       @default(now())

  @@unique([teamId, athleteId])
  @@index([teamId])
  @@index([athleteId])
}
```

- [ ] **Step 2: Add relations to CoachProfile (around line 206)**

Add to CoachProfile model body:

```prisma
  teams          Team[]
```

- [ ] **Step 3: Add relation to AthleteProfile (after eventGroupMemberships)**

Add to AthleteProfile model body:

```prisma
  teamMemberships TeamMember[]
```

- [ ] **Step 4: Run typecheck to verify schema parses**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 5: Create and apply migration**

Run: `npx prisma migrate dev --name add_team_models`
Expected: Migration created and applied successfully

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Team and TeamMember models for roster groups"
```

---

## Task 2: Zod Schemas

**Files:**
- Modify: `src/lib/api-schemas.ts` (add after CoachPreferencesPatchSchema, around line 639)

- [ ] **Step 1: Add team validation schemas**

```typescript
// ── Roster Groups (Teams) ─────────────────────────���──────────────────

export const TeamCreateSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100).transform((s) => s.trim()),
  description: z.string().max(500).nullable().optional(),
});

export const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const TeamAddMembersSchema = z.object({
  athleteIds: z.array(z.string().cuid()).min(1).max(100),
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-schemas.ts
git commit -m "feat(schemas): add Zod schemas for team CRUD and member operations"
```

---

## Task 3: API — Team CRUD (list, create, update, delete)

**Files:**
- Create: `src/app/api/coach/teams/route.ts`
- Create: `src/app/api/coach/teams/[teamId]/route.ts`

- [ ] **Step 1: Create GET + POST handler at `/api/coach/teams/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamCreateSchema } from "@/lib/api-schemas";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const teams = await prisma.team.findMany({
      where: { coachId: coach.id },
      include: {
        members: {
          include: {
            athlete: { select: { events: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const data = teams.map((t) => {
      const eventBreakdown: Record<string, number> = {};
      for (const m of t.members) {
        for (const ev of m.athlete.events as string[]) {
          eventBreakdown[ev] = (eventBreakdown[ev] ?? 0) + 1;
        }
      }
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        memberCount: t.members.length,
        eventBreakdown,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("GET /api/coach/teams error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, TeamCreateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Case-insensitive name uniqueness per coach
    const existing = await prisma.team.findFirst({
      where: {
        coachId: coach.id,
        name: { equals: parsed.name, mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A group with that name already exists" },
        { status: 409 }
      );
    }

    const team = await prisma.team.create({
      data: {
        coachId: coach.id,
        name: parsed.name,
        description: parsed.description ?? null,
      },
    });

    return NextResponse.json({ success: true, data: team }, { status: 201 });
  } catch (error) {
    logger.error("POST /api/coach/teams error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create PATCH + DELETE handler at `/api/coach/teams/[teamId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamUpdateSchema } from "@/lib/api-schemas";

async function getCoachTeam(teamId: string, userId: string) {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId },
    select: { id: true, preferences: true },
  });
  if (!coach) return null;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team || team.coachId !== coach.id) return null;

  return { coach, team };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const ctx = await getCoachTeam(teamId, session.userId);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, TeamUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Name uniqueness if changing name
    if (parsed.name) {
      const dup = await prisma.team.findFirst({
        where: {
          coachId: ctx.coach.id,
          name: { equals: parsed.name, mode: "insensitive" },
          id: { not: teamId },
        },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, error: "A group with that name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("PATCH /api/coach/teams/[teamId] error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const ctx = await getCoachTeam(teamId, session.userId);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }

    // Cascade deletes TeamMember rows automatically
    await prisma.team.delete({ where: { id: teamId } });

    // Clear lastTeamId preference if it pointed to the deleted team
    try {
      const prefs = JSON.parse(ctx.coach.preferences as string || "{}");
      if (prefs.lastTeamId === teamId) {
        prefs.lastTeamId = null;
        await prisma.coachProfile.update({
          where: { id: ctx.coach.id },
          data: { preferences: JSON.stringify(prefs) },
        });
      }
    } catch { /* preference cleanup is best-effort */ }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("DELETE /api/coach/teams/[teamId] error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coach/teams/
git commit -m "feat(api): add team CRUD endpoints (GET, POST, PATCH, DELETE)"
```

---

## Task 4: API — Team Member Routes

**Files:**
- Create: `src/app/api/coach/teams/[teamId]/members/route.ts`
- Create: `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts`

- [ ] **Step 1: Create POST handler for adding members**

File: `src/app/api/coach/teams/[teamId]/members/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, TeamAddMembersSchema } from "@/lib/api-schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, TeamAddMembersSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: parsed.athleteIds }, coachId: coach.id },
      select: { id: true },
    });
    const validIds = new Set(athletes.map((a) => a.id));

    // Upsert — skipDuplicates makes this idempotent
    const result = await prisma.teamMember.createMany({
      data: parsed.athleteIds
        .filter((id) => validIds.has(id))
        .map((athleteId) => ({ teamId, athleteId })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, data: { added: result.count } });
  } catch (error) {
    logger.error("POST /api/coach/teams/[teamId]/members error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create DELETE handler for removing a member**

File: `src/app/api/coach/teams/[teamId]/members/[athleteId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; athleteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, athleteId } = await params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
    }

    // Idempotent: deleteMany returns 0 if not found, no error
    await prisma.teamMember.deleteMany({
      where: { teamId, athleteId },
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("DELETE team member error", { context: "coach/teams", error });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/coach/teams/
git commit -m "feat(api): add team member add/remove endpoints"
```

---

## Task 5: Data Layer — Add teamId filter to getAthleteRoster

**Files:**
- Modify: `src/lib/data/coach.ts` (line 623)

- [ ] **Step 1: Update getAthleteRoster signature and query**

Change the function signature at line 623 from:

```typescript
export async function getAthleteRoster(coachId: string): Promise<AthleteRosterItem[]> {
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
```

To:

```typescript
export async function getAthleteRoster(coachId: string, teamId?: string): Promise<AthleteRosterItem[]> {
  // Build where clause with optional team filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = { coachId };
  if (teamId === "unassigned") {
    where = { coachId, teamMemberships: { none: {} } };
  } else if (teamId) {
    where = { coachId, teamMemberships: { some: { teamId } } };
  }

  const athletes = await prisma.athleteProfile.findMany({
    where,
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors (existing callers pass only coachId, the new param is optional)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/coach.ts
git commit -m "feat(data): add teamId filter to getAthleteRoster"
```

---

## Task 6: Fix GET /api/coach/athletes teamId filter

**Files:**
- Modify: `src/app/api/coach/athletes/route.ts` (lines 96-100)

- [ ] **Step 1: Change eventGroupMemberships to teamMemberships**

Replace lines 96-100:

```typescript
    if (teamId === "unassigned") {
      where = { coachId: coach.id, eventGroupMemberships: { none: {} } };
    } else if (teamId) {
      where = { coachId: coach.id, eventGroupMemberships: { some: { groupId: teamId } } };
    }
```

With:

```typescript
    if (teamId === "unassigned") {
      where = { coachId: coach.id, teamMemberships: { none: {} } };
    } else if (teamId) {
      where = { coachId: coach.id, teamMemberships: { some: { teamId } } };
    }
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/athletes/route.ts
git commit -m "fix(api): use Team model instead of EventGroup for roster teamId filter"
```

---

## Task 7: Sidebar — Add Groups nav item

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Add UsersRound to the Lucide import**

At line 8, add `UsersRound` to the import block (after `Users`):

```typescript
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Calendar,
  // ... rest unchanged
```

- [ ] **Step 2: Add "Groups" child to the Athletes section**

Inside the Athletes `children` array (line 293), add after the "Roster" entry (line 299):

```typescript
          {
            label: "Groups",
            href: "/coach/teams",
            icon: <UsersRound {...iconSize} />,
            matchPaths: ["/coach/teams"],
          },
```

- [ ] **Step 3: Add `/coach/teams` to the Athletes matchPaths array**

At line 284-291, add `"/coach/teams"` to the `matchPaths` array so the Athletes section expands when on the teams page.

- [ ] **Step 4: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat(sidebar): add Groups nav item under Athletes section"
```

---

## Task 8: UI — Teams Management Page

**Files:**
- Create: `src/app/(dashboard)/coach/teams/page.tsx`
- Create: `src/app/(dashboard)/coach/teams/_teams-client.tsx`

Note: The existing `/coach/team/page.tsx` (singular, Team Feed) is a separate page and unchanged.

- [ ] **Step 1: Create the server component shell**

File: `src/app/(dashboard)/coach/teams/page.tsx`

```typescript
import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { TeamsClient } from "./_teams-client";

export const metadata = { title: "Groups — Podium Throws" };

export default async function TeamsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }

  return <TeamsClient />;
}
```

- [ ] **Step 2: Create the client component**

File: `src/app/(dashboard)/coach/teams/_teams-client.tsx`

This is a large client component (~400 lines) that handles:
- Fetching teams list
- Create/edit team inline panel
- Manage members panel with add/remove
- Delete confirmation
- Empty state

The component fetches from `/api/coach/teams` for the team list and `/api/coach/athletes` for the full roster (used in "Add Athletes" checklist). All mutations use the team CRUD and member endpoints built in Tasks 3-4.

Key UI patterns to follow from CLAUDE.md:
- `card` class for team cards (not `card-interactive`)
- `btn-primary`, `btn-secondary` for buttons (use `<Button>` component if available)
- `text-sm font-semibold text-muted uppercase tracking-wider` for section headers
- `toast.success()` / `toast.error()` for save feedback
- `ConfirmDialog` for delete confirmation
- Event pill colors: Shot Put `#E85D26`, Discus `#2563EB`, Hammer `#7C3AED`, Javelin `#059669`
- Lucide icons with `strokeWidth={1.75}`
- Responsive grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

The component structure:
1. Header row with "Groups" heading + "Create Group" button
2. Inline create/edit form (slides open when triggered)
3. Team cards grid
4. Manage Members panel (replaces create form when active)
5. Empty state when no teams exist

Each team card shows: name, description, member count, event breakdown pills, Manage Members / Edit / Delete actions.

The Manage Members panel shows two sections: current members (with remove), and available athletes (checkboxes + "Add Selected").

- [ ] **Step 3: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/coach/teams/"
git commit -m "feat(ui): add teams management page with CRUD and member management"
```

---

## Task 9: UI — Roster Page Team Filter + Auto-Assign

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/_team-filter.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/page.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/_invite.tsx`

- [ ] **Step 1: Create the team filter dropdown component**

File: `src/app/(dashboard)/coach/athletes/_team-filter.tsx`

```typescript
"use client";

import { useRouter, usePathname } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

type TeamOption = {
  id: string;
  name: string;
  memberCount: number;
};

export function TeamFilter({
  teams,
  currentTeamId,
}: {
  teams: TeamOption[];
  currentTeamId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    // Persist preference (best-effort, non-blocking)
    fetch("/api/coach/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ lastTeamId: value || null }),
    }).catch(() => {});

    // Navigate with search param to trigger server re-render
    const params = new URLSearchParams();
    if (value) params.set("teamId", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={currentTeamId ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] font-medium"
      aria-label="Filter by group"
    >
      <option value="">All Athletes</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.memberCount})
        </option>
      ))}
      <option value="unassigned">Unassigned</option>
    </select>
  );
}
```

- [ ] **Step 2: Update the athletes page server component**

Modify `src/app/(dashboard)/coach/athletes/page.tsx`:

1. Accept `searchParams.teamId` (already accepts `searchParams.tab`)
2. Fetch teams list in parallel with roster
3. Resolve `teamId` from searchParams or lastTeamId preference
4. Pass `teamId` to `getAthleteRoster(coach.id, teamId)`
5. Render `TeamFilter` component in the header
6. Pass `teamId` to `AddAthleteButton` for auto-assign

Key changes to the server component:
- Add `searchParams.teamId` to the destructured props
- Add `prisma.team.findMany({ where: { coachId: coach.id } })` to the parallel fetch
- Call `getAthleteRoster(coach.id, resolvedTeamId)` instead of `getAthleteRoster(coach.id)`
- Render `<TeamFilter>` between the heading and the tab bar
- Pass `selectedTeamId` prop to `<AddAthleteButton>`

- [ ] **Step 3: Update AddAthleteButton for auto-assign**

Modify `src/app/(dashboard)/coach/athletes/_invite.tsx`:

The `AddAthleteButton` component needs a `selectedTeamId?: string` prop. After the POST to `/api/coach/athletes` succeeds and returns the new athlete's profile ID, if `selectedTeamId` is set (not empty, not "unassigned"), make a best-effort POST to `/api/coach/teams/${selectedTeamId}/members` with `{ athleteIds: [newAthleteId] }`. If it fails, show a warning toast but don't fail the creation.

- [ ] **Step 4: Run typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/"
git commit -m "feat(roster): add team filter dropdown with persistence and auto-assign"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 2: Run all existing tests**

Run: `npx vitest run`
Expected: All tests pass (no regressions)

- [ ] **Step 3: Manual smoke test checklist**

Verify these flows work end-to-end:
1. Navigate to `/coach/teams` — see empty state
2. Create a group "UCSD Throws" — card appears with 0 athletes
3. Click "Manage Members" — see all roster athletes in the add section
4. Add 3 athletes — they appear in "Current Members"
5. Navigate to `/coach/athletes` — see the team filter dropdown
6. Select "UCSD Throws" — only the 3 athletes appear
7. Refresh the page — filter persists (lastTeamId saved)
8. Select "Unassigned" — see athletes not in any group
9. Add a new athlete while "UCSD Throws" is selected — auto-assigned
10. Go back to `/coach/teams` — "UCSD Throws" shows 4 athletes
11. Delete the group — roster falls back to "All Athletes"

- [ ] **Step 4: Push**

```bash
git push origin main
```
