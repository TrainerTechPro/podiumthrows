# Athlete Master Profile — Design Spec

**Date:** 2026-03-24
**Status:** Draft
**Route:** `/athlete/profile`

---

## Overview

Replace the current `/athlete/profile` redirect-to-settings with a comprehensive 6-tab profile page based on the Throws Athlete Master Profile Template. This page is the athlete's single source of truth — core info, competition goals, implement performance, strength numbers, technical profile, and injury history.

Data from this page feeds directly into the Bondarchuk programming engine. Strength numbers drive load calculations, implement PRs drive volume distribution, and injury data drives exercise avoidance.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data storage | Read existing models + add missing fields only | Avoids duplicating ThrowsPR and ThrowsInjury data |
| Tab layout | Icon tabs (Lucide icons + short labels) | Fits all 6 tabs without scrolling on mobile |
| New core fields | Scalar columns (`turnDirection`, `classStanding`, `gradYear`) | Queryable, simple migration |
| Strength numbers | JSON field on AthleteProfile | Structured but flexible — lifts, tests, ratios in one field |
| Sections 1-4 edit | Both athlete and coach | Last-write-wins; athlete logs own maxes, coach can correct |
| Sections 5-6 edit | Coach-only | Athlete sees read-only with "Managed by your coach" badge |
| Profile editing | Moved from /athlete/settings into Core Info tab | Single profile destination |

## Schema Changes

Single Prisma migration adding fields to `AthleteProfile`:

```prisma
// Section 1 — Core Info
turnDirection   String?   // "LEFT" | "RIGHT"
classStanding   String?   // "FR" | "SO" | "JR" | "SR" | "GRAD" | "PRO"
gradYear        Int?

// Section 2 — Competition & Distance Bands
// Shape: { [event: string]: { competitionPR: { distance: number, date: string, meet: string }, seasonBest: { distance: number, date: string, meet: string }, seasonGoal: number, careerGoal: number, targetBand: string } }
// Note: currentBand is NOT stored here — it's read from ThrowsProfile.currentDistanceBand (computed by the engine)
competitionGoals Json?

// Section 4 — Strength Numbers
// Shape: { lifts: { [name: string]: { current: number, date: string, goal: number, correlation: string } }, tests: { standingLJ: number, tripleJump: number }, ratios: { squatBW: number, cleanBW: number, snatchBW: number } }
strengthNumbers  Json?

// Section 5 — Technical Profile (coach-managed)
// Shape: { primaryLimiter: string, strengths: string[], weaknesses: string[], cuesWork: Array<{ phase: string, cue: string, why: string }>, cuesFail: Array<{ cue: string, why: string }> }
technicalProfile Json?

// Section 6 — Movement Restrictions (coach-managed)
// Shape: { fullOverhead: boolean, fullHipRotation: boolean, deepSquat: boolean, singleLegStability: boolean, notes: string }
movementRestrictions Json?
```

**Not adding:** `implementPRs` (reads from `ThrowsPR` model), `injuryHistory` (reads from `ThrowsInjury` model).

The existing `performanceBenchmarks String? @db.Text` field remains but is superseded by `strengthNumbers` for structured data. During the transition, if `strengthNumbers` is null but `performanceBenchmarks` has data, Tab 4 should attempt to parse and display it as a fallback. This is advisory — skip if the existing data format is too inconsistent.

## File Structure

```
src/app/(dashboard)/athlete/profile/
  page.tsx                  — Server Component: parallel data fetching
  _profile-tabs.tsx         — Client Component: icon tab bar + tab state
  _tab-core.tsx             — Core Info form (name, class, turn, events, height, weight)
  _tab-competition.tsx      — Competition PRs, goals, distance bands per event
  _tab-implements.tsx       — Read-only implement performance from ThrowsPR
  _tab-strength.tsx         — Strength numbers form (lifts, tests, ratios)
  _tab-technical.tsx        — Read-only technical profile (coach-managed)
  _tab-injury.tsx           — Read-only injury & health (coach-managed)
  loading.tsx               — Shimmer skeleton
```

## Data Flow

### Server Component (page.tsx)

Parallel fetch:

```typescript
// Note: throwsProfiles is an array — one per event (@@unique([athleteId, event]))
const [profile, throwsPRs, injuries, throwsProfiles] = await Promise.all([
  prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true, firstName: true, lastName: true, events: true, gender: true,
      dateOfBirth: true, avatarUrl: true, heightCm: true, weightKg: true,
      turnDirection: true, classStanding: true, gradYear: true,
      competitionGoals: true, strengthNumbers: true,
      technicalProfile: true, movementRestrictions: true,
      user: { select: { email: true } },
    },
  }),
  prisma.throwsPR.findMany({
    where: { athleteId },
    orderBy: { distance: 'desc' },
  }),
  prisma.throwsInjury.findMany({
    where: { athleteId },
    orderBy: { injuryDate: 'desc' },
  }),
  prisma.throwsProfile.findMany({
    where: { athleteId },
    select: {
      competitionPb: true, currentDistanceBand: true,
      strengthBenchmarks: true, event: true,
    },
  }),
]);
```

### API Route

Extend existing `PATCH /api/athlete/profile` to accept:
- `turnDirection`, `classStanding`, `gradYear` (scalar fields)
- `competitionGoals` (JSON)
- `strengthNumbers` (JSON)

**Partial update support:** The current PATCH handler requires `firstName` and `lastName` on every request. Refactor to allow partial payloads — only validate fields that are present in the request body. Each tab sends only its own fields on save (e.g., Tab 4 sends `{ strengthNumbers: {...} }` without name fields). Build the Prisma `data` object conditionally from whatever fields are provided.

No new API routes.

### Read-Only Sections

- **Tab 3 (Implements):** Reads `ThrowsPR[]` passed from server component. Auto-calculates differentials vs competition implement. Color-codes ratio compliance (green = within 15-20%, amber = borderline, red = outside).
- **Tab 5 (Technical):** Reads `profile.technicalProfile` JSON. Displays "Managed by your coach" badge. Shows empty state with explanation if null.
- **Tab 6 (Injury):** Reads `ThrowsInjury[]` for history + `profile.movementRestrictions` JSON for checklist. Shows "Managed by your coach" badge.

## Tab Content Design

### Tab 1 — Core Info

Mobile-first stacked layout, 2-col grid on `sm:`.

- **Name:** First + Last (text inputs, 2-col on desktop)
- **Class Standing:** Pill toggle (FR / SO / JR / SR / GRAD / PRO) + Grad Year input
- **Turn Direction:** Two-button toggle (Left / Right) with rotation arrow icons
- **Events:** Selectable cards (existing pattern from settings form)
- **Gender:** Pill toggle (Male / Female / Other)
- **Date of Birth:** Date input
- **Height / Weight:** Number inputs with units (cm / kg), 2-col on desktop
- Save button at bottom

### Tab 2 — Competition & Distance Bands

Per-event sections (only events the athlete has selected). Each event section:

- **Competition PR:** Distance (m) + Date + Meet Name
- **Season Best:** Distance + Date + Meet Name
- **Season Goal:** Distance input (m)
- **Career Goal:** Distance input (m)
- **Current Distance Band:** Read-only, sourced from `ThrowsProfile.currentDistanceBand` (computed by the engine). Displayed if a ThrowsProfile exists for this event; otherwise shows "Not yet calculated."
- **Target Distance Band:** Editable input, stored in `competitionGoals` JSON. This is the athlete's/coach's aspirational target, separate from the computed current band.

On mobile: each event is a collapsible card (tap to expand). On desktop: side-by-side cards.

Save button per section or single save for all events.

### Tab 3 — Implement Performance (Read-Only)

Grouped by event. For each event:

| Implement | Best Distance | Date | vs Competition |
|-----------|--------------|------|----------------|
| 9kg | 15.42m | 2026-01-15 | -2.84m (82.5%) |
| 8kg | 16.90m | 2026-02-10 | -1.36m (91.3%) |
| 7.26kg (comp) | 18.26m | 2026-03-01 | — |
| 6kg | 19.80m | 2026-02-20 | +1.54m (108.4%) |

- **Display order: descending by implement weight** (heaviest first). This aligns with Bondarchuk methodology — heavy implements always come first.
- Desktop: table with `tabular-nums`
- Mobile: stacked cards per implement
- Color coding: green (within target ratio), amber (borderline), red (outside 15-20% rule)
- Empty state: "No implement PRs recorded yet. Log throws to build your implement profile."

### Tab 4 — Strength Numbers

