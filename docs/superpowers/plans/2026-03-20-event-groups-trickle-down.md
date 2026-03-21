# Event Groups & Trickle-Down Programming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable team coaches to create event-aware athlete groups and program sessions that trickle down from Team → Group → Individual tiers, resolving to the existing ThrowsAssignment pipeline.

**Architecture:** Rename Team → EventGroup with event-specific fields. Add ProgrammedSession model referencing existing ThrowsSession templates. Publishing resolves the most specific tier per athlete and creates/updates ThrowsAssignment records. Two new UI pages: Event Groups management and Programming Calendar.

**Tech Stack:** Next.js 14.2 App Router, Prisma ORM (PostgreSQL), existing ThrowsSession + ThrowsAssignment models, existing Bondarchuk validation, Tailwind CSS design system.

**Spec:** `docs/superpowers/specs/2026-03-20-event-groups-trickle-down-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `prisma/migrations/YYYYMMDD_add_event_groups/migration.sql` | Manual SQL migration (rename + create) |
| `src/lib/data/event-groups.ts` | Data access: EventGroup CRUD, member management |
| `src/lib/data/programming.ts` | Data access: ProgrammedSession CRUD, resolution logic, publish |
| `src/app/api/coach/event-groups/route.ts` | GET (list) + POST (create) event groups |
| `src/app/api/coach/event-groups/[id]/route.ts` | PUT (update) + DELETE event group |
| `src/app/api/coach/event-groups/[id]/members/route.ts` | POST (add members) |
| `src/app/api/coach/event-groups/[id]/members/[athleteId]/route.ts` | DELETE (remove member) |
| `src/app/api/coach/programming/route.ts` | GET (list by date range) + POST (create session) |
| `src/app/api/coach/programming/[id]/route.ts` | PUT (update) + DELETE session |
| `src/app/api/coach/programming/[id]/override/route.ts` | POST (create override) |
| `src/app/api/coach/programming/[id]/publish/route.ts` | POST (publish + create assignments) |
| `src/app/api/coach/programming/[id]/resolve/[athleteId]/route.ts` | GET (preview effective session for athlete) |
| `src/app/(dashboard)/coach/event-groups/page.tsx` | Event Groups management page |
| `src/app/(dashboard)/coach/event-groups/_group-card.tsx` | Event group card component |
| `src/app/(dashboard)/coach/event-groups/_group-modal.tsx` | Create/edit group modal |
| `src/app/(dashboard)/coach/event-groups/_member-manager.tsx` | Member checkbox list |
| `src/app/(dashboard)/coach/programming/page.tsx` | Programming calendar page |
| `src/app/(dashboard)/coach/programming/_week-calendar.tsx` | Weekly calendar grid |
| `src/app/(dashboard)/coach/programming/_session-card.tsx` | Tier-colored session card |
| `src/app/(dashboard)/coach/programming/_session-sidebar.tsx` | Edit sidebar / bottom sheet |
| `src/app/(dashboard)/coach/programming/_template-picker.tsx` | ThrowsSession template dropdown |
| `src/app/(dashboard)/coach/teams/page.tsx` | Redirect to /coach/event-groups |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Rename Team→EventGroup, add ProgrammedSession, add ThrowsAssignment.programmedSessionId |
| `src/components/ui/Sidebar.tsx` | Update nav: Teams→Event Groups, add Programming, update matchPaths |
| `src/app/(dashboard)/coach/teams/page.tsx` | Replace with redirect to /coach/event-groups |
| `src/app/api/coach/teams/route.ts` | Update Prisma calls Team→EventGroup |
| `src/app/api/coach/teams/[id]/route.ts` | Update Prisma calls Team→EventGroup (if exists) |
| `src/app/api/cron/recurring-forms/route.ts` | Update teamIds→groupIds, Team→EventGroup queries |

---

### Task 1: Schema Migration — Rename Team → EventGroup + New Models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Migration file (hand-edited SQL)

- [ ] **Step 1: Update schema.prisma**

In `prisma/schema.prisma`, make these changes:

1. Rename `Team` model to `EventGroup`, add new fields:
```prisma
model EventGroup {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name        String
  description String?
  events      EventType[]
  color       String?
  order       Int          @default(0)

  members     EventGroupMember[]
  sessions    ProgrammedSession[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([coachId])
}
```

2. Rename `TeamMember` to `EventGroupMember`, rename `teamId` to `groupId`:
```prisma
model EventGroupMember {
  id        String         @id @default(cuid())
  groupId   String
  group     EventGroup     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  joinedAt  DateTime       @default(now())

  @@unique([groupId, athleteId])
  @@index([groupId])
  @@index([athleteId])
}
```

3. Add `ProgrammedSession` model:
```prisma
model ProgrammedSession {
  id              String            @id @default(cuid())
  coachId         String
  coach           CoachProfile      @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title           String
  scheduledDate   String            // YYYY-MM-DD
  notes           String?

  throwsSessionId String
  throwsSession   ThrowsSession     @relation(fields: [throwsSessionId], references: [id], onDelete: Cascade)

  tier            String            // TEAM | GROUP | INDIVIDUAL
  groupId         String?
  group           EventGroup?       @relation(fields: [groupId], references: [id], onDelete: SetNull)
  athleteId       String?
  athlete         AthleteProfile?   @relation(fields: [athleteId], references: [id], onDelete: SetNull)

  parentId        String?
  parent          ProgrammedSession?  @relation("SessionOverrides", fields: [parentId], references: [id], onDelete: Cascade)
  overrides       ProgrammedSession[] @relation("SessionOverrides")

  assignments     ThrowsAssignment[]

  status          String    @default("DRAFT") // DRAFT | PUBLISHED
  publishedAt     DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([coachId, scheduledDate])
  @@index([groupId])
  @@index([athleteId])
  @@index([parentId])
  @@index([tier])
}
```

4. Add to `ThrowsAssignment`:
```prisma
  programmedSessionId String?
  programmedSession   ProgrammedSession? @relation(fields: [programmedSessionId], references: [id], onDelete: SetNull)
```
And add `@@index([programmedSessionId])` to ThrowsAssignment.

5. Add to `ThrowsSession`:
```prisma
  programmedSessions ProgrammedSession[]
```

6. Update `CoachProfile` relations: replace `teams Team[]` with `eventGroups EventGroup[]`, add `programmedSessions ProgrammedSession[]`

7. Update `AthleteProfile` relations: replace `teamMemberships TeamMember[]` with `eventGroupMemberships EventGroupMember[]`, add `programmedSessions ProgrammedSession[]`

8. In `RecurringSchedule`, rename `teamIds` to `groupIds` (if this model exists).

- [ ] **Step 2: Create migration with --create-only**

Run: `npx prisma migrate dev --create-only --name add_event_groups_trickle_down`

This generates the SQL file but does NOT apply it yet.

- [ ] **Step 3: Hand-edit the migration SQL**

Open the generated migration file and replace any `DROP TABLE "Team"` / `CREATE TABLE "EventGroup"` with rename operations:

```sql
-- Rename tables instead of drop/create
ALTER TABLE "Team" RENAME TO "EventGroup";
ALTER TABLE "TeamMember" RENAME TO "EventGroupMember";

-- Rename columns
ALTER TABLE "EventGroupMember" RENAME COLUMN "teamId" TO "groupId";

-- Add new columns to EventGroup
ALTER TABLE "EventGroup" ADD COLUMN "events" "EventType"[] DEFAULT '{}';
ALTER TABLE "EventGroup" ADD COLUMN "color" TEXT;
ALTER TABLE "EventGroup" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Rename indexes (Prisma generates new names)
ALTER INDEX "Team_coachId_idx" RENAME TO "EventGroup_coachId_idx";
ALTER INDEX "TeamMember_teamId_athleteId_key" RENAME TO "EventGroupMember_groupId_athleteId_key";
ALTER INDEX "TeamMember_teamId_idx" RENAME TO "EventGroupMember_groupId_idx";
ALTER INDEX "TeamMember_athleteId_idx" RENAME TO "EventGroupMember_athleteId_idx";

-- Rename foreign key constraints
ALTER TABLE "EventGroup" RENAME CONSTRAINT "Team_coachId_fkey" TO "EventGroup_coachId_fkey";
ALTER TABLE "EventGroupMember" RENAME CONSTRAINT "TeamMember_teamId_fkey" TO "EventGroupMember_groupId_fkey";
ALTER TABLE "EventGroupMember" RENAME CONSTRAINT "TeamMember_athleteId_fkey" TO "EventGroupMember_athleteId_fkey";

-- Create ProgrammedSession table
CREATE TABLE "ProgrammedSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "notes" TEXT,
    "throwsSessionId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "groupId" TEXT,
    "athleteId" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgrammedSession_pkey" PRIMARY KEY ("id")
);

