# Competition Logging v2 — Design

**Status:** Draft · awaiting user review
**Date:** 2026-04-16
**Sub-project:** A of a three-part initiative (A → B → C)

## Context

This is the first sub-project of a larger initiative. The sequenced pieces:

- **A. Competition Logging v2** _(this spec)_ — structured per-throw meet logging with rounds, fouls, and per-meet context
- **B. Trend Analysis Engine** _(future spec)_ — algorithm that correlates competitions, practice, readiness, and lifts to surface insights with confidence scores
- **C. Insight Delivery + Permissions** _(future spec)_ — athlete-simple vs coach-detailed views, coach-controlled detail gating, insight notifications
- **D. Expanded Data Collection** _(optional, deferred)_ — additional questionnaires and check-in prompts to feed B with more signal; revisited only after B is live and data gaps are known

B depends on A producing structured competition data. C depends on B producing insights. D is an optional enhancement layer. This spec is scoped strictly to A.

## Goal

A coach or athlete can log a competition with per-throw detail (round, attempt, mark/foul/pass, foul type, optional video and notes per throw), capture meet-level context (place, weather, wind, indoor/outdoor, implement weight, meet status), and have the unified PR system pick up new competition PRs automatically.

## Non-goals

- Trend analysis, correlation, or any post-hoc insight (sub-project B)
- Coach-gating of insight detail (sub-project C)
- Notifications for training trends — only competition events (PR + meet-logged)
- Live-mode mobile UX with an offline queue — schema supports it, UI does not ship it
- Expanded readiness questionnaires (sub-project D)
- Changes to the Bondarchuk programming engine
- Sharing meet results externally / public profiles
- Master Profile section 2 competition-PR edits — handled by a separate upcoming spec

---

## Architecture Overview

### Where it sits in the codebase

- **Schema:** `prisma/schema.prisma` — extend `ThrowsCompetition` (per-meet context) + extend `ThrowLog` (nullable competition columns). `ThrowLog` remains the single source for every throw an athlete has ever taken.
- **API:** Extend `src/app/api/throws/competitions/route.ts` (meet CRUD already exists) and add `src/app/api/throws/competitions/[id]/throws/route.ts` for per-throw mutations.
- **UI:** Rewrite `src/app/(dashboard)/coach/competitions/results/_results-entry-client.tsx` into a table-style per-throw editor. New athlete-facing pages at `src/app/(dashboard)/athlete/competitions/...` reuse the same editor component under `src/components/competitions/`.
- **PR resolver:** `src/lib/data/personal-records.ts` — no behavior change. Existing `isCompetition` filter picks up new throws automatically. One additive field (`bestLoggedCompThrow`) exposed for a new UI badge.
- **Notifications:** Existing `Notification` model. A new helper `src/lib/competitions/notify.ts` fires PR + meet-logged notifications, fail-safely.

### Key invariants

- `ThrowLog` is the single source of truth for throws. Aggregations never union across tables.
- A competition with per-throw data has `result = null`. A legacy competition has `result` populated and zero linked `ThrowLog` rows.
- Anyone passing `canAccessAthlete(userId, role, athleteId)` can create, view, edit, delete competitions and throws for that athlete.

### Decisions made during brainstorming

