# Coach-Created Athlete Profiles & Event Filtering — Design Spec

## Overview

Two closely related features:

1. **Coach-created athlete profiles**: Coaches create placeholder athlete accounts with minimal info (name + events). The athlete appears on the roster immediately. The coach can log limited session data. Later, the coach sends an invite link and the athlete claims the account, confirms their profile, sets email/password, and takes over.

2. **System-wide event filtering**: Athletes select which throwing events they compete in (shot put, discus, hammer, javelin). Every session logging UI, drill selection, and filter dropdown is restricted to only those events. Applies to athlete sessions, coach-logged sessions for athletes, and coach self-training.

## Goals

- Let coaches build out their roster and start logging data before athletes sign up
- Reduce friction — athlete onboarding is "confirm what your coach entered" not "fill out everything from scratch"
- Eliminate irrelevant events from every UI surface — a hammer/discus thrower never sees shot put or javelin options

## Non-Goals

- No changes to the existing self-registration flow (athletes who sign up independently still work as before)
- No changes to Stripe billing or plan limits logic (reuse existing checks)
- No changes to the Bondarchuk methodology or session structure

## Schema Changes

### User model

Add one field:

```prisma
claimedAt DateTime? // null = coach-created placeholder, set when athlete claims account
```

Placeholder users get a generated email `unclaimed-{uuid}@placeholder.internal` to satisfy the unique constraint. They have no `passwordHash`. The `claimedAt` field distinguishes placeholder from real users.

### CoachProfile model

Add one field:

```prisma
events EventType[] // coach's own throwing events for self-training filtering
```

### AthleteProfile model

No changes — already has `events EventType[]`.

### Invitation model

Add one field:

```prisma
athleteProfileId String? // links invite to specific coach-created placeholder profile
```

Relation: `athleteProfile AthleteProfile? @relation(fields: [athleteProfileId], references: [id])`

### No changes to session models

`AthleteThrowsSession` and `CoachThrowsSession` remain unchanged. Readiness and RPE fields are already nullable in usage — verify they're optional in schema (if not, make them optional).

## Feature 1: Coach Creates Athlete Profile

### API: `POST /api/coach/athletes`

Coach-only endpoint.