-- ProgrammedSession indexes
CREATE INDEX "ProgrammedSession_coachId_scheduledDate_idx" ON "ProgrammedSession"("coachId", "scheduledDate");
CREATE INDEX "ProgrammedSession_groupId_idx" ON "ProgrammedSession"("groupId");
CREATE INDEX "ProgrammedSession_athleteId_idx" ON "ProgrammedSession"("athleteId");
CREATE INDEX "ProgrammedSession_parentId_idx" ON "ProgrammedSession"("parentId");
CREATE INDEX "ProgrammedSession_tier_idx" ON "ProgrammedSession"("tier");

-- ProgrammedSession foreign keys
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_throwsSessionId_fkey" FOREIGN KEY ("throwsSessionId") REFERENCES "ThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProgrammedSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add programmedSessionId to ThrowsAssignment
ALTER TABLE "ThrowsAssignment" ADD COLUMN "programmedSessionId" TEXT;
CREATE INDEX "ThrowsAssignment_programmedSessionId_idx" ON "ThrowsAssignment"("programmedSessionId");
ALTER TABLE "ThrowsAssignment" ADD CONSTRAINT "ThrowsAssignment_programmedSessionId_fkey" FOREIGN KEY ("programmedSessionId") REFERENCES "ProgrammedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Keep any remaining auto-generated SQL for RecurringSchedule rename if applicable. Remove any DROP TABLE statements for Team/TeamMember.