| Decision                                     | Chosen option                                                                 | Why                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Competition formats                          | `THREE_PLUS_THREE` (3+3, top 9 advance) and `FOUR_STRAIGHT`                   | Covers ~95% of real meets; simplest schema; format field is flexible enough to extend later   |
| Entry mode                                   | Retroactive-first, throw-by-throw schema from day 1                           | Live mode is rarely used (coaches are filming); schema supports future live UX without rework |
| Per-throw RPE                                | Dropped                                                                       | Athletes won't fill it for every throw in a meet                                              |
| `PASS` result type                           | Kept (rare but tactically meaningful)                                         | Passing a final attempt to protect a place is distinct from fouling                           |
| Per-meet context                             | place, weather, wind, indoor/outdoor, implement weight, meet status — all yes | All feed into the future trend engine and round out the coach-facing record                   |
| Data architecture                            | Extend `ThrowLog` in place with nullable competition columns                  | One table for every throw; existing PR resolver works unchanged                               |
| Legacy data                                  | Preserve as-is; show "legacy single-result" banner; lazy per-meet upgrade     | Honest UX; no silent data fabrication                                                         |
| Distance input                               | Accept meters or ft+in; parse + store meters                                  | Matches existing implement-weight pattern                                                     |
| Creation permission                          | Anyone with `canAccessAthlete` access (coach, athlete, self-coached athlete)  | Retroactive logging requires athlete self-creation                                            |
| Notifications                                | PR + meet-logged, both directions (coach ↔ athlete)                           | Drives engagement and surfaces coach-athlete conversation                                     |
| Retroactive entry UX                         | Spreadsheet table (Approach 1), API designed so a stepper can be added later  | Fast for bulk entry; fits the dominant flow                                                   |
| "Promote legacy result to unified PR" button | Yes                                                                           | Fixes the silent "my PR didn't carry over" gap for existing users                             |

---

## Data Model

### Extend `ThrowsCompetition`

```prisma
model ThrowsCompetition {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  name      String
  date      String         // YYYY-MM-DD
  event     EventType
  priority  String         @default("B") // A, B, C — kept

  // Legacy single-result mode (preserved for existing rows)
  result    Float?         // meters; null on new per-throw rows
  resultBy  String?        // COACH | ATHLETE — kept for legacy rows

  // NEW per-meet context
  implementWeightKg Float?         // overrides gender-default; null = use default
  placeFinish       Int?           // 1, 2, 3...; null when status != COMPLETED
  meetStatus        MeetStatus     @default(COMPLETED)
  venueType         VenueType?     // INDOOR | OUTDOOR
  weather           String?        // short free text: "windy", "rain", "70°F sunny"
  windMps           Float?         // positive = tailwind, negative = headwind
  notes             String?        // meet-level notes
  format            CompFormat?    @default(THREE_PLUS_THREE)
  madeFinals        Boolean?       // null until prelims done

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  throws    ThrowLog[]     // new relation

  @@index([athleteId, date])
}

enum MeetStatus { COMPLETED DNS DNF DQ }
enum VenueType  { INDOOR OUTDOOR }
enum CompFormat { THREE_PLUS_THREE FOUR_STRAIGHT }
enum ThrowRound { PRELIM FINALS }
enum FoulType   { RING SECTOR }
```

### Extend `ThrowLog`

```prisma
model ThrowLog {
  // ... all existing fields preserved unchanged ...

  // NEW competition linkage (all nullable — practice rows leave null)
  competitionId   String?
  competition     ThrowsCompetition? @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  round           ThrowRound?
  attemptInRound  Int?
  isFoul          Boolean            @default(false)
  foulType        FoulType?          // null unless isFoul=true
  isPass          Boolean            @default(false)

  @@index([competitionId])
}
```

### Invariants (enforced at the API / Zod layer, not via DB constraints)

- If `competitionId` is set: `round` and `attemptInRound` MUST be set; `isCompetition` MUST be true.
- `isFoul` and `isPass` are mutually exclusive. If either is true, `distance` MUST be null. If both are false, `distance` MUST be set.
- `foulType` may only be set when `isFoul = true`.
- `THREE_PLUS_THREE`: `attemptInRound ∈ {1, 2, 3}` per round.
- `FOUR_STRAIGHT`: `round = PRELIM` always; `attemptInRound ∈ {1, 2, 3, 4}`.
- A meet with `meetStatus != COMPLETED` may have zero linked throws.
- A `madeFinals = false` meet has no `round = FINALS` throws.

### What is NOT changing

- `ThrowsPR` model — unchanged. PRs continue to be derived live by `personal-records.ts`.
- `AthleteProfile.competitionPRs` JSON — unchanged. Continues to act as manual-historical-PR override merged by the resolver.
- `personal-records.ts` core resolution logic — unchanged (only an additive derived field is added).

---

## API Surface

All routes follow the project's `{ success, data | error }` envelope, use `parseBody(...)` for Zod validation, and gate via `canAccessAthlete(userId, role, athleteId)`.

