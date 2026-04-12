# Roster Groups — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Supersedes:** `2026-03-18-team-roster-groups-design.md` (corrects response format, paths, and proxy profile compat)

---

## Problem

Coaches organize athletes in multiple contexts — university team, private training group, summer camp roster. The current flat athlete list doesn't reflect how they work. A D1 coach with 18 university athletes and 5 private clients sees them all jumbled together.

## Goals

1. Coaches can create named groups and assign athletes to them
2. Athletes can belong to 0-N groups (many-to-many)
3. Standalone athletes (no group) remain visible
4. Roster page filters by group with persistence
5. Adding an athlete while viewing a group auto-assigns them

## Non-Goals

- Team-level session scheduling (assign a session to a whole group)
- Team-level analytics/reporting
- Athlete self-assignment to groups
- Group sharing between coaches
- Nested groups / sub-groups

---

## Section 1: Data Model

### New Models

```prisma
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

### Relationship to existing models

- `CoachProfile` gets `teams Team[]` relation
- `AthleteProfile` gets `teamMemberships TeamMember[]` relation
- `AthleteProfile.coachId` remains the source of truth for roster membership — groups are an organizational layer on top
- `EventGroup`/`EventGroupMember` (existing) is a separate concept: event-based grouping for programming. Teams are organizational grouping for roster management. They coexist without overlap.

### Preference storage

`CoachProfile.preferences` (existing nullable JSON field) stores `lastTeamId: string | null` for roster filter persistence. The `CoachPreferences` interface and the PUT handler must be updated to support this key.

---

## Section 2: API Routes

All endpoints use `{ "success": true, "data": T }` / `{ "success": false, "error": string }` per project conventions. All mutations validate with Zod via `parseBody()`.

### GET `/api/coach/teams`

Returns all teams for the authenticated coach with member counts.

```json
{
  "success": true,
  "data": [
    {
      "id": "clxyz...",
      "name": "UCSD Team",
      "description": "Division I squad",
      "memberCount": 5,
      "eventBreakdown": { "SHOT_PUT": 3, "DISCUS": 2 },
      "createdAt": "2026-04-11T..."
    }
  ]
}
```

`eventBreakdown` counts athletes per event from their `events` array. Total may exceed `memberCount` since athletes train multiple events.

### POST `/api/coach/teams`

Creates a new team.

**Body:** `{ name: string, description?: string }`

**Validation:**
- `name` required, trimmed, 1-100 chars
- Name must be unique per coach (case-insensitive)

**Response:** `201` with created team.

### PATCH `/api/coach/teams/[teamId]`

Updates team name and/or description.

**Body:** `{ name?: string, description?: string }`

**Validation:** Verify team belongs to coach. If name provided, must be unique per coach.

### DELETE `/api/coach/teams/[teamId]`

Deletes a team. Cascade deletes all `TeamMember` rows. Does NOT remove athletes from the coach's roster.

**Side effect:** If `CoachProfile.preferences.lastTeamId` equals the deleted team's ID, clear it to null.

### POST `/api/coach/teams/[teamId]/members`

Adds one or more athletes to a team.

**Body:** `{ athleteIds: string[] }` — max 100 IDs per request.

**Validation:**
- Verify team belongs to coach
- Verify each athlete belongs to the same coach (`AthleteProfile.coachId`)
- Skip athletes already in the team (idempotent)

**Response:** `{ "success": true, "data": { "added": number } }`

### DELETE `/api/coach/teams/[teamId]/members/[athleteId]`

Removes an athlete from a team. Returns 200 even if not a member (idempotent).

### Modified: GET `/api/coach/athletes`

Add optional `teamId` query parameter:

- `?teamId=clxyz...` — return only members of that team
- `?teamId=unassigned` — return athletes not in ANY team
- No `teamId` — all athletes (current behavior)

Implementation: when `teamId` is provided, join through `TeamMember`. For "unassigned", NOT EXISTS subquery on `TeamMember`.

### Modified: PUT `/api/coach/preferences`

Update `CoachPreferences` interface to add `lastTeamId?: string | null`.

---

## Section 3: Teams Management Page

**Path:** `/coach/teams`
**File:** `src/app/(dashboard)/coach/teams/page.tsx`

### Layout

**Header row:** "Groups" heading + "Create Group" button (top right).

**Team cards** in responsive grid (1 col mobile, 2 col sm, 3 col lg). Each card shows:
- Team name (bold, heading font)
- Description (one-line muted text, or "No description")
- Member count: "{n} athletes"
- Event breakdown: colored pills per event (e.g., "3 SP", "2 DT")
- Actions: "Manage Members" (primary), edit icon, delete icon (with `ConfirmDialog`)

Cards use `card` class (not `card-interactive` — actions are via buttons, not the card itself).

**Empty state:** Icon + "No groups yet" + "Create your first group to organize your athletes by school, training group, or any way you like." + CTA button.

### Create/Edit Panel

Inline panel (same pattern as Add Athlete form — slides open, not modal). Fields:
- Name (text input, required, placeholder: "e.g., UCSD Shot Put")
- Description (text input, optional)
- Cancel + Save buttons

### Manage Members Panel

Opens when clicking "Manage Members." Two sections:

**Current Members:** List with avatar, name, event pills, remove button (X icon).

**Add Athletes:** Checklist of all roster athletes NOT in this team. Each row: checkbox + avatar + name + events. "Add Selected" button at bottom. If all athletes are already members: "All athletes are already in this group."

---

## Section 4: Roster Page Team Filter

Added to the existing **athletes roster page** at `/coach/athletes` (server component `page.tsx` + client component `_roster-client.tsx`).

### Team Selector

Dropdown in the page header area, between the heading and the Roster/Invitations tabs.

**Options:**
- "All Athletes" (value: `""`)
- One entry per team (label: team name + member count)
- "Unassigned" (value: `"unassigned"`)

### Persistence

On change, save selected value to `CoachProfile.preferences.lastTeamId` via PUT `/api/coach/preferences`.

On page load:
1. Fetch teams via GET `/api/coach/teams` (parallel with roster fetch)
2. Read `lastTeamId` from coach preferences
3. If `lastTeamId` matches an existing team, select it and filter
4. If null or team was deleted, default to "All Athletes"

### Filter behavior

The roster page is a server component. The team filter works via URL search params:
1. Dropdown change navigates to `/coach/athletes?teamId=X` (triggers server re-render)
2. The server component reads `searchParams.teamId` and passes it to `getAthleteRoster(coachId, teamId)`
3. `getAthleteRoster()` gains an optional `teamId` parameter that filters via `TeamMember` join (or NOT EXISTS for "unassigned")
4. Both the roster display and the stats strip reflect filtered counts

The GET `/api/coach/athletes` endpoint also gains the `teamId` param for any client-side consumers.

### Auto-assign on add

When the "Add Athlete" form (Create Profile tab) is used while a team is selected:
- After creating the athlete via POST `/api/coach/athletes`, also call POST `/api/coach/teams/{teamId}/members` with the new athlete's ID
- Team assignment is best-effort — athlete creation is never rolled back. If the membership call fails, show a warning toast.

This works for both claimed and proxy profiles since `POST /api/coach/athletes` always creates a real `AthleteProfile`.

---

## Section 5: Sidebar Update

Add "Groups" to the coach sidebar:

```
Dashboard
Athletes
Groups        ← new
Sessions
Athlete Logs
```

**Icon:** `UsersRound` from lucide-react
**href:** `/coach/teams`

---

## Section 6: Edge Cases

1. **Coach deletes currently-selected group** — preference cleared, roster falls back to "All Athletes"
2. **Athlete removed from coach's roster** — cascade deletes their `TeamMember` rows (Prisma `onDelete: Cascade` on `AthleteProfile`)
3. **Team name uniqueness** — enforced per-coach at API level, case-insensitive
4. **Empty teams** — allowed, show "0 athletes" on card
5. **Athlete in multiple teams** — appears in each team's filtered view, counted once in "All Athletes"
6. **Plan limits** — unchanged, limits apply to total athletes per coach, not per team
7. **Delete non-existent member** — returns 200 (idempotent)
8. **Bulk add limit** — `athleteIds` capped at 100 per request

---

## Section 7: Testing Strategy

1. **Schema migration:** `Team` and `TeamMember` create correctly, unique constraint works, cascade delete works
2. **Team CRUD:** create, rename, delete — name uniqueness enforced
3. **Member management:** add single, add bulk, remove, idempotent operations
4. **Roster filter:** `?teamId=X` returns correct subset, `?teamId=unassigned` returns correct complement
5. **Preference persistence:** last-viewed team persists across page loads, deleted team clears preference
6. **Auto-assign on add:** new athlete gets team membership when created from filtered view
7. **Sidebar:** "Groups" link appears, routes to `/coach/teams`