- [ ] **Step 4: Apply migration**

Run: `npm run db:migrate`

- [ ] **Step 5: Generate Prisma client**

Run: `npx prisma generate`
Expected: Client generated successfully. Note: `tsc --noEmit` will fail at this point because existing code still references `Team`/`TeamMember`. That is fixed in Task 2 which must be done immediately after.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add EventGroup + ProgrammedSession schema (rename Team → EventGroup)"
```

> **Note**: Tasks 1 and 2 are an atomic pair — the codebase will not compile between them. Complete both before moving to Task 3.

---

### Task 2: Update Existing Code References (Team → EventGroup)

**Files:**
- Modify: `src/app/(dashboard)/coach/teams/page.tsx` (replace with redirect)
- Modify: `src/components/ui/Sidebar.tsx`
- Modify: Any files referencing `Team` or `TeamMember` Prisma models
- Modify: `src/app/api/coach/teams/route.ts` and `[id]/route.ts`

- [ ] **Step 1: Find all references to Team/TeamMember**

Run: `grep -rn "teamMemberships\|\.teams\b\|Team\b\|TeamMember" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"`

Update all Prisma query references:
- `prisma.team.` → `prisma.eventGroup.`
- `prisma.teamMember.` → `prisma.eventGroupMember.`
- `team.members` → `eventGroup.members` (relation name stays `members`)
- `teamMemberships` → `eventGroupMemberships` on AthleteProfile
- `teams` → `eventGroups` on CoachProfile

- [ ] **Step 2: Replace coach teams page with redirect**

Replace the entire contents of `src/app/(dashboard)/coach/teams/page.tsx` with:

```typescript
import { redirect } from "next/navigation";

export default function TeamsRedirect() {
  redirect("/coach/event-groups");
}
```

- [ ] **Step 3: Update Sidebar navigation**

In `src/components/ui/Sidebar.tsx`:
- Import `CalendarRange` from lucide-react
- In the Athletes group children, replace `{ label: "Teams", href: "/coach/teams", icon: <UsersRound {...iconSize} /> }` with `{ label: "Event Groups", href: "/coach/event-groups", icon: <UsersRound {...iconSize} /> }`
- Update Athletes parent `matchPaths`: replace `/coach/teams` with `/coach/event-groups`
- In the Training group children, add: `{ label: "Programming", href: "/coach/programming", icon: <CalendarRange {...iconSize} /> }`
- Add `/coach/programming` to Training parent `matchPaths`

- [ ] **Step 4: Update API routes and cron job**

Update `src/app/api/coach/teams/route.ts` — change Prisma calls from `prisma.team` to `prisma.eventGroup` and `prisma.teamMember` to `prisma.eventGroupMember`. Similarly for `[id]/route.ts` if it exists.

Update `src/app/api/cron/recurring-forms/route.ts` — change any references to `teamIds` → `groupIds` and `prisma.team` → `prisma.eventGroup`. This cron job resolves group IDs at runtime for recurring form distribution.