### Meet-level — `src/app/api/throws/competitions/route.ts` (extended)

| Method   | Path                                  | Behavior                                                                                                                                              |
| -------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/throws/competitions`            | Create competition with new context fields                                                                                                            |
| `GET`    | `/api/throws/competitions?athleteId=` | List competitions for athlete, ordered by `date` desc; includes `_count.throws` and a derived `bestMark` for list rendering; no throw rows in payload |
| `PATCH`  | `/api/throws/competitions`            | Update meet-level fields by `id` in body                                                                                                              |
| `DELETE` | `/api/throws/competitions?id=`        | Delete a meet; cascades to linked `ThrowLog` rows                                                                                                     |

### Per-throw — `src/app/api/throws/competitions/[id]/throws/route.ts` (new)

| Method                | Behavior                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`                 | All throw rows for the competition, ordered by `(round, attemptInRound)`                                                                                                     |
| `POST`                | Create one throw row; server fills `athleteId`, `event`, `implementWeight`, `isCompetition=true`, `competitionId`; 409 on duplicate `(competitionId, round, attemptInRound)` |
| `PATCH ?throwLogId=`  | Update a throw row; re-validates invariants on mark/foul/pass transitions                                                                                                    |
| `DELETE ?throwLogId=` | Delete a throw row                                                                                                                                                           |

### Legacy promotion — `src/app/api/throws/competitions/[id]/promote-legacy/route.ts` (new)

| Method | Behavior                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | Copies the legacy `ThrowsCompetition.result` into `AthleteProfile.competitionPRs[event]` if it exceeds the current stored value; idempotent; returns updated JSON |

### Discriminated-union schema for throw body

```ts
const ThrowResultSchema = z.discriminatedUnion("resultType", [
  z.object({ resultType: z.literal("MARK"), distance: z.number().positive() }),
  z.object({ resultType: z.literal("FOUL"), foulType: z.enum(["RING", "SECTOR"]) }),
  z.object({ resultType: z.literal("PASS") }),
]);
```

Shared via `src/lib/api-schemas.ts` and imported by both client form state and server handlers — keeps client and server in lockstep.

### Notification side effects (server-side, fire-and-forget)

After a successful meet POST or per-throw POST/PATCH, `src/lib/competitions/notify.ts`:

1. **New PR detected:** re-runs `getAthletePRs(athleteId)` for the affected event, compares to a snapshot taken before the write, fires a `Notification` of `type = "COMPETITION_PR"` to the counterparty.
2. **Meet logged (first throw):** fires `type = "COMPETITION_LOGGED"` to the counterparty only on first transition from zero throws to one (no spam on subsequent edits).

Both wrapped in try/catch; notification failure NEVER fails the underlying mutation. Logged via `logger.error` per project convention.

### Deliberate non-features

- **No bulk per-throw endpoint.** Each throw saves on row-blur as one mutation — the natural unit. A bulk endpoint would lose per-throw error granularity.
- **No `GET ?include=throws`.** Two endpoints, two parallel queries from the client, simpler code.
- **No PR-recalculation endpoint.** PRs are derived live every read.

### Schema additions to `src/lib/api-schemas.ts`

