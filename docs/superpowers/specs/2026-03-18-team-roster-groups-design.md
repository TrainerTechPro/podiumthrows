# Team Roster Groups — Design Spec

**Goal:** Let coaches organize athletes into named teams/groups (e.g., "UCSD Team", "Private Clients") with filtering across the app. Athletes can belong to multiple teams. The roster remembers the coach's last-viewed team.

**Tech Stack:** Next.js 14.2, React 18, TypeScript, Prisma ORM, PostgreSQL

---

## Data Model

No schema migration required. The following models already exist:

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

**Key relationships:**
- A coach owns many teams (`CoachProfile.teams`)
- An athlete can be in many teams (`AthleteProfile.teamMemberships`)
- `AthleteProfile.coachId` remains the source of truth for roster membership — teams are an organizational layer on top

**Preference storage:** `CoachProfile.preferences` (existing `String?` JSON field, parsed as `CoachPreferences` interface in `src/app/api/coach/preferences/route.ts`) stores `lastTeamId` for roster persistence. The `CoachPreferences` interface and the PUT handler's merge logic must be updated to support the `lastTeamId` key.

---

## API Routes

All new endpoints use `{ "ok": true, "data": ... }` response format, consistent with `/api/coach/athletes`.

### New Routes

#### GET `/api/coach/teams`
Returns all teams for the authenticated coach with member counts.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "clxyz...",
      "name": "UCSD Team",
      "description": "Division I squad",
      "memberCount": 5,
      "eventBreakdown": { "SHOT_PUT": 3, "DISCUS": 2 },
      "createdAt": "2026-03-18T..."
    }
  ]
}
```

**`eventBreakdown`:** Counts the number of athletes who have each event in their `events` array. The total may exceed `memberCount` since athletes can train multiple events.

**Implementation:** Query `Team` where `coachId`, include `_count.members` and aggregate member `events` arrays.

#### POST `/api/coach/teams`
Creates a new team.

**Body:** `{ name: string, description?: string }`

**Validation:**
- `name` required, trimmed, max 100 chars
- Name must be unique per coach (case-insensitive)

**Response:** `201` with created team object.

#### PATCH `/api/coach/teams/[teamId]`
Updates team name and/or description.

**Body:** `{ name?: string, description?: string }`

**Validation:**
- Verify team belongs to authenticated coach
- If name provided, must be unique per coach

**Response:** `200` with updated team object.

#### DELETE `/api/coach/teams/[teamId]`
Deletes a team. Cascade deletes all `TeamMember` rows. Does NOT delete athletes from the coach's roster.

**Validation:** Verify team belongs to authenticated coach.

**Response:** `200` with `{ ok: true }`.

**Side effect:** If `CoachProfile.preferences.lastTeamId` equals the deleted team's ID, clear it to null.

#### POST `/api/coach/teams/[teamId]/members`
Adds one or more athletes to a team.

**Body:** `{ athleteIds: string[] }` — max 100 IDs per request.

**Validation:**
- Verify team belongs to authenticated coach
- Verify each athlete belongs to the same coach
- Skip athletes already in the team (idempotent)

**Response:** `200` with `{ ok: true, added: number }`.

#### DELETE `/api/coach/teams/[teamId]/members/[athleteId]`
Removes an athlete from a team. Does NOT remove the athlete from the coach's roster.

**Validation:** Verify team belongs to authenticated coach.

**Response:** `200` with `{ ok: true }`. Returns 200 even if the athlete was not a member (idempotent).

### Modified Routes

#### GET `/api/coach/athletes`
Add optional `teamId` query parameter.

- `?teamId=clxyz...` — return only athletes who are members of that team
- `?teamId=unassigned` — return athletes who are not in ANY team
- No `teamId` param — return all athletes (current behavior)

**Implementation:** When `teamId` is provided, join through `TeamMember` to filter. For "unassigned", use a NOT EXISTS subquery on `TeamMember`.

#### PUT `/api/coach/preferences`
Update the `CoachPreferences` interface to add `lastTeamId?: string | null`. Update the PUT handler's merge logic to accept and persist the `lastTeamId` key alongside the existing keys (`globalDefaultPage`, `workspaceDefaults`, `dashboardLayout`, `myTraining`).

---

## UI: Team Management Page (`/coach/teams`)

### Page Location
`src/app/(dashboard)/coach/teams/page.tsx` — client component.

### Loading & Error States
Use shimmer skeletons during loading (consistent with other pages). Show error banner with retry button on fetch failure.

### Layout

**Header row:** "Teams" heading + "Create Team" button (top right).

**Team cards** in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop). Each card shows:
- Team name (bold, heading font)
- Description (one-line, muted text, or "No description" placeholder)
- Member count: "{n} athletes"
- Event breakdown: colored pills showing count per event (e.g., "3 SP", "2 DT")
- Action buttons: "Manage Members" (primary), "Edit" (secondary icon), "Delete" (danger icon with confirmation)

**Empty state:** Icon + "No teams yet" + "Create your first team to organize your athletes by school, training group, or any way you like." + "Create Team" button.

### Create/Edit Team Panel
Inline panel (same pattern as Add Athlete form on roster page — slides open, not a modal or separate page).

**Fields:**
- Name (text input, required, placeholder: "e.g., UCSD Shot Put")
- Description (text input, optional, placeholder: "e.g., Division I training group")

**Buttons:** Cancel, Save.

### Manage Members Panel
Opens when clicking "Manage Members" on a team card. Replaces the create panel if open.

**Current Members section:**
- List of team members with avatar, name, events pills
- Remove button (X icon) per member — removes from team, not from roster

**Add Athletes section:**
- Heading: "Add Athletes to {team name}"
- Checklist of all roster athletes NOT currently in this team
- Each row: checkbox + avatar + name + events
- "Add Selected" button at bottom (disabled if none checked)
- If all athletes are already in the team: "All athletes are already in this team"

---

## UI: Roster Page Team Filter

The team filter is added to the **throws roster page** (`/coach/throws/roster`), which is already a client component that fetches data via API calls. No refactoring needed.

The `/coach/athletes` page (server component) is NOT modified in this spec — it serves a different purpose (general athlete management vs. throws-specific roster). Team filtering on that page can be added later if needed.

### Team Selector
A dropdown (`<select>` or custom dropdown) placed in the page header area, between the heading and the existing tabs.

**Options:**
- "All Athletes" (value: `""`)
- One entry per team (value: team ID, label: team name + member count)
- "Unassigned" (value: `"unassigned"`)

### Persistence
On change, save the selected value to `CoachProfile.preferences.lastTeamId` via PUT to `/api/coach/preferences`.

On page load:
1. Fetch teams list via `GET /api/coach/teams`
2. Read `lastTeamId` from coach preferences (fetched alongside teams or from existing profile data)
3. If `lastTeamId` matches an existing team, select it and filter
4. If `lastTeamId` is null or the team was deleted, default to "All Athletes"

### Filter Behavior
When a team is selected:
- The `fetchData` call passes `?teamId=xyz` to `GET /api/coach/athletes`
- Both "Podium Throws" tab and "All Athletes" tab show only athletes matching the filter
- Stats strip updates to reflect filtered counts

### Auto-assign on Add
When the "Add Athlete" form is used while a team is selected (not "All Athletes" or "Unassigned"):
- After creating the athlete via `POST /api/coach/athletes`, also call `POST /api/coach/teams/{teamId}/members` with the new athlete's ID
- Team assignment is best-effort — the athlete is created regardless. If the team membership call fails, show a non-blocking warning toast rather than rolling back the athlete creation.

---

## Sidebar Update

Add "Teams" to the coach sidebar in the main section:

```
Dashboard
Athletes
Teams        <- new entry
Sessions
Athlete Logs
```

**Icon:** `UsersRound` from lucide-react (distinct from `Users` used for Athletes).
**href:** `/coach/teams`

---

## Edge Cases

1. **Coach deletes a team that's currently selected on roster** — preference cleared, roster falls back to "All Athletes"
2. **Athlete removed from coach's roster** — cascade deletes their TeamMember rows automatically (Prisma onDelete: Cascade on AthleteProfile)
3. **Team name uniqueness** — enforced per-coach at the API level, case-insensitive comparison
4. **Empty teams** — allowed, show "0 athletes" on team card
5. **Athlete in multiple teams** — appears in each team's filtered view, counted once in "All Athletes"
6. **Plan limits** — unchanged, limits apply to total athletes per coach, not per team
7. **Delete non-existent team member** — returns 200 (idempotent), no error
8. **Bulk add limit** — `athleteIds` array capped at 100 per request

---

## Out of Scope

- Team-level session scheduling (assign a session to a whole team)
- Team-level analytics/reporting
- Athlete self-assignment to teams
- Team sharing between coaches
- Nested teams / sub-groups
- Team filter on `/coach/athletes` page (server component — can be added later)

These can be added later without changing the core team model.