These old `/api/coach/teams` API routes can be deprecated later once the new event-groups routes are built (Task 3).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/ prisma/
git commit -m "refactor: update all Team → EventGroup references"
```

---

### Task 3: Event Groups Data Layer + API Routes

**Files:**
- Create: `src/lib/data/event-groups.ts`
- Create: `src/app/api/coach/event-groups/route.ts`
- Create: `src/app/api/coach/event-groups/[id]/route.ts`
- Create: `src/app/api/coach/event-groups/[id]/members/route.ts`
- Create: `src/app/api/coach/event-groups/[id]/members/[athleteId]/route.ts`

- [ ] **Step 1: Create data layer**

Create `src/lib/data/event-groups.ts`:

```typescript
import { cache } from "react";
import prisma from "@/lib/prisma";
import type { EventType } from "@prisma/client";

export interface EventGroupWithCounts {
  id: string;
  name: string;
  description: string | null;
  events: EventType[];
  color: string | null;
  order: number;
  memberCount: number;
  members: {
    id: string;
    athleteId: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    events: EventType[];
  }[];
}

export const getEventGroups = cache(async (coachId: string): Promise<EventGroupWithCounts[]> => {
  const groups = await prisma.eventGroup.findMany({
    where: { coachId },
    orderBy: { order: "asc" },
    include: {
      members: {
        include: {
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              events: true,
            },
          },
        },
      },
    },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    events: g.events,
    color: g.color,
    order: g.order,
    memberCount: g.members.length,
    members: g.members.map((m) => ({
      id: m.id,
      athleteId: m.athlete.id,
      firstName: m.athlete.firstName,
      lastName: m.athlete.lastName,
      avatarUrl: m.athlete.avatarUrl,
      events: m.athlete.events,
    })),
  }));
});

export async function createEventGroup(coachId: string, data: {
  name: string;
  events: EventType[];
  color?: string;
  description?: string;
}) {
  return prisma.eventGroup.create({
    data: { coachId, ...data },
  });
}

export async function updateEventGroup(id: string, coachId: string, data: {
  name?: string;
  events?: EventType[];
  color?: string | null;
  description?: string | null;
  order?: number;
}) {
  return prisma.eventGroup.update({
    where: { id, coachId },
    data,
  });
}

export async function deleteEventGroup(id: string, coachId: string) {
  return prisma.eventGroup.delete({ where: { id, coachId } });
}

export async function addMembers(groupId: string, coachId: string, athleteIds: string[]) {
  // Verify group belongs to coach
  const group = await prisma.eventGroup.findFirst({ where: { id: groupId, coachId } });
  if (!group) throw new Error("Group not found");

  return prisma.eventGroupMember.createMany({
    data: athleteIds.map((athleteId) => ({ groupId, athleteId })),
    skipDuplicates: true,
  });
}

