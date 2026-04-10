# Proxy Athlete Profiles — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Approach:** Hybrid — Coach Action Bar + Shared Data Layer (Approach C)

---

## Problem

Coaches can't fully use the app until every athlete on their roster has signed up and created an account. A college coach with 15 athletes won't wait for all of them to register — they need to populate their entire roster on day one, start logging practice data, and invite athletes to claim their profiles later.

The infrastructure for placeholder users exists (nullable `passwordHash`, `claimedAt` field, `register-claim` endpoint, `Invitation.athleteProfileId`), but the coach-facing UX doesn't let them do anything meaningful with those profiles after creation.

## Goals

1. Coaches can create athlete profiles with just a name, gender, and events — no email required
2. Coaches can fully manage those profiles: log throws (with video), upload standalone videos, edit all profile fields, add notes
3. The same action bar works for both unclaimed and claimed athletes
4. Athletes can claim their profile via invite link, review coach-entered data, and take ownership
5. Coach notes support private vs shared visibility

## Non-Goals

- Coach impersonation (logging in as the athlete) — coach stays in coach context
- Building parallel coach-version screens — reuse athlete forms with permission gating
- Roster groups/teams — separate feature, not in this spec
- Unified PR system — separate feature, builds on top of this

---

## Section 1: Enhanced "Add Athlete" Flow

### Current State
- "Invite Athlete" button on roster page opens a modal with email or link-only invite
- `POST /api/coach/athletes` exists and creates a placeholder User + AthleteProfile
- Modal doesn't connect to the POST endpoint — only creates invitations

### Design

Replace the "Invite Athlete" button with **"Add Athlete"** button. Modal has two tabs:

**Tab 1 — "Create Profile" (primary, selected by default):**
- Fields: `firstName` (required), `lastName` (required), `gender` (required, toggle: Male/Female/Other), `events` (required, multi-select: Shot Put, Discus, Hammer, Javelin)
- Action: "Add to Roster" button
- API: `POST /api/coach/athletes` (existing endpoint, already creates placeholder User + AthleteProfile)
- On success: close modal, navigate to `/coach/athletes/[id]` (the new athlete's detail page)
- On the detail page: show a one-time "get started" prompt: *"Start building [firstName]'s profile — log throws, upload video, or edit their profile."* Dismiss on any action or manual close. Persist dismissal in localStorage.

**Tab 2 — "Send Invite" (secondary):**
- Existing email/link invite flow — no changes
- For when the coach wants the athlete to set up their own profile from scratch

### Plan Limit Enforcement
- Same as today: check athlete count against plan limit before showing modal
- Proxy profiles count toward the plan limit (they already do — the POST endpoint creates a real AthleteProfile)

---

## Section 2: Coach Action Bar on Athlete Detail Page

### Location
- Added to `/coach/athletes/[id]/page.tsx`, below the athlete header, above the section content
- Desktop (md+): horizontal row of pill buttons with icons and labels
- Mobile: compact row of 4 icon buttons, sticky at bottom of screen (above any existing bottom nav), thumb-reachable

### Actions

#### 2a. Log Throw
**Trigger:** Tap "Log Throw" in action bar
**UI:** Bottom sheet (mobile) or modal (desktop)
**Fields:**
1. **Event** — pre-selected if athlete has one event, otherwise quick-tap selector (Shot Put / Discus / Hammer / Javelin)
2. **Implement weight** — preset buttons per event, one tap:
   - Shot Put: 3kg, 4kg, 5kg, 6kg, 7.26kg, 8kg, 9kg
   - Discus: 1kg, 1.5kg, 1.75kg, 2kg, 2.5kg
   - Hammer: 3kg, 4kg, 5kg, 6kg, 7.26kg, 8kg, 9kg, 10kg
   - Javelin: 400g, 500g, 600g, 700g, 800g
   - "Custom" option for unlisted weights
   - Unit toggle: kg / lbs (converts and stores both, per existing ThrowLog pattern)
3. **Distance** — numeric input (meters), large touch target
4. **Video** — optional, camera roll picker. Uploads to R2. Stored in `ThrowLog.videoUrl`
5. **Notes** — optional, collapsed by default. Expand to add cues, observations
6. **Competition toggle** — checkbox: "Competition throw" (sets `isCompetition: true`)

**Save behavior:**
- Creates a `ThrowLog` record with `sessionId: null` (standalone throw, already supported by schema)
- Sets `athleteId` to the athlete being managed
- **"Save & Add Another"** button keeps the modal open, clears distance/video/notes, preserves event + implement selection (rapid multi-throw logging)
- **"Save"** button saves and closes
- Auto-checks if distance is a PR for this event + implement weight and sets `isPersonalBest: true`

**API:** `POST /api/coach/athletes/[id]/throws` (new endpoint)
- Auth: verify coach owns this athlete (via CoachProfile → AthleteProfile relation)
- Body validated with Zod schema
- Creates ThrowLog record
- If video attached: upload to R2 first, then save URL

#### 2b. Upload Video
**Trigger:** Tap "Upload Video" in action bar
**UI:** Bottom sheet (mobile) or modal (desktop)
**Fields:**
1. **Video** — camera roll picker (required)
2. **Event** — optional quick-tap selector
3. **Implement weight** — optional preset buttons (same as Log Throw)
4. **Distance** — optional numeric input
5. **Notes/Cues** — optional text field. Prompt text: "What worked? Cues to remember?"

**Save behavior:**
- Creates an `AthleteVideo` record (new model — see Section 6)
- Uploads video to R2 under path: `videos/{athleteProfileId}/{cuid}.{ext}`
- Generates thumbnail (if supported by existing infra, otherwise placeholder)

**API:** `POST /api/coach/athletes/[id]/videos` (new endpoint)

**Distinction from Log Throw:** Use "Upload Video" when capturing film without a specific measured distance. Use "Log Throw" when you have a distance (with optional video). Both save video to R2 — Log Throw attaches it to a ThrowLog, Upload Video creates a standalone AthleteVideo.

#### 2c. Edit Profile
**Trigger:** Tap "Edit Profile" in action bar
**Behavior:** Navigates to `/coach/athletes/[id]/profile/edit` (new page)
**Content:** The Master Profile form (6 sections from the existing spec: Core Info, Competition PRs, Implements, Strength, Technical, Injury). Same form the athlete would fill out, rendered in coach-edit mode.

**Coach-edit mode differences:**
- Context banner at top: "Editing [firstName]'s profile" with back arrow
- All fields are editable for unclaimed profiles
- For claimed profiles: athlete-personal fields (email, notification preferences) are read-only; coaching fields (strength numbers, technical profile, injury history, PRs) remain editable
- Save via `PATCH /api/coach/athletes/[id]/profile` (new endpoint, or extend existing)

#### 2d. Add Note
**Trigger:** Tap "Add Note" in action bar
**UI:** Bottom sheet (mobile) or modal (desktop)
**Fields:**
1. **Content** — text area (required), generous height
2. **Category** — toggle pills: Technical, Mental, Injury, General (default: General)
3. **Visibility** — toggle: "Shared with athlete" (default, on) / "Private — coach only" (off)

**Save behavior:**
- Creates a `CoachNote` record (new model — see Section 6)
- Timestamped, appears on the athlete detail page in a notes timeline
- Private notes: visible only on coach's athlete detail page, never shown to athlete
- Shared notes: visible on coach's detail page AND shown to athlete on claim review screen and in their profile

**API:** `POST /api/coach/athletes/[id]/notes` (new endpoint)

---

## Section 3: Proxy Profile Indicator on Roster

### Roster Card Changes
- **Unclaimed profiles:** small ghost-user icon (Lucide: `UserRoundX` or `UserRoundPlus` with dashed style) next to the athlete's name, muted color (`text-muted`)
- **Tooltip:** "Profile managed by coach — not yet claimed by athlete" (desktop hover, mobile tap)
- **Last Session column:** for unclaimed athletes with no sessions, show an "Invite" link/button instead of empty space. Tapping opens the invite flow (email or link) pre-linked to this `athleteProfileId`
- **Once claimed:** ghost icon disappears, Last Session column shows normal data
- **No other visual differences.** Name, events, readiness, streak all display identically to claimed profiles as data is populated.

### Roster Data Changes
- `getAthleteRoster()` query needs to include `user.claimedAt` to determine claim status
- Filtering/sorting: unclaimed profiles sort normally (by readiness, then alphabetical). No separate section.

---

## Section 4: Coach-as-Athlete Permission Layer

### Principle
Coach stays logged in as coach. No session switching, no impersonation. Coach accesses athlete data through coach-namespaced routes (`/coach/athletes/[id]/...`).

### Permission Rules

| Data Category | Unclaimed Profile | Claimed Profile |
|---|---|---|
| Core info (name, gender, events, DOB, height, weight) | Full read/write | Read-only (athlete owns) |
| Competition PRs, implement bests | Full read/write | Full read/write |
| Strength numbers | Full read/write | Full read/write |
| Technical profile (limiters, cues) | Full read/write | Full read/write |
| Injury history, movement restrictions | Full read/write | Full read/write |
| Throw logs | Full read/write (create/delete) | Create only (coach can log throws, can't delete athlete's) |
| Videos | Full read/write | Create only |
| Coach notes | Full read/write | Full read/write (coach always owns notes) |
| Session assignments | Full read/write | Full read/write (existing behavior) |
| Notification preferences | Full read/write | Read-only (athlete owns) |
| Password, email | N/A (placeholder) | Never accessible to coach |

### Context Banner
When a coach is on any athlete management page (`/coach/athletes/[id]/...`):
- Compact banner below the page header: amber/gold left border, athlete name, back arrow to roster
- Text: "Managing [firstName] [lastName]'s profile"
- Not dismissable (always visible for orientation)

### Shared Forms
When building the Master Profile form and other data-entry screens:
- Accept an `isCoachManaging: boolean` prop
- Gate field editability based on claim status + permission table above
- Read-only fields show the value with a lock icon and tooltip: "Managed by athlete"

---

## Section 5: Athlete Claim Flow with Review

### Trigger
Coach generates an invite (email or link) from the roster or athlete detail page. Invitation record is created with `athleteProfileId` linking to the existing profile.

### Step 1: Create Credentials
- Athlete clicks invite link → `/register?invite={token}`
- Existing register page detects `athleteProfileId` on the invitation
- Shows: "Your coach [coachName] has set up your profile. Create your login to get started."
- Fields: `email` (required), `password` (required, 8+ chars)
- `firstName` and `lastName` pre-filled from the existing profile, editable
- Submit → `POST /api/auth/register-claim` (existing endpoint)
- Sets `passwordHash`, `email`, `claimedAt` on User

### Step 2: Review Coach's Data (new page)
- After successful claim, redirect to `/athlete/review-profile` (new page)
- Instead of the standard onboarding wizard

**Page layout — scrollable cards:**

1. **Basic Info Card**
   - Shows: name, gender, events, height, weight, class year, DOB
   - Edit pencil icon → inline edit mode

2. **Competition PRs Card**
   - Shows: per-event best distances the coach logged (from ThrowLog where `isPersonalBest: true`)
   - Edit pencil icon → inline edit

3. **Strength Numbers Card** (if coach entered any)
   - Shows: lift maxes from `strengthNumbers` JSON
   - Edit pencil icon → inline edit

4. **Recent Throws Card**
   - Shows: last 10 logged throws (distance, implement, date)
   - Read-only (athlete can view, not edit historical logs)

5. **Videos Card** (if any uploaded)
   - Thumbnail grid of uploaded clips
   - Tap to play
   - Read-only

6. **Coach's Notes Card** (shared notes only)
   - Shows: all CoachNote records where `isPrivate: false`
   - Read-only

**Bottom actions:**
- Primary button: **"Looks Good — Let's Go"** → redirects to `/athlete/dashboard`
- Secondary link: **"I'll Review Later"** → redirects to `/athlete/dashboard` (review page accessible from settings)

**Onboarding wizard skip logic:**
- If the profile already has `events`, `gender`, and at least one competition PB → skip onboarding entirely
- If any of those are missing → run the onboarding wizard for just the missing steps, then show review page
- `onboardingCompletedAt` is set after the review page "Looks Good" or "I'll Review Later"

### Step 3: Dashboard
- Athlete lands on dashboard with all historical data intact
- All throws, videos, notes, profile data from the coach's management are already there
- No data loss, no re-entry

---

## Section 6: Schema Changes

### New Model: CoachNote

```prisma
model CoachNote {
  id               String         @id @default(cuid())
  coachProfileId   String
  coach            CoachProfile   @relation(fields: [coachProfileId], references: [id], onDelete: Cascade)
  athleteProfileId String
  athlete          AthleteProfile @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  content          String
  category         NoteCategory   @default(GENERAL)
  isPrivate        Boolean        @default(false)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([athleteProfileId])
  @@index([coachProfileId])
  @@index([athleteProfileId, createdAt])
}

enum NoteCategory {
  TECHNICAL
  MENTAL
  INJURY
  GENERAL
}
```

### New Model: AthleteVideo

```prisma
model AthleteVideo {
  id               String          @id @default(cuid())
  athleteProfileId String
  athlete          AthleteProfile  @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  uploadedById     String?
  uploadedBy       CoachProfile?   @relation(fields: [uploadedById], references: [id], onDelete: SetNull)
  r2Key            String
  url              String
  thumbnailUrl     String?
  event            EventType?
  implementWeight  Float?
  distance         Float?
  notes            String?
  createdAt        DateTime        @default(now())

  @@index([athleteProfileId])
  @@index([athleteProfileId, createdAt])
}
```

### Existing Model Changes

**ThrowLog** — no schema changes needed:
- `sessionId` is already nullable (supports standalone throws)
- `videoUrl` already exists
- `isPersonalBest` and `isCompetition` already exist
- Coach-logged throws use the same model, just created via coach API endpoint

**Invitation** — no schema changes needed:
- `athleteProfileId` already exists and is optional

**User** — no schema changes needed:
- `passwordHash` already nullable
- `claimedAt` already exists

**AthleteProfile** — add relations only:
- Add `coachNotes CoachNote[]` relation
- Add `videos AthleteVideo[]` relation

**CoachProfile** — add relations only:
- Add `coachNotes CoachNote[]` relation
- Add `uploadedVideos AthleteVideo[]` relation

---

## New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/coach/athletes/[id]/throws` | Coach logs a throw for an athlete |
| DELETE | `/api/coach/athletes/[id]/throws/[throwId]` | Coach deletes a throw (unclaimed profiles only, or coach-created throws) |
| POST | `/api/coach/athletes/[id]/videos` | Coach uploads a standalone video |
| DELETE | `/api/coach/athletes/[id]/videos/[videoId]` | Coach deletes a video |
| POST | `/api/coach/athletes/[id]/notes` | Coach adds a note |
| PATCH | `/api/coach/athletes/[id]/notes/[noteId]` | Coach edits a note |
| DELETE | `/api/coach/athletes/[id]/notes/[noteId]` | Coach deletes a note |
| PATCH | `/api/coach/athletes/[id]/profile` | Coach edits athlete profile fields |
| GET | `/api/athlete/review-profile` | Fetch profile data for claim review screen |

All coach endpoints validate:
1. Authenticated user is a coach
2. Coach owns this athlete (AthleteProfile.coachId matches)
3. Request body passes Zod validation
4. Permission rules from Section 4 are enforced (claim status gating)

---

## New Pages

| Path | Purpose |
|------|---------|
| `/coach/athletes/[id]/profile/edit` | Master Profile form in coach-edit mode |
| `/athlete/review-profile` | Post-claim review page (Step 2 of claim flow) |

---

## Implement Naming Conventions

When displaying implement weights throughout the app (action bar presets, throw logs, PR displays):
- **Men's hammer competition weight:** show as "7.26kg / 16lb"
- **Women's hammer competition weight:** show as "4kg"
- **All other implements:** show in kg with lbs equivalent available via toggle
- Display convention is based on the athlete's `gender` field
- Storage is always in kg (existing pattern via `implementWeight` + `implementWeightUnit` + `implementWeightOriginal`)

---

## Dependencies

- **Master Profile Form:** The "Edit Profile" action bar button (Section 2c) navigates to the 6-section Master Profile form. That form is specified in `2026-03-24-athlete-master-profile-design.md` but not yet built. Implementation options:
  - **Option A (recommended):** Build a simplified profile editor as part of this spec (core info + competition PRs + strength numbers — the fields coaches most need). Defer Technical Profile and Injury sections to the full Master Profile build.
  - **Option B:** Build the full Master Profile form as a prerequisite. This delays proxy profiles.
  - The implementation plan should use Option A — ship a working profile editor now, expand it when the Master Profile is built.

- **R2 Video Upload:** Video upload (Sections 2a, 2b) depends on the existing R2 integration. The codebase already has R2 upload infrastructure via VoiceNote and existing video features — reuse that.

---

## Testing Strategy

1. **Schema migration:** verify new models create correctly, relations work, indexes exist
2. **Coach throw logging:** log throws with/without video, verify ThrowLog records, PR detection
3. **Video upload:** upload to R2, verify AthleteVideo record, thumbnail generation
4. **Coach notes:** create/edit/delete, verify private vs shared visibility
5. **Profile editing:** coach edits unclaimed profile (all fields), coach edits claimed profile (gated fields)
6. **Add Athlete flow:** create proxy profile, verify placeholder User + AthleteProfile created
7. **Claim flow:** generate invite, athlete claims, review page shows correct data, onboarding skip logic
8. **Roster indicator:** ghost icon appears for unclaimed, disappears after claim, invite CTA in Last Session column
9. **Permission gating:** verify coach can't edit athlete-owned fields on claimed profiles
10. **Mobile UX:** action bar sticky positioning, bottom sheet modals, touch targets