**Request body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "events": ["DISCUS", "HAMMER"] // EventType[], at least one required
}
```

**Logic:**
1. Authenticate coach via `getSession()`
2. Check plan limits: count existing athletes for this coach vs plan cap (FREE=3, PRO=25, ELITE=unlimited)
3. Create placeholder `User`:
   - `email`: `unclaimed-{uuid}@placeholder.internal`
   - `passwordHash`: empty string (no login possible)
   - `role`: ATHLETE
   - `claimedAt`: null
4. Create `AthleteProfile`:
   - `userId`: the placeholder user's ID
   - `coachId`: the coach's CoachProfile ID
   - `firstName`, `lastName`, `events` from request
5. Return the created athlete profile

**Response:** `{ ok: true, data: athleteProfile }`

### API: `GET /api/coach/athletes`

Returns all athletes on the coach's roster. Already exists as `GET /api/athletes` — extend the response to include `claimedAt` from the User model so the UI can show claimed vs unclaimed status.

### UI: Roster Page Changes

Add an "Add Athlete" button to `/coach/throws/roster`. Opens a form/modal with:
- First name (text input, required)
- Last name (text input, required)
- Events (checkbox group: Shot Put, Discus, Hammer, Javelin — at least one)

On submit, calls `POST /api/coach/athletes`. On success, the new athlete appears in the roster list.

**Roster list changes:**
- Unclaimed athletes show a badge: "Not yet claimed" or similar
- Each unclaimed athlete row shows an "Invite" action button

## Feature 2: Invite & Claim Flow

### Sending Invites

Reuse the existing `POST /api/invitations` endpoint. Add optional `athleteProfileId` to the request body. When provided:
- The invitation is linked to that specific placeholder athlete
- Supports both modes: email (sends invite email) or link (returns URL for coach to share)

The invite link format remains: `{origin}/register?invite={token}`

### Claiming (Registration with Invite Token)

When `/register` page detects an `invite` query param with a token that has an `athleteProfileId`:

**Step 1 — Confirm profile:**
- Fetch the invitation + linked athlete profile via `GET /api/invitations/verify?token={token}`
- Display what the coach entered: first name, last name, events
- Each field is editable — athlete can accept or change
- "This looks right" / edit buttons per field

**Step 2 — Set credentials:**
- Email (required, validated)
- Password (required, min length)

**On submit — `POST /api/auth/register-claim`** (new endpoint):
1. Verify token is valid and not expired
2. Check email isn't already taken by another user
3. Update the placeholder User:
   - Set `email` to the real email
   - Set `passwordHash` from the password
   - Set `claimedAt` to `new Date()`
4. Update AthleteProfile with any edits (name, events)
5. Mark invitation as ACCEPTED
6. Create JWT, set HttpOnly cookie
7. Return success, redirect to athlete dashboard

### Auth Guardrails

- `POST /api/auth/login`: reject users where `claimedAt` is null (no password to check anyway, but explicit guard)
- Middleware: unclaimed placeholder users cannot access any authenticated routes

## Feature 3: Coach Logging for Unclaimed Athletes

### API: `POST /api/coach/athletes/{athleteId}/sessions`

Coach-only endpoint for logging limited session data on behalf of an unclaimed athlete.

**Request body:**
```json
{
  "event": "DISCUS",
  "date": "2026-03-17",
  "drillLogs": [
    {
      "drillType": "Standing Throw",
      "implementWeight": 2.0,
      "throwCount": 6,
      "bestMark": 45.2,
      "notes": "Good release angle"
    }
  ]
}
```

**Logic:**
1. Authenticate coach
2. Verify athleteId belongs to this coach
3. Validate event is in the athlete's `events` array
4. Create `AthleteThrowsSession`:
   - `athleteId`, `event`, `date` from request
   - Readiness fields (sleepQuality, sorenessLevel, energyLevel): null
   - Feedback fields (sessionRpe, sessionFeeling, techniqueRating, mentalFocus, bestPart, improvementArea): null
5. Create associated drill logs
6. Return session

**UI:** "Log Session" button on unclaimed athlete profiles or roster rows. Opens a simplified wizard (reuse `LogSessionWizard` with a `limitedMode` prop):
- Step 1: Event selection (filtered to athlete's events)
- Step 2: Drill logging (drill type, weight, throws, best mark, notes)
- Step 3: Review & submit
- Skips: readiness check-in and session feedback steps

## Feature 4: System-Wide Event Filtering

### Source of Truth

- **Athletes**: `AthleteProfile.events` (already exists)
- **Coaches** (self-training): `CoachProfile.events` (new field)

### Where Filtering Applies

#### 1. Session Logging Wizard (`LogSessionWizard`)

**Change:** Add `allowedEvents?: EventType[]` prop.

- When provided, the event selection step only renders events in the array
- When empty or undefined, show all four events (backward-compatible fallback)
- If only one event in the array, auto-select it and skip the event selection step

**Affected pages:**
- `/athlete/log-session` — pass `athleteProfile.events`
- `/coach/log-session` (self-training) — pass `coachProfile.events`
- Coach logging for athletes — pass the specific athlete's events

#### 2. Drill Selection

Already filtered by selected event (drills are per-event). No changes needed — the event filtering upstream handles this.

#### 3. Session History / Filters

Event filter dropdowns on session history pages should only show the user's events:
- `/athlete/my-training` — filter by `athleteProfile.events`
- `/coach/my-training` — filter by `coachProfile.events`

#### 4. Roster / Podium Enrollment

When enrolling an athlete to Podium, the event dropdown should only show that athlete's events.

### Coach Sets Own Events

**Where:** Coach settings page or first access to "My Training."

If `coachProfile.events` is empty when the coach navigates to log a self-training session, show a one-time event picker: "Which events do you train?" with the four checkboxes. Save to `CoachProfile.events` via `PATCH /api/coach/profile`.

Both the coach and athlete can update their events at any time from their respective profile/settings pages.

### Updating Events

**API:** Events are updated via existing profile update endpoints:
- Athletes: `PATCH /api/athletes/{id}/profile` (or existing profile endpoint)
- Coaches: `PATCH /api/coach/profile`

Both coach and athlete can add/remove events. The UI is a checkbox group on the profile page.

## Edge Cases

- **Coach creates athlete with events [HAMMER], then athlete claims and adds DISCUS**: Works fine — events array is mutable by both parties
- **Coach logs a session for event X, then that event is removed from athlete's profile**: Historical sessions remain — event filtering only affects future logging UI, not past data
- **All events removed**: Fallback to showing all four events (defensive, prevents empty state)
- **Coach hits plan limit**: `POST /api/coach/athletes` returns 403 with clear message about upgrading
- **Invite token expired**: Registration page shows "This invite has expired. Ask your coach to send a new one."
- **Email already taken during claim**: Show error, let athlete use a different email
- **Coach creates athlete, never sends invite**: Athlete stays as placeholder indefinitely. Coach can still log limited sessions and manage the profile.

## Testing Considerations

- Coach creates athlete → appears on roster with "unclaimed" badge
- Coach sends invite (email mode and link mode) → token created with athleteProfileId
- Athlete claims via invite → profile data shown for confirmation → edits accepted → account activated
- Claimed athlete can log in with email/password
- Unclaimed placeholder cannot log in
- Coach logs limited session for unclaimed athlete → session appears in history
- Event filtering: athlete with [HAMMER, DISCUS] only sees those events in wizard
- Coach with [SHOT_PUT] only sees shot put in self-training wizard
- Event filter dropdowns in session history respect the user's events
- Plan limits enforced on coach athlete creation
- Adding/removing events updates filtering immediately