- `CompetitionCreateSchema` and `CompetitionUpdateSchema` extended with new optional fields (all `.nullable().optional()` per project rule #4)
- `CompetitionThrowCreateSchema` — discriminated union + optional `videoUrl`, `notes`, `wireLength`
- `CompetitionThrowUpdateSchema` — same union, all fields optional
- `LegacyPromoteSchema` — body for the promote-legacy endpoint

---

## UI Flow

### Screens

**Coach:**

1. `/coach/competitions` — list (existing; minor refresh to show new context fields + badges)
2. `/coach/competitions/[id]` — meet detail + per-throw editor _(the main new screen; replaces today's `/results` route)_
3. Add-meet modal — extended with indoor/outdoor toggle, weather text, wind input, place input, meet status, format toggle, optional implement-weight override

**Athlete (new):**

1. `/athlete/competitions` — mirrors coach list, scoped to logged-in athlete
2. `/athlete/competitions/[id]` — same editor component as coach; no coach-only fields hidden

### `<CompetitionThrowsTable />` anatomy

Component at `src/components/competitions/CompetitionThrowsTable.tsx`, used by both coach and athlete detail pages.

**Header strip:**

- Format-driven empty rows: `THREE_PLUS_THREE` → 3 prelim rows + collapsed finals section (expands when `madeFinals=true`). `FOUR_STRAIGHT` → 4 rows, no finals section.
- "Made finals (top 9)" toggle visible only for `THREE_PLUS_THREE` after ≥1 prelim throw logged.

**Per row (desktop):**

```
[#] [ResultType: Mark | Foul | Pass] [DistanceInput | FoulTypePicker | —] [Wire (HAMMER only)] [📹] [📝] [⋯]
```

- `ResultType` = 3-way segmented control; switching types updates the next cell and clears stale values in local state.
- `DistanceInput` accepts `m`, `ft+in`, `ft-in` — new parser in `src/lib/competitions/parseDistance.ts` following the same structure as the existing implement-weight parser (original value + unit stored alongside canonical metric value for round-trip display). No existing ft↔m helper in the codebase; adding this is part of the deliverable.
- Save fires when the whole row loses focus (onBlur bubbled to the row container) with a 500ms debounce to prevent thrash when tabbing between inputs inside the same row. Each save = one POST/PATCH.
- Row save-status dot: idle / spinner / checkmark / red error with tooltip + retry.
- `📹` opens a video-upload dropzone overlay (per-throw video).
- `📝` expands an inline notes textarea below the row.
- `⋯` menu: delete throw, copy distance from previous row.

**Per row (mobile):**

- Vertically stacked within the same row. Tap to expand into edit mode; other rows collapse to a compact summary (`#1 — 18.42m` or `#2 — Foul (ring)`).

**Empty state:** format selector + meet status + "Tap a row to enter throw 1" prompt.

**Legacy banner:** when `result != null` and zero throws linked, shows:

> This meet was logged before per-throw entry. Add throws below to upgrade — your existing result of {X.XXm} will be replaced. [Promote to Unified PR]

Adding the first throw clears `result` (server-side PATCH inline with the first throw POST). Clicking "Promote to Unified PR" hits the legacy-promotion endpoint (writes to `AthleteProfile.competitionPRs`).

### Save UX

- Local per-row edit state; blur → debounce 500ms → POST (no `throwLogId`) or PATCH (with `throwLogId`).
- Optimistic local update; rollback + toast on server error.
- 409 conflict (unlikely single-user): refetch + re-render.
- Network failure: row stays "unsaved" with a retry button. Never silently lost (project rule #1).

### PR celebration

- Throw POST/PATCH response includes `prCelebration: { event, oldPR, newPR } | null` when a throw sets a new competition PR.
- Client fires `celebration("New Competition PR!", { highlight: "18.42m", description: "Shot Put" })`.
- Row gets a persistent gold border + trophy badge.
- Full-screen `<PRCelebration>` overlay is NOT used here — too disruptive mid-series. Toast + persistent badge is the right intensity.

### Mobile specifics

- Sticky footer summarizing "3 of 6 throws logged · best 18.42m"
- Bottom sheet for video upload (full-width tap target)
- `<ScrollProgressBar />` per project convention

### Validation feedback

- Per-row inline errors under the offending input ("Distance required", "Pick a foul type")
- Meet-header errors as a banner at the top
- All save-errors wired through `toast.error()` per project rule #1

### Design-system pieces used

- `<NumberFlow>` for live "best mark" in the table footer
- `<AnimatedNumber>` for meet header "best of meet" stat
- `<StaggeredList>` for meet list cards on first load
- `<SlideToConfirm variant="destructive">` for delete-meet on mobile; `<ConfirmDialog>` on desktop
- All overlays use `bg-[var(--surface-overlay)]` per project overlay rule

---

## PR Integration & Legacy Migration

### Unified PR resolver — no code changes required

`getAthletePRs()` in `src/lib/data/personal-records.ts` already:

1. Reads all `ThrowLog` rows for the athlete
2. Filters to gender-correct competition implement weight per event (tolerance `WEIGHT_TOLERANCE_KG = 0.05`)
3. Picks best `isCompetition = true` → competition PR
4. Picks best `isCompetition = false` → practice best
5. Merges against manual `competitionPRs` JSON (max wins)

New competition throws land in `ThrowLog` with `isCompetition = true` and the correct `implementWeight` — they flow through automatically.

**Non-default implement weight:** meets with `implementWeightKg` overrides (e.g., 6kg masters shot) tag their throws with that weight. The tolerance filter naturally excludes them from the canonical PR — correct behavior, a 6kg shot throw shouldn't be a shot put PR.

### Additive: `bestLoggedCompThrow` derived field

The resolver gains one new derived field per event:

```ts
bestLoggedCompThrow: PRRecord | null;
// = best competition throw ever logged at the correct implement weight,
//   regardless of whether the manual JSON override exceeds it
```

This powers a "Best logged competition throw" badge distinct from the gold "PR" badge, for cases where the manual override is higher than any logged throw.

### Server-side PR detection

Inside per-throw POST/PATCH handlers:

```ts
const beforePR = await getAthletePRs(athleteId);
const beforeBest = beforePR.events.find((e) => e.event === event)?.competitionPR?.distance ?? 0;
// ... write the throw ...
const afterPR = await getAthletePRs(athleteId);
const afterBest = afterPR.events.find((e) => e.event === event)?.competitionPR?.distance ?? 0;
const prCelebration =
  afterBest > beforeBest ? { event, oldPR: beforeBest, newPR: afterBest } : null;
return NextResponse.json({ success: true, data: { throwLog, prCelebration } });
```

Two calls per write. `getAthletePRs` is `React.cache`-wrapped for per-request dedup; two separate calls in the same handler are two queries (cache returns fresh data after the write). At 6 throws × 10 athletes × 5 meets per season per coach, this is trivial. Don't pre-optimize.

### Legacy `result` treatment

| State                       | UI behavior                                                                  | Server behavior                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `result != null`, 0 throws  | Yellow "legacy single-result" banner; `result` shown as single read-only row | `result` populates derived `bestMark` for the list                                      |
| `result != null`, ≥1 throws | Banner hidden; `result` ignored in display                                   | Server clears `result = null` on first throw POST (single PATCH alongside throw create) |
| `result == null`, ≥1 throws | Normal per-throw view                                                        | Standard                                                                                |
| `result == null`, 0 throws  | "Add throws" empty state                                                     | Standard                                                                                |

**No data migration script.** Lazy, per-meet, on first structured-throw entry.

**Critical clarification:** the existing `personal-records.ts` does NOT read `ThrowsCompetition.result` — it only reads `ThrowLog` and the manual `competitionPRs` JSON. That has always been true and remains so. Legacy single-result meets have never propagated to the canonical PR automatically, and this spec does not change that.

### "Promote legacy result to unified PR" button

New endpoint `POST /api/throws/competitions/[id]/promote-legacy`:

1. Loads the competition; confirms `result != null`
2. Authorizes via `canAccessAthlete`
3. Reads `AthleteProfile.competitionPRs` JSON (default `{}`)
4. If `result > competitionPRs[event]` (or the event key is unset), writes `competitionPRs[event] = result`
5. Returns updated JSON; idempotent

UI: shown in the legacy banner next to the "Add throws" button. Clicking it toasts "Promoted to unified PR" and the unified PR display reflects immediately (resolver re-runs on next page view).

---

## Testing

Per project TDD rule: write tests first, watch them fail, then implement.

### Zod schemas — `src/lib/api-schemas.test.ts` (extended)

- `CompetitionThrowCreateSchema` discriminated union: accepts `MARK` with positive distance, `FOUL` with foul type, `PASS` with nothing else
- Rejects `MARK` without distance, negative distance, `FOUL` without `foulType`, ambiguous bodies
- `CompetitionCreateSchema` extended fields: null/undefined for all new optionals, rejects `placeFinish < 1`; `windMps` allows positive AND negative
- Slot validator: `THREE_PLUS_THREE` accepts `(PRELIM, 1-3)` + `(FINALS, 1-3)`; `FOUR_STRAIGHT` accepts only `(PRELIM, 1-4)`

### API routes — `src/app/api/throws/competitions/__tests__/`

Integration tests against local Postgres (existing pattern from `src/app/api/throws/__tests__/data-routes.test.ts`).

**Meet routes:**

- POST with new context fields; GET returns them; PATCH updates; DELETE cascades to linked throws
- 401 if unauthenticated; 403 when `canAccessAthlete` returns false (both coach-without-link and athlete-of-different-coach)
- POST with `meetStatus = DNS` allows null `placeFinish` and zero throws

**Per-throw routes:**

- POST creates a throw; denormalizes `athleteId`/`event`/`implementWeight`/`isCompetition=true`/`competitionId` from parent
- POST duplicate `(competitionId, round, attemptInRound)` → 409
- PATCH preserves invariants (MARK → FOUL clears distance + sets `foulType`; FOUL → PASS clears `foulType`)
- DELETE removes one throw, others intact
- First throw POST clears parent meet's `result` to null
- 403 via `canAccessAthlete` on the parent meet's athlete

**PR detection in handler:**

- Throw beating prior PR returns `prCelebration` payload
- Throw worse than manual `competitionPRs` override returns `prCelebration: null`
- Throw at non-competition implement weight returns `prCelebration: null`

### PR resolver — `src/lib/data/personal-records.test.ts` (extended)

- Throw with `competitionId` set still resolves correctly
- Throw at non-default `implementWeightKg` excluded from canonical PR (tolerance check)
- New `bestLoggedCompThrow` field populated correctly when manual override exceeds best logged throw

### UI components — `src/components/competitions/__tests__/`

React Testing Library on `<CompetitionThrowsTable />`:

- Renders 3 prelim + 0 finals when `format = THREE_PLUS_THREE` and `madeFinals = false`
- Renders 3 prelim + 3 finals when `madeFinals = true`
- Renders 4 rows for `FOUR_STRAIGHT`
- Selecting `Foul` reveals foul-type picker, hides distance input, clears any distance in local state
- Blur on a populated distance row triggers save; loading dot → success checkmark
- Network error on save shows error dot + retry + toast
- Legacy banner appears when `result != null` && `throws.length === 0`; disappears after first throw saved
- "Promote to Unified PR" button POSTs to the promote-legacy endpoint and updates `AthleteProfile.competitionPRs`

### Notifications — `src/lib/competitions/__tests__/notify.test.ts`

- PR detection fires `Notification` to coach when athlete logs
- PR detection fires `Notification` to athlete when coach logs
- "Meet logged" fires only on first throw (0 → 1 transition), not subsequent saves
- Notification failure does NOT fail the throw mutation

### Manual end-to-end verification (project rule)

Before claiming the feature is done:

1. Coach creates a meet via the modal with all new context fields — confirm DB row.
2. Open meet detail, enter 3 prelim throws (1 mark, 1 foul ring, 1 pass) — verify each saves on blur, `bestMark` updates live.
3. Toggle "Made finals", enter 3 finals throws including a PR — verify celebration toast, row badge, and coach notification (second logged-in athlete account).
4. Reopen as athlete on mobile (responsive devtools), edit one throw — verify save.
5. Find an existing legacy meet — verify banner. Click "Promote to Unified PR" — verify `competitionPRs` updates and unified PR display reflects it.
6. Delete a throw, then the whole meet — verify cascade.
7. `npm run lint` → 0 errors; `npx tsc --noEmit` → 0 errors.

---

## Deliverables

**Schema:**

- [ ] Migration: extend `ThrowsCompetition` with new context fields + relation to `ThrowLog`
- [ ] Migration: extend `ThrowLog` with nullable competition columns
- [ ] New enums: `MeetStatus`, `VenueType`, `CompFormat`, `ThrowRound`, `FoulType`

**Library:**

- [ ] `src/lib/competitions/validate.ts` — slot/format/result-type invariants shared by API + UI
- [ ] `src/lib/competitions/notify.ts` — PR + meet-logged notification helper
- [ ] `src/lib/competitions/parseDistance.ts` — ft+in ↔ meters parser (+ unit tests)
- [ ] `src/lib/api-schemas.ts` — extend competition schemas; add `CompetitionThrowCreateSchema`, `CompetitionThrowUpdateSchema`, `LegacyPromoteSchema`
- [ ] `src/lib/data/personal-records.ts` — add `bestLoggedCompThrow` derived field (no resolution-logic change)

**API:**

- [ ] Extend `POST/GET/PATCH/DELETE /api/throws/competitions`
- [ ] New `GET/POST/PATCH/DELETE /api/throws/competitions/[id]/throws`
- [ ] New `POST /api/throws/competitions/[id]/promote-legacy`

**Components:**

- [ ] `src/components/competitions/CompetitionThrowsTable.tsx`
- [ ] `src/components/competitions/CompetitionMeetHeader.tsx`
- [ ] `src/components/competitions/AddMeetModal.tsx` (extend existing)
- [ ] `src/components/competitions/CompetitionListCard.tsx`

**Pages:**

- [ ] `src/app/(dashboard)/coach/competitions/page.tsx` — extended list
- [ ] `src/app/(dashboard)/coach/competitions/[id]/page.tsx` — new meet detail
- [ ] `src/app/(dashboard)/athlete/competitions/page.tsx` — new list
- [ ] `src/app/(dashboard)/athlete/competitions/[id]/page.tsx` — new meet detail

**Nav + UX:**

- [ ] Sidebar entries under coach + athlete sections
- [ ] Empty state for athletes with no logged competitions

**Tests:** all categories above.

---

## Success Criteria

1. Coach creates a meet, enters 6 throws across prelim + finals (≥1 foul, ≥1 pass), saves each on blur, sees the best mark update live, gets a celebration if it was a PR.
2. Athlete does the same for their own meet, retroactively, with no coach involved.
3. Both see a `Notification` for the counterparty's PR throw.
4. A legacy meet displays the banner; "Promote to Unified PR" click correctly updates `AthleteProfile.competitionPRs` and the unified PR display reflects it.
5. `personal-records.ts` returns the same answers it always did, plus the new `bestLoggedCompThrow` derived field.
6. `npm run lint` → 0 errors; `npx tsc --noEmit` → 0 errors; all test files pass.
7. Mobile responsive — every flow works on iPhone-sized viewport with no horizontal scroll.
8. Light and dark mode both pass the overlay readability rule (no translucent panels on the video uploader, delete confirm, or per-throw notes overlay).

---

## Risks & Open Questions for Implementation

- **`getAthletePRs` called twice per throw save** for PR detection. Trivial at current scale; if it becomes hot, refactor to "would this beat current PR" inline from a single query. Don't pre-optimize.
- **Shared discriminated-union type** across client and server lives in `src/lib/api-schemas.ts`. Make sure the client form state types import from there so the two stay in lockstep.
- **Hammer wire length per throw** — already a field on `ThrowLog`. UI just needs to expose it conditionally for hammer throws.
- **Indoor weight throw** uses different implements than outdoor hammer. The `event` field stays `HAMMER` either way; `venueType` + `implementWeightKg` capture the difference. The unified PR resolver currently doesn't distinguish indoor vs outdoor PRs — this is a real gap in the existing system but **out of scope for this spec.** Flag for a follow-up.

---

## Scope Guardrails (Stop and Ask)

If any of these come up during implementation, stop and ask before adding:

- Trend analysis or correlation across meets / training periods → sub-project B
- Coach controlling athlete insight detail → sub-project C
- Notifications about training trends (not competition events) → sub-project C
- Live-mode mobile UX with offline queue → deferred polish
- AI-generated meet recap or suggestions → sub-project B/C
- External meet sharing / public profile → separate feature
- Side-by-side multi-athlete meet comparison → roster feature, not this spec
- Bondarchuk programming engine changes → engine overhaul complete
- Master Profile section 2 competition-PR edits → separate upcoming spec