export async function removeMember(groupId: string, coachId: string, athleteId: string) {
  const group = await prisma.eventGroup.findFirst({ where: { id: groupId, coachId } });
  if (!group) throw new Error("Group not found");

  return prisma.eventGroupMember.deleteMany({
    where: { groupId, athleteId },
  });
}
```

- [ ] **Step 2: Create GET + POST API route**

Create `src/app/api/coach/event-groups/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEventGroups, createEventGroup } from "@/lib/data/event-groups";

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
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const groups = await getEventGroups(coach.id);
    return NextResponse.json({ ok: true, data: groups });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load event groups" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const body = await req.json();
    const { name, events, color, description } = body;
    if (!name || !events?.length) {
      return NextResponse.json({ error: "Name and at least one event are required" }, { status: 400 });
    }

    const group = await createEventGroup(coach.id, { name, events, color, description });
    return NextResponse.json({ ok: true, data: group }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create event group" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create [id] route (PUT + DELETE)**

Create `src/app/api/coach/event-groups/[id]/route.ts` following the same auth pattern. PUT calls `updateEventGroup`, DELETE calls `deleteEventGroup`.

- [ ] **Step 4: Create members routes**

Create `src/app/api/coach/event-groups/[id]/members/route.ts` (POST — add members) and `src/app/api/coach/event-groups/[id]/members/[athleteId]/route.ts` (DELETE — remove member). Both follow the same auth pattern and delegate to data layer functions.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/event-groups.ts src/app/api/coach/event-groups/
git commit -m "feat: add Event Groups data layer and API routes"
```

---

### Task 4: Event Groups UI Page

**Files:**
- Create: `src/app/(dashboard)/coach/event-groups/page.tsx`
- Create: `src/app/(dashboard)/coach/event-groups/_group-card.tsx`
- Create: `src/app/(dashboard)/coach/event-groups/_group-modal.tsx`
- Create: `src/app/(dashboard)/coach/event-groups/_member-manager.tsx`

- [ ] **Step 1: Create group card component**

Create `src/app/(dashboard)/coach/event-groups/_group-card.tsx`:
- Client component
- Receives group data (name, events, color, memberCount, members array)
- Renders `card card-interactive` with: color dot, name, event badges (`<Badge variant="neutral">`), member count, avatar stack (max 4 + overflow count)
- `onClick` prop for selection

- [ ] **Step 2: Create group modal**

Create `src/app/(dashboard)/coach/event-groups/_group-modal.tsx`:
- Client component using `<Modal>` from components
- Form: name `<Input>`, events checkboxes (SHOT_PUT, DISCUS, HAMMER, JAVELIN), color picker (8 preset hex colors as circles), description `<textarea className="input">`
- Handles both create (POST) and edit (PUT) modes based on whether `group` prop is provided
- Calls API, fires `onSaved` callback on success

- [ ] **Step 3: Create member manager**

Create `src/app/(dashboard)/coach/event-groups/_member-manager.tsx`:
- Client component
- Fetches roster athletes from existing `/api/coach/athletes` or equivalent
- Shows checkbox list filtered by group events (athletes whose events overlap)
- Pre-checks athletes already in the group
- "Save" button calls POST/DELETE member endpoints for diff
- Shows `<Avatar>` + name + event badges for each athlete

- [ ] **Step 4: Create main page**

Create `src/app/(dashboard)/coach/event-groups/page.tsx`:
- Client component (`"use client"`)
- Fetches groups from `/api/coach/event-groups`
- Header: "Event Groups" h1 + "Create Group" `<Button variant="primary">`
- `<StaggeredList className="grid grid-cols-1 sm:grid-cols-2 gap-4">` of group cards
- Click card → expand member manager below card (or navigate to detail)
- `<ScrollProgressBar />` if page has depth
- Empty state with `<EmptyState>` component
- Loading state with shimmer skeletons

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/coach/event-groups/"
git commit -m "feat: add Event Groups management page with CRUD and member management"
```

---

### Task 5: Programming Data Layer + Resolution Logic

**Files:**
- Create: `src/lib/data/programming.ts`

- [ ] **Step 1: Create programming data layer**

Create `src/lib/data/programming.ts` with these functions:

```typescript
import { cache } from "react";
import prisma from "@/lib/prisma";

export type SessionTier = "TEAM" | "GROUP" | "INDIVIDUAL";

export interface ProgrammedSessionWithDetails {
  id: string;
  title: string;
  scheduledDate: string;
  notes: string | null;
  tier: SessionTier;
  status: string;
  publishedAt: string | null;
  throwsSession: {
    id: string;
    name: string;
    event: string;
    sessionType: string;
    blockCount: number;
  };
  group: { id: string; name: string; color: string | null } | null;
  athlete: { id: string; firstName: string; lastName: string } | null;
  parentId: string | null;
  overrideCount: number;
}

// Get all programmed sessions for a date range
export const getProgrammedSessions = cache(
  async (coachId: string, start: string, end: string): Promise<ProgrammedSessionWithDetails[]> => {
    const sessions = await prisma.programmedSession.findMany({
      where: {
        coachId,
        scheduledDate: { gte: start, lte: end },
      },
      include: {
        throwsSession: {
          select: {
            id: true, name: true, event: true, sessionType: true,
            blocks: { select: { id: true } },
          },
        },
        group: { select: { id: true, name: true, color: true } },
        athlete: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { overrides: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      scheduledDate: s.scheduledDate,
      notes: s.notes,
      tier: s.tier as SessionTier,
      status: s.status,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      throwsSession: {
        id: s.throwsSession.id,
        name: s.throwsSession.name,
        event: s.throwsSession.event,
        sessionType: s.throwsSession.sessionType,
        blockCount: s.throwsSession.blocks.length,
      },
      group: s.group,
      athlete: s.athlete ? { id: s.athlete.id, firstName: s.athlete.firstName, lastName: s.athlete.lastName } : null,
      parentId: s.parentId,
      overrideCount: s._count.overrides,
    }));
  }
);

// Create a programmed session
export async function createProgrammedSession(coachId: string, data: {
  title: string;
  scheduledDate: string;
  throwsSessionId: string;
  tier: SessionTier;
  groupId?: string;
  athleteId?: string;
  parentId?: string;
  notes?: string;
}) {
  return prisma.programmedSession.create({
    data: { coachId, ...data },
  });
}

// Update a programmed session
export async function updateProgrammedSession(id: string, coachId: string, data: {
  title?: string;
  throwsSessionId?: string;
  notes?: string | null;
  scheduledDate?: string;
}) {
  return prisma.programmedSession.update({
    where: { id, coachId },
    data,
  });
}

// Delete a programmed session (cascades overrides)
export async function deleteProgrammedSession(id: string, coachId: string) {
  return prisma.programmedSession.delete({ where: { id, coachId } });
}

// Create an override for a parent session
export async function createOverride(parentId: string, coachId: string, data: {
  throwsSessionId: string;
  tier: SessionTier;
  groupId?: string;
  athleteId?: string;
}) {
  const parent = await prisma.programmedSession.findFirst({
    where: { id: parentId, coachId },
  });
  if (!parent) throw new Error("Parent session not found");

  return prisma.programmedSession.create({
    data: {
      coachId,
      title: parent.title,
      scheduledDate: parent.scheduledDate,
      parentId,
      ...data,
    },
  });
}

// RESOLUTION: Get effective throwsSessionId for an athlete on a date
export async function resolveEffectiveSession(
  coachId: string,
  athleteId: string,
  scheduledDate: string
): Promise<{ throwsSessionId: string; tier: SessionTier; sourceId: string } | null> {
  // Get all published sessions for this date
  const sessions = await prisma.programmedSession.findMany({
    where: { coachId, scheduledDate, status: "PUBLISHED" },
    include: {
      group: {
        include: {
          members: { where: { athleteId }, select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Find team-level sessions
  const teamSessions = sessions.filter((s) => s.tier === "TEAM" && !s.parentId);

  for (const teamSession of teamSessions) {
    // Check for individual override
    const individualOverride = sessions.find(
      (s) => s.tier === "INDIVIDUAL" && s.parentId === teamSession.id && s.athleteId === athleteId
    );
    if (individualOverride) {
      return {
        throwsSessionId: individualOverride.throwsSessionId,
        tier: "INDIVIDUAL",
        sourceId: individualOverride.id,
      };
    }

    // Check for group override (athlete must be a member of that group)
    // Tiebreaker: lowest group order wins
    const groupOverrides = sessions
      .filter(
        (s) =>
          s.tier === "GROUP" &&
          s.parentId === teamSession.id &&
          s.group?.members && s.group.members.length > 0
      )
      .sort((a, b) => (a.group?.order ?? 999) - (b.group?.order ?? 999));

    if (groupOverrides.length > 0) {
      return {
        throwsSessionId: groupOverrides[0].throwsSessionId,
        tier: "GROUP",
        sourceId: groupOverrides[0].id,
      };
    }

    // Fall back to team session
    return {
      throwsSessionId: teamSession.throwsSessionId,
      tier: "TEAM",
      sourceId: teamSession.id,
    };
  }

  return null;
}

// PUBLISH: Resolve and create/update ThrowsAssignments
export async function publishSession(id: string, coachId: string) {
  const session = await prisma.programmedSession.findFirst({
    where: { id, coachId },
    include: {
      group: { include: { members: { select: { athleteId: true } } } },
    },
  });
  if (!session) throw new Error("Session not found");

  // Mark as published
  await prisma.programmedSession.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Determine affected athletes
  let athleteIds: string[];
  if (session.tier === "INDIVIDUAL" && session.athleteId) {
    athleteIds = [session.athleteId];
  } else if (session.tier === "GROUP" && session.group) {
    athleteIds = session.group.members.map((m) => m.athleteId);
  } else {
    // TEAM: all roster athletes
    const roster = await prisma.athleteProfile.findMany({
      where: { coachId },
      select: { id: true },
    });
    athleteIds = roster.map((a) => a.id);
  }

  let created = 0;
  let updated = 0;

  // For the root session being published, find its root (walk up parentId chain)
  const rootId = session.parentId ?? session.id;

  for (const athleteId of athleteIds) {
    const resolved = await resolveEffectiveSession(coachId, athleteId, session.scheduledDate);
    if (!resolved) continue;

    // Check for existing assignment from this programming chain
    const existing = await prisma.throwsAssignment.findFirst({
      where: {
        athleteId,
        assignedDate: session.scheduledDate,
        programmedSessionId: { not: null },
      },
    });

    if (existing) {
      // Skip if already completed or in progress
      if (existing.status === "COMPLETED" || existing.status === "IN_PROGRESS") continue;
      await prisma.throwsAssignment.update({
        where: { id: existing.id },
        data: {
          sessionId: resolved.throwsSessionId,
          programmedSessionId: resolved.sourceId,
        },
      });
      updated++;
    } else {
      await prisma.throwsAssignment.create({
        data: {
          sessionId: resolved.throwsSessionId,
          athleteId,
          assignedDate: session.scheduledDate,
          programmedSessionId: resolved.sourceId,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/programming.ts
git commit -m "feat: add programming data layer with trickle-down resolution and publish logic"
```

---

### Task 6: Programming API Routes

**Files:**
- Create: `src/app/api/coach/programming/route.ts`
- Create: `src/app/api/coach/programming/[id]/route.ts`
- Create: `src/app/api/coach/programming/[id]/override/route.ts`
- Create: `src/app/api/coach/programming/[id]/publish/route.ts`

- [ ] **Step 1: Create main route (GET + POST)**

Create `src/app/api/coach/programming/route.ts` following the auth pattern from Task 3. GET takes `?start=YYYY-MM-DD&end=YYYY-MM-DD` query params and calls `getProgrammedSessions`. POST creates a new session via `createProgrammedSession`.

- [ ] **Step 2: Create [id] route (PUT + DELETE)**

Create `src/app/api/coach/programming/[id]/route.ts`. PUT calls `updateProgrammedSession`, DELETE calls `deleteProgrammedSession`.

- [ ] **Step 3: Create override route**

Create `src/app/api/coach/programming/[id]/override/route.ts`. POST calls `createOverride`.

- [ ] **Step 4: Create publish route**

Create `src/app/api/coach/programming/[id]/publish/route.ts`. POST calls `publishSession`, returns `{ ok: true, assignmentsCreated, assignmentsUpdated }`.

- [ ] **Step 5: Create resolve endpoint**

Create `src/app/api/coach/programming/[id]/resolve/[athleteId]/route.ts`. GET calls `resolveEffectiveSession`, returns `{ ok: true, data: { effectiveSessionId, tier, source } }`. This is a read-only preview endpoint — does not create assignments.

- [ ] **Step 6: CSRF validation**

Ensure all POST/PUT/DELETE handlers validate the CSRF header. The existing pattern from the middleware auto-sets a CSRF cookie; API routes should verify it. Check how existing mutation routes (e.g., `/api/coach/teams/route.ts` POST) handle this — follow the same pattern. Client code uses `csrfHeaders()` from `@/lib/csrf-client`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/app/api/coach/programming/
git commit -m "feat: add Programming API routes (CRUD, override, publish, resolve)"
```

---

### Task 7: Programming Calendar UI — Week Calendar + Session Cards

**Files:**
- Create: `src/app/(dashboard)/coach/programming/page.tsx`
- Create: `src/app/(dashboard)/coach/programming/_week-calendar.tsx`
- Create: `src/app/(dashboard)/coach/programming/_session-card.tsx`

- [ ] **Step 1: Create session card**

Create `src/app/(dashboard)/coach/programming/_session-card.tsx`:
- Client component
- Props: session data, onClick handler
- Tier color coding:
  - TEAM: `border-l-4 border-l-info-500 bg-info-50 dark:bg-info-500/5`
  - GROUP: `border-l-4 border-l-primary-500 bg-primary-50 dark:bg-primary-500/5`
  - INDIVIDUAL: `border-l-4 border-l-success-500 bg-success-50 dark:bg-success-500/5`
- Inherited sessions (has parentId but same throwsSession as parent): dashed border-l + "Inherited" text-muted label
- Overridden sessions (has overrides — `overrideCount > 0`): solid border + amber `<Badge variant="warning">Override</Badge>`
- Shows: title, template name (text-xs text-muted), status badge (`<Badge>`)
- Compact: padding p-3, rounded-xl

- [ ] **Step 2: Create week calendar**

Create `src/app/(dashboard)/coach/programming/_week-calendar.tsx`:
- Client component
- Props: `sessions[]`, `weekStart` (Date), `onClickDay(date)`, `onClickSession(session)`, `activeGroupFilter` (string | null)
- Renders 7 columns (Mon–Sun)
- Day header: abbreviated day + date number
- Session cards stacked vertically within each day
- Filters sessions by `activeGroupFilter` (null = show all)
- Inherited sessions: if a TEAM session exists for a day and the filter is a specific group, show the team session as inherited unless overridden
- Empty day cells are clickable (`onClick` → `onClickDay`)
- Mobile: horizontal scroll with `overflow-x-auto`

- [ ] **Step 3: Create main page**

Create `src/app/(dashboard)/coach/programming/page.tsx`:
- Client component (`"use client"`)
- State: `weekStart` (Date, defaults to current week Monday), `sessions`, `groups`, `activeTab`
- Fetch groups from `/api/coach/event-groups` on mount
- Fetch sessions from `/api/coach/programming?start=...&end=...` when weekStart changes
- `<ScrollProgressBar />`
- Header: week navigator (`<` button, "Week of Mar 16" label, `>` button)
- `<Tabs>` with dynamic tabs: "All" + one per group + "Unassigned" (athletes not in any group)
- `<WeekCalendar>` with filtered sessions
- Click day → open create sidebar (Task 8)
- Click session → open edit sidebar (Task 8)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/programming/"
git commit -m "feat: add Programming calendar page with week view and tier-colored session cards"
```

---

### Task 8: Programming Sidebar — Create/Edit/Publish Sessions

**Files:**
- Create: `src/app/(dashboard)/coach/programming/_session-sidebar.tsx`
- Create: `src/app/(dashboard)/coach/programming/_template-picker.tsx`

- [ ] **Step 1: Create template picker**

Create `src/app/(dashboard)/coach/programming/_template-picker.tsx`:
- Client component
- Fetches ThrowsSession templates from existing `/api/throws/sessions` (GET)
- Dropdown select showing: template name, event badge, block count
- Validation indicator: shows green checkmark or amber warning icon per template (validate using existing `validateSession()` from `src/lib/throws/validation.ts` — or simpler: just show block count + event, since templates were validated at creation time)
- `onChange(throwsSessionId)` callback

- [ ] **Step 2: Create session sidebar**

Create `src/app/(dashboard)/coach/programming/_session-sidebar.tsx`:
- Client component
- Slides in from right on desktop (`fixed right-0 inset-y-0 w-[400px]`), bottom sheet on mobile
- Backdrop overlay with click-to-close
- Two modes: Create (empty form) and Edit (pre-filled)
- Form fields:
  - Title `<Input>`
  - Template picker `<TemplatePicker>`
  - Notes `<textarea className="input">`
- Actions:
  - "Save Draft" button (`<Button variant="secondary">`)
  - "Publish" button (`<Button variant="primary">`) — calls publish endpoint
  - "Create Override" button (only on TEAM-tier sessions) → opens override sub-flow:
    - Choose: "For a Group" or "For an Individual"
    - If group: select from event groups list
    - If individual: select from athlete roster
    - Pick a different template
    - Calls override endpoint
  - "Delete" button (`<Button variant="ghost">` in danger text color)
- Shows Bondarchuk warning banner if template has validation issues
- `<SlideToConfirm>` on mobile for Publish and Delete actions
- Close on Escape key

- [ ] **Step 3: Wire sidebar into page**

In `page.tsx`, add sidebar state management:
- `sidebarMode: null | "create" | "edit"`
- `selectedSession: ProgrammedSessionWithDetails | null`
- `selectedDate: string | null`
- Open sidebar on day click (create) or session click (edit)
- Close sidebar resets state and refetches sessions

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/programming/"
git commit -m "feat: add programming session sidebar with template picker, publish, and override creation"
```

---

### Task 9: Final Verification + Cleanup

**Files:**
- Verify all files compile and lint clean

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `npx next lint`
Expected: 0 new errors (pre-existing warnings OK)

- [ ] **Step 3: Verify navigation**

Check that `COACH_NAV_SECTIONS` in Sidebar.tsx includes:
- "Event Groups" under Athletes with href `/coach/event-groups`
- "Programming" under Training with href `/coach/programming`
- `/coach/teams` redirects to `/coach/event-groups`

- [ ] **Step 4: Verify design system compliance**

Audit all new pages:
- `card-interactive` on navigable cards
- `<StaggeredList>` on card grids
- Lucide icons with `strokeWidth={1.75}`
- Color tokens (no hardcoded hex except in color picker presets)
- Mobile-first responsive
- `<ScrollProgressBar />` on pages with scroll depth
- `<Button>` component (not `btn-primary` class) for new buttons
- `<SlideToConfirm>` on mobile for high-stakes actions

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Event Groups & Trickle-Down Programming — complete implementation"
```
