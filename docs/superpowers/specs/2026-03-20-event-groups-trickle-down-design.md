# Event Groups & Trickle-Down Programming — Design Spec

## Goal

Enable team coaches managing 10-30+ athletes to write ONE session template at the team level and have it "trickle down" to event groups and individuals, with Bondarchuk-aware overrides at each tier. This is the foundational system for team-scale programming.

## Architecture

The system adds two concepts on top of the existing `ThrowsSession` template + `ThrowsAssignment` pipeline:

1. **EventGroup** — replaces the generic `Team` model with event-aware athlete groupings
2. **ProgrammedSession** — a 3-tier scheduling layer (Team > Group > Individual) that references existing `ThrowsSession` templates and resolves to `ThrowsAssignment` records on publish

No new block/exercise models. The existing session builder creates templates; this system assigns them.

## Tech Stack

- Prisma schema additions (2 new models, 1 renamed model)
- Next.js 14.2 App Router API routes + Server/Client Components
- Existing ThrowsSession templates + ThrowsAssignment pipeline
- Existing Bondarchuk validation (`src/lib/throws/validation.ts`)
- Existing design system (Tabs, StaggeredList, card-interactive, etc.)

---

## 1. Data Model

### 1.1 EventGroup (replaces Team)

Rename `Team` → `EventGroup`, `TeamMember` → `EventGroupMember`. Add event-specific fields.