**Lift cards** (Back Squat, Front Squat, Snatch, Power Clean, Bench Press):
- Current Max (kg) + Date Tested + Goal + Correlation to event badge
- On mobile: stacked cards. On desktop: 2-col grid.

**Athletic Tests:**
- Standing Long Jump (mm input)
- Triple Jump (m input)

**Auto-calculated Strength-to-Bodyweight Ratios** (read-only display):
- Squat/BW — target 2.0+
- Clean/BW — target 1.3+
- Snatch/BW — target 1.0+
- Display as progress bars with target markers. Green if meeting, amber if close, red if below.

Save button at bottom.

### Tab 5 — Technical Profile (Read-Only)

- **Primary Limiter:** Callout card with amber/gold border
- **Strengths:** Green-tinted chips (up to 3)
- **Weaknesses:** Numbered amber chips, ranked 1-3
- **Cues That Work:** Grouped by phase (Winds/Entry, Turns/Middle, Finish/Release). Each cue in a card with the "Why It Works" explanation below.
- **Cues That Don't Work:** Red-tinted cards with "Why It Fails" explanation.
- **Empty state:** "Your coach hasn't set up your technical profile yet."
- **Badge:** "Managed by your coach" at top

### Tab 6 — Injury & Health (Read-Only)

**Current Limitations** (active ThrowsInjury records where `recovered = false`):
- Alert-style cards showing: `bodyPart` + `side`, `severity`, `description`
- Training impact synthesized from boolean flags: `throwsBanned` → "No throwing", `heavyBanned` → "No heavy implements", `strengthBanned` → "No strength work", `modifiedLoad` → "Modified load only"
- `treatmentPlan` displayed if present
- Color: amber border for `severity = "moderate"`, red for `severity = "severe"`

**Injury History** (all ThrowsInjury records):
- Timeline layout: `injuryDate`, `bodyPart`+`side`, `severity`, `description`
- Recovery info: `returnToThrowDate`, `fullReturnDate`, `recoveredDate`
- Recovered injuries in muted style

**Movement Restrictions Checklist:**
- Full overhead mobility: checkmark or X
- Full hip rotation (both directions): checkmark or X
- Deep squat capacity: checkmark or X
- Single leg stability: checkmark or X
- Notes field displayed below if present

- **Empty state:** "No injury data recorded. Your coach manages this section."
- **Badge:** "Managed by your coach" at top

## Design System Compliance

- **Tabs:** Custom icon tab bar component (not the existing `<Tabs>` underline variant). Lucide icons: `User`, `Trophy`, `Scale`, `Dumbbell`, `Target`, `ShieldAlert`. Active tab: amber/gold highlight + filled background. Inactive: muted. On very small screens (< 360px), labels hide and only icons show.
- **Cards:** `card` class for static display cards. `card-interactive` only for collapsible event sections.
- **Icons:** Lucide React, `strokeWidth={1.75}`, `aria-hidden="true"`.
- **Typography:** Section headers use `text-sm font-semibold text-muted uppercase tracking-wider`. Numeric values use `tabular-nums`.
- **Color tokens:** CSS custom properties throughout. Status colors: emerald (meeting target), amber (borderline), red (below/at risk).
- **Animations:** `ScrollProgressBar` at page top. `StaggeredList` for card grids. `AnimatedNumber` for hero stats. `NumberFlow` for live-updating S:BW ratios. Tab content fade+slide transitions via existing `TabPanel` pattern.
- **Mobile-first:** All layouts stack on mobile, expand to grid on `sm:` / `md:`. No horizontal scrolling except for implement tables on very small screens (`overflow-x-auto custom-scrollbar`).
- **Save feedback:** Uses `useToast()` for success/error feedback on save.
- **Loading:** Shimmer skeletons in `loading.tsx`.

## Scope Boundaries

**In scope:**
- New athlete profile page with 6 tabs
- Schema migration (5 new fields on AthleteProfile)
- Extended PATCH API route
- Loading skeleton
- Read-only display for Sections 3, 5, 6

**Out of scope (follow-up work):**
- Coach-side editing UI for Technical Profile and Injury (on coach athlete detail page)
- Migration of data from `performanceBenchmarks` to `strengthNumbers`
- Implement ratio target configuration
- Distance band auto-calculation logic
- Removal of profile fields from `/athlete/settings` (keep both working during transition)