```prisma
model EventGroup {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name        String       // e.g. "Shot/Disc Group", "Hammer Squad"
  description String?
  events      EventType[]  // Which events this group covers
  color       String?      // Hex color for calendar display
  order       Int          @default(0)

  members     EventGroupMember[]
  sessions    ProgrammedSession[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([coachId])
}

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

**Migration from Team**: Requires manual SQL in the migration file because Prisma cannot detect table renames (it drops and recreates). The migration must use:
```sql
ALTER TABLE "Team" RENAME TO "EventGroup";
ALTER TABLE "TeamMember" RENAME TO "EventGroupMember";
ALTER TABLE "EventGroupMember" RENAME COLUMN "teamId" TO "groupId";
-- Add new columns with defaults
ALTER TABLE "EventGroup" ADD COLUMN "events" "EventType"[] DEFAULT '{}';
ALTER TABLE "EventGroup" ADD COLUMN "color" TEXT;
ALTER TABLE "EventGroup" ADD COLUMN "order" INTEGER DEFAULT 0;
-- Rename indexes and constraints accordingly
```
Existing data preserved — teams become event groups with empty `events[]` arrays (coach fills in later).

**CoachProfile relation change**: `teams Team[]` → `eventGroups EventGroup[]`
**AthleteProfile relation change**: `teamMemberships TeamMember[]` → `eventGroupMemberships EventGroupMember[]`

**RecurringSchedule.teamIds**: This `String[]` field stores team IDs for recurring form distribution. After the rename, the data is still valid (same CUIDs), but the field should be renamed to `groupIds` and its resolution logic in `src/app/api/cron/recurring-forms/route.ts` should query `EventGroup` instead of `Team`.

**Type note**: `EventGroup.events` uses the `EventType` enum, but `ThrowsSession.event` is a plain `String`. When filtering templates by group events, compare with explicit cast: `group.events.map(String).includes(session.event)`.

### 1.2 ProgrammedSession (trickle-down core)

```prisma
model ProgrammedSession {
  id              String       @id @default(cuid())
  coachId         String
  coach           CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title           String
  scheduledDate   String       // YYYY-MM-DD (matches ThrowsAssignment.assignedDate)
  notes           String?

  // Template reference — the actual session content
  throwsSessionId String
  throwsSession   ThrowsSession @relation(fields: [throwsSessionId], references: [id], onDelete: Cascade)

  // Tier system
  tier            String       // "TEAM" | "GROUP" | "INDIVIDUAL"
  groupId         String?      // null for TEAM tier; set for GROUP tier
  group           EventGroup?  @relation(fields: [groupId], references: [id], onDelete: SetNull)
  athleteId       String?      // non-null only for INDIVIDUAL tier
  athlete         AthleteProfile? @relation(fields: [athleteId], references: [id], onDelete: SetNull)

  // Override chain
  parentId        String?      // points to the TEAM or GROUP session this overrides
  parent          ProgrammedSession?  @relation("SessionOverrides", fields: [parentId], references: [id], onDelete: Cascade)
  overrides       ProgrammedSession[] @relation("SessionOverrides")

  // Status
  status          String       @default("DRAFT") // DRAFT | PUBLISHED
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

**New relations to add**:
- `CoachProfile`: `programmedSessions ProgrammedSession[]`
- `AthleteProfile`: `programmedSessions ProgrammedSession[]`
- `ThrowsSession`: `programmedSessions ProgrammedSession[]`

**ThrowsAssignment addition** — add a nullable link back to the programming system:
```prisma
  // On ThrowsAssignment, add:
  programmedSessionId String?
  programmedSession   ProgrammedSession? @relation(fields: [programmedSessionId], references: [id], onDelete: SetNull)
```
This tags assignments created by the programming system. Manual assignments have `programmedSessionId = null`. Re-publish updates only assignments tagged with the same `programmedSessionId`.

### 1.3 Tier Semantics

| Tier | groupId | athleteId | parentId | Meaning |
|------|---------|-----------|----------|---------|
| TEAM | null | null | null | Applies to entire roster |
| GROUP | set | null | team session id | Overrides team session for this group |
| INDIVIDUAL | null | set | team or group session id | Overrides for one specific athlete |

---

## 2. Resolution Logic

### 2.1 Trickle-Down Resolution Algorithm

```
resolveEffectiveSession(athleteId, scheduledDate, coachId):
  1. Find all ProgrammedSessions for (coachId, scheduledDate, status=PUBLISHED)
  2. For each TEAM session on that date:
     a. Check: does an INDIVIDUAL override exist for this athlete? → use it
     b. Check: does a GROUP override exist for any group this athlete belongs to? → use it
        - If the athlete is in MULTIPLE groups with overrides for the same parent,
          use the override from the group with the LOWEST `order` value (first in the coach's sort).
          This is deterministic and coach-controllable via drag-reorder on the Event Groups page.
     c. Fall back → use the TEAM session's throwsSessionId
  3. Return the resolved throwsSessionId for this athlete
```

### 2.2 Publish Flow

When coach clicks "Publish" on a ProgrammedSession:

1. Set `status = "PUBLISHED"`, `publishedAt = now()`
2. Determine affected athletes:
   - TEAM tier: all roster athletes
   - GROUP tier: all members of that group
   - INDIVIDUAL tier: that one athlete
3. For each affected athlete, run resolution algorithm for that date
4. Create or update `ThrowsAssignment` records:
   - **Important**: `ThrowsAssignment` has no unique constraint on `(athleteId, assignedDate)` — the system intentionally allows multiple assignments per athlete per day (e.g., morning throws + afternoon lifting). Programmed sessions must coexist with manual assignments.
   - **Pattern**: Query for existing assignment with matching `(athleteId, assignedDate, programmedSessionId)`. If found, update its `sessionId`. If not, create a new one.
   - Add a `programmedSessionId String?` field to `ThrowsAssignment` to tag assignments created by the programming system vs manual ones. This allows re-publish to update only its own assignments without touching manually created ones.
5. Skip athletes who already have a `COMPLETED` or `IN_PROGRESS` assignment **from this programmed session** for that date

### 2.3 Re-publish on Override Changes

When a GROUP or INDIVIDUAL override is added/changed/removed:
- Only recalculate assignments for affected athletes (group members or the individual)
- Don't touch assignments for athletes not affected by the change
- Don't touch assignments with status `COMPLETED` or `IN_PROGRESS`

---

## 3. API Routes

### 3.1 Event Groups

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/coach/event-groups` | `{ name, events[], color?, description? }` | EventGroup |
| GET | `/api/coach/event-groups` | — | EventGroup[] with member counts |
| PUT | `/api/coach/event-groups/[id]` | `{ name?, events?, color?, description?, order? }` | EventGroup |
| DELETE | `/api/coach/event-groups/[id]` | — | `{ ok: true }` |
| POST | `/api/coach/event-groups/[id]/members` | `{ athleteIds: string[] }` | EventGroupMember[] |
| DELETE | `/api/coach/event-groups/[id]/members/[athleteId]` | — | `{ ok: true }` |

### 3.2 Programmed Sessions

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/coach/programming` | `{ title, scheduledDate, throwsSessionId, tier, groupId?, athleteId?, parentId?, notes? }` | ProgrammedSession |
| GET | `/api/coach/programming?start=...&end=...` | — | ProgrammedSession[] (all tiers in range) |
| PUT | `/api/coach/programming/[id]` | `{ title?, throwsSessionId?, notes?, scheduledDate? }` | ProgrammedSession |
| DELETE | `/api/coach/programming/[id]` | — | `{ ok: true }` (cascades overrides) |
| POST | `/api/coach/programming/[id]/override` | `{ throwsSessionId, tier, groupId?, athleteId? }` | ProgrammedSession (the new override) |
| POST | `/api/coach/programming/[id]/publish` | — | `{ ok: true, assignmentsCreated, assignmentsUpdated }` |
| GET | `/api/coach/programming/[id]/resolve/[athleteId]` | — | `{ effectiveSessionId, tier, source }` |

All API routes use `getSession()` from `src/lib/auth.ts` + manual coach profile lookup (the existing API route pattern — `requireCoachSession()` is for Server Components only). All mutations validate CSRF via the `csrfHeaders()` pattern.

---

## 4. UI Pages

### 4.1 Event Groups Page (`/coach/event-groups`)

Replaces `/coach/teams`. Old URL redirects.

**Layout:**
- Header: "Event Groups" + "Create Group" button
- `StaggeredList` grid of `card-interactive` cards (2-col on desktop, 1-col mobile)
- Each card: color dot + name, event badges (`<Badge>`), member count, avatar stack (max 4 + overflow)
- Click card → detail page or expand panel with member management

**Create/Edit Modal:**
- Name input
- Events multi-select (Shot Put, Discus, Hammer, Javelin checkboxes)
- Color picker (8 preset colors)
- Description textarea (optional)

**Member Management (within group detail):**
- Checkbox list of roster athletes, filtered to show athletes whose events overlap with the group's events
- Athletes already in the group are pre-checked
- Bulk add/remove via checkboxes + "Save" button

### 4.2 Programming Calendar Page (`/coach/programming`)

**Header:**
- Week navigator: `< Week of Mar 16 >` with arrow buttons
- `<Tabs>` component: "All" | one tab per EventGroup (from API) | "Unassigned"
- `ScrollProgressBar`

**Calendar Grid:**
- 7 columns (Mon–Sun), each a vertical lane
- Day header: abbreviated date (e.g. "Mon 16")
- Session cards within each day column, stacked vertically

**Session Card Appearance:**
- Tier color coding:
  - TEAM: `border-l-4 border-l-info-500` + `bg-info-50 dark:bg-info-500/5`
  - GROUP: `border-l-4 border-l-primary-500` + `bg-primary-50 dark:bg-primary-500/5`
  - INDIVIDUAL: `border-l-4 border-l-success-500` + `bg-success-50 dark:bg-success-500/5`
- Title, template name (smaller), status badge
- Inherited sessions: dashed left border + "Inherited" label in muted text
- Overridden sessions: solid border + amber "Override" badge

**Interactions:**
- Click session card → edit sidebar (slide in from right)
- Click empty day area → create new session for that date
- Context determined by active tab: "All" tab = TEAM tier; group tab = GROUP tier; "Unassigned" tab = INDIVIDUAL tier
- Edit sidebar: title input, template picker (dropdown of ThrowsSession templates), notes textarea, "Publish" / "Unpublish" button, "Create Override" button (only on TEAM tier sessions)
- Template picker shows: template name, event, block count, validation status icon (green check or amber warning)

**Mobile:**
- Full-width day cards, horizontally scrollable week
- Session cards stack inside each day
- Edit sidebar becomes bottom sheet

### 4.3 Navigation Changes

Add to `COACH_NAV_SECTIONS` in Sidebar.tsx, under the "Athletes" group:
- `{ label: "Event Groups", href: "/coach/event-groups", icon: Users }`

Add to the "Training" group:
- `{ label: "Programming", href: "/coach/programming", icon: CalendarRange }`

Remove "Teams" from nav. Add redirect from `/coach/teams` → `/coach/event-groups`.

**matchPaths updates**: Replace `/coach/teams` with `/coach/event-groups` in the Athletes group matchPaths array. Add `/coach/programming` to the Training group matchPaths array. Import `CalendarRange` from lucide-react in Sidebar.tsx.

---

## 5. Validation

No new Bondarchuk validation code. The existing pipeline in `src/lib/throws/validation.ts` validates `ThrowsSession` templates at creation time in the session builder. Since `ProgrammedSession` references a `ThrowsSession`, the template is already validated.

The programming UI shows the template's validation status (from the builder) as a visual indicator when selecting a template — green checkmark for valid, amber warning icon for templates with warnings.

---

## 6. What We're NOT Building (YAGNI)

- No drag-and-drop calendar reordering (click-to-create is sufficient for v1)
- No new athlete calendar page (athletes use existing `/athlete/sessions` which already reads `ThrowsAssignment`)
- No copy-week / template-week functionality (v2)
- No auto-grouping by event (coach manually creates groups)
- No real-time collaboration (single coach writes the program)
- No new Bondarchuk validation utility (existing validator covers it)
- No new block/exercise models (reuses ThrowsSession templates)

---

## 7. Migration Strategy

Single migration: `add-event-groups-and-trickle-down-programming`

**IMPORTANT**: Prisma does not detect table renames — it will drop and recreate unless we use manual SQL. The migration file must be hand-edited after generation.

Steps:
1. Update schema.prisma with all model changes (EventGroup, EventGroupMember, ProgrammedSession, ThrowsAssignment.programmedSessionId, RecurringSchedule.groupIds)
2. Run `npx prisma migrate dev --create-only --name add-event-groups-and-trickle-down-programming`
3. **Hand-edit the generated SQL** to replace DROP/CREATE with RENAME:
   ```sql
   -- Instead of dropping Team and creating EventGroup:
   ALTER TABLE "Team" RENAME TO "EventGroup";
   ALTER TABLE "TeamMember" RENAME TO "EventGroupMember";
   ALTER TABLE "EventGroupMember" RENAME COLUMN "teamId" TO "groupId";
   ALTER TABLE "RecurringSchedule" RENAME COLUMN "teamIds" TO "groupIds";
   -- Then add new columns:
   ALTER TABLE "EventGroup" ADD COLUMN "events" "EventType"[] DEFAULT '{}';
   ALTER TABLE "EventGroup" ADD COLUMN "color" TEXT;
   ALTER TABLE "EventGroup" ADD COLUMN "order" INTEGER DEFAULT 0 NOT NULL;
   -- Rename constraints and indexes to match new table names
   ```
4. Run `npx prisma migrate dev` to apply
5. Verify with `npx prisma db pull` that schema matches

All existing Team/TeamMember data is preserved — teams become event groups with empty events arrays.
