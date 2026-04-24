# Schema Consolidation Manifest — PR 2 (MODE: RESEARCH)

**Generated:** 2026-04-24
**Mode:** RESEARCH per CLAUDE-standards.md §Development Mode Protocol — observe only. No MODE: PLAN; no migration files; no `schema.prisma` edits; no callsite changes.
**Scope:** four coach-as-athlete Prisma model pairs flagged in the original consolidation brief.
**Gating:** this manifest is the input to PR 2 MODE: PLAN. MODE: PLAN does NOT start until the PR 1 24h soak window closes clean AND the user explicitly approves.

---

## 0. Why this matters

The four pairs below exist only because a coach can also be an athlete. Each pair duplicates fields and invariants: adding a feature costs twice, bugs hide on one side without the other, and the programming engine can't serve both surfaces from a single model. Consolidating to unified tables with a `userId` discriminator lets every feature ship once.

## 1. The four pairs

| Athlete-side            | Coach-side            | Prisma lines (athlete / coach) |
| ----------------------- | --------------------- | ------------------------------ |
| `ThrowsPR`              | `CoachPR`             | 1643 / 2040                    |
| `ThrowsTyping`          | `CoachTyping`         | 1712 / 2057                    |
| `AthleteThrowsSession`  | `CoachThrowsSession`  | 1812 / 1866                    |
| `AthleteDrillLog`       | `CoachDrillLog`       | 1846 / 1896                    |

## 2. Row counts

### 2.1 Local-dev reference (fact, not prod)

Queried 2026-04-24 against `postgresql://anthonysommers@localhost:5432/podium_throws` — the seeded dev database. Useful for understanding typical test-data shape; **NOT a substitute for prod counts.**

| Model                    | Local rows |
| ------------------------ | ---------- |
| `ThrowsPR`               | 0          |
| `CoachPR`                | 0          |
| `ThrowsTyping`           | 0          |
| `CoachTyping`            | 0          |
| `AthleteThrowsSession`   | 26         |
| `CoachThrowsSession`     | 0          |
| `AthleteDrillLog`        | 23         |
| `CoachDrillLog`          | 0          |

### 2.2 Prod row counts — SQL handoff workflow

Prod data is NOT queried from this session. Per the §2 SQL-handoff pattern:

1. The read-only SQL profile lives at **`tasks/schema-consolidation-queries.sql`** (21 sections, every query SELECT-only).
2. User runs each section in the Supabase SQL editor against project **`bfmswuxblbwomntvkwdw`** (podium-throws prod).
3. User exports each result as CSV and saves it in **`tasks/schema-consolidation-query-results/`** using the exact filenames the dropzone README expects (`section-0-row-counts.csv`, `section-1a-coachpr-coach-only-fields.csv`, etc.).
4. Once all 21 CSVs land, this manifest's §2.3 table and the per-pair prod-usage columns in §3 get back-filled with real numbers. Until then, every prod-row cell below is marked `TODO: awaiting user SQL run`.

**Why the handoff** (not live MCP): prod Supabase access from this session is scoped by sandbox policy; the CSV dropzone keeps prod access inside the dashboard session the owner is already signed into and leaves an auditable artifact. This is the only read-only prod entry point for PR 2 until MODE: PLAN opens.

### 2.3 Prod row counts — back-fill slot

| Model                    | Prod rows                         | Source                           |
| ------------------------ | --------------------------------- | -------------------------------- |
| `ThrowsPR`               | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `CoachPR`                | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `ThrowsTyping`           | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `CoachTyping`            | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `AthleteThrowsSession`   | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `CoachThrowsSession`     | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `AthleteDrillLog`        | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |
| `CoachDrillLog`          | TODO: awaiting user SQL run       | `section-0-row-counts.csv`       |

## 3. Field-by-field diffs

Column types + nullability below are derived 1:1 from `prisma/schema.prisma` at commit HEAD. The "Prod usage" column is the back-fill slot populated from the CSV corresponding to each pair.

### 3.1 Pair 1 — `ThrowsPR` ↔ `CoachPR`

Canonical-target suggestion (for PLAN, not settled): **`ThrowsPR` as the unified table** (longer history, more inbound links). Add coach-only columns as nullable. Migrate `CoachPR` rows in; swap `CoachProfile.coachPRs` relation onto the unified model.

| Field                | ThrowsPR                                           | CoachPR                                              | Flag                   |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| `id`                 | `String @id @default(cuid())`                      | `String @id @default(cuid())`                        | both                   |
| discriminator        | `athleteId String` → `AthleteProfile`              | `coachId String` → `CoachProfile`                    | discriminator          |
| `event`              | `String` (plain text, e.g. `"SHOT_PUT"`)           | `EventType` enum                                     | **type diff**          |
| `implement`          | `String`                                           | `String`                                             | both                   |
| `distance`           | `Float`                                            | `Float`                                              | both                   |
| `achievedAt`         | `String` (YYYY-MM-DD)                              | `DateTime @default(now())`                           | **type diff**          |
| `source`             | `String?` (`"TRAINING" \| "COMPETITION"`)          | `String? @default("session")`                        | both; defaults differ  |
| `sessionId`          | —                                                  | `String?`                                            | **coach-only**         |
| `drillType`          | —                                                  | `String?`                                            | **coach-only**         |
| `createdAt`          | `DateTime @default(now())`                         | —                                                    | **athlete-only**       |
| `updatedAt`          | `DateTime @updatedAt`                              | —                                                    | **athlete-only**       |
| **Unique**           | `@@unique([athleteId, event, implement])`          | `@@unique([coachId, event, implement])`              | equivalent shape       |
| **Index**            | —                                                  | `@@index([coachId])`                                 | coach-only             |

**Prod usage back-fill slots** (populated from `section-1a-coachpr-coach-only-fields.csv`, `-1b`, `-1c`, `-1d`, `-1e`):

| Probe                                                                 | Value                           |
| --------------------------------------------------------------------- | ------------------------------- |
| CoachPR rows with non-null `sessionId`                                | TODO: awaiting user SQL run     |
| CoachPR rows with non-null `drillType`                                | TODO: awaiting user SQL run     |
| CoachPR rows with non-default `source`                                | TODO: awaiting user SQL run     |
| ThrowsPR `source` distribution                                        | TODO: awaiting user SQL run     |
| ThrowsPR rows with `event` outside SHOT_PUT/DISCUS/HAMMER/JAVELIN     | TODO: awaiting user SQL run     |

Reconciliation calls deferred to PLAN. Observations only:

- `event` type diff (String vs EventType) — athlete-side storage is a plain text column; coach-side uses the Prisma enum. Resolution depends on whether prod athlete data includes non-enum strings (§1e query).
- `achievedAt` type diff (String vs DateTime) — athlete-side loses time-of-day info. Either side's format is recoverable; migration direction is a PLAN decision.
- `createdAt`/`updatedAt` missing on CoachPR — PLAN will need a backfill strategy if those columns survive on the unified table.

### 3.2 Pair 2 — `ThrowsTyping` ↔ `CoachTyping`

Canonical-target suggestion (for PLAN, not settled): **a fresh unified `BondarchukTyping`** rather than rename-in-place. Naming asymmetry is extensive (quiz-prefixed vs response-suffixed), storage types differ (`String` vs `String @db.Text`), and each side has role-specific fields.

| Field (proposed name)            | ThrowsTyping                                          | CoachTyping                                            | Flag                         |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `id`                             | `String @id cuid`                                     | `String @id cuid`                                      | both                         |
| discriminator                    | `athleteId String @unique`                            | `coachId String @unique`                               | discriminator                |
| adaptation-speed responses       | `quizAdaptationSpeed String?`                         | `adaptationSpeedResponses String? @db.Text`            | rename + Text promotion      |
| transfer-type responses          | `quizTransferType String?`                            | `transferTypeResponses String? @db.Text`               | rename + Text promotion      |
| self-feeling responses           | `quizSelfFeeling String?`                             | `selfFeelingResponses String? @db.Text`                | rename + Text promotion      |
| light-implement responses        | `quizLightImpl String?`                               | `lightImplResponses String? @db.Text`                  | rename + Text promotion      |
| recovery responses               | `quizRecovery String?`                                | `recoveryResponses String? @db.Text`                   | rename + Text promotion      |
| `adaptationGroup`                | `Int?`                                                | `Int?`                                                 | both                         |
| `adaptationLabel`                | —                                                     | `String?`                                              | **coach-only**               |
| adaptation confidence            | `confidenceAdaptation Int @default(0)`                | `adaptationConf Int?`                                  | rename + nullability diff    |
| `transferType`                   | `String?`                                             | `String?`                                              | both                         |
| `transferLabel`                  | —                                                     | `String?`                                              | **coach-only**               |
| transfer confidence              | `confidenceTransfer Int @default(0)`                  | `transferConf Int?`                                    | rename + nullability diff    |
| `selfFeelingAccuracy`            | `String?`                                             | `String?`                                              | both                         |
| `selfFeelingLabel`               | —                                                     | `String?`                                              | **coach-only**               |
| self-feeling confidence          | `confidenceSelfFeeling Int @default(0)`               | `selfFeelingConf Int?`                                 | rename + nullability diff    |
| `lightImplResponse`              | `String?`                                             | `String?`                                              | both                         |
| `lightImplLabel`                 | —                                                     | `String?`                                              | **coach-only**               |
| `lightImplConf`                  | —                                                     | `Int?`                                                 | **coach-only**               |
| `recoveryProfile`                | `String?`                                             | `String?`                                              | both                         |
| `recoveryLabel`                  | —                                                     | `String?`                                              | **coach-only**               |
| `recoveryConf`                   | —                                                     | `Int?`                                                 | **coach-only**               |
| `recommendedMethod`              | `String?`                                             | `String?`                                              | both                         |
| `methodReason`                   | —                                                     | `String? @db.Text`                                     | **coach-only**               |
| complex duration                 | `optimalComplexDuration String?`                      | `complexDuration String?`                              | rename                       |
| sessions to form                 | `estimatedSessionsToForm Int?`                        | `sessionsToForm Int?`                                  | rename                       |
| `complexesAnalyzed`              | `Int @default(0)`                                     | —                                                      | **athlete-only**             |
| `totalSessionsTracked`           | `Int @default(0)`                                     | —                                                      | **athlete-only**             |
| completion date                  | `quizCompletedDate String?` (YYYY-MM-DD)              | `completedAt DateTime @default(now())`                 | **type diff**                |
| refined date                     | `lastRefinedDate String?`                             | (n/a — covered by `updatedAt`)                         | **athlete-only**             |
| `typingSource`                   | `String @default("QUIZ")`                             | —                                                      | **athlete-only**             |
| `quizAssignedByCoach`            | `Boolean @default(false)`                             | —                                                      | **athlete-only**             |
| `quizAssignedDate`               | `String?`                                             | —                                                      | **athlete-only**             |
| `createdAt`                      | `DateTime @default(now())`                            | —                                                      | **athlete-only**             |
| `updatedAt`                      | `DateTime @updatedAt`                                 | `DateTime @updatedAt`                                  | both                         |

**Prod usage back-fill slots** (from `section-2a`, `-2b`, `-2c`, `-2d`):

| Probe                                                                 | Value                           |
| --------------------------------------------------------------------- | ------------------------------- |
| CoachTyping rows with any *Label populated                            | TODO: awaiting user SQL run     |
| CoachTyping rows with any *Conf populated                             | TODO: awaiting user SQL run     |
| CoachTyping rows with `methodReason` populated                        | TODO: awaiting user SQL run     |
| ThrowsTyping rows with `typingSource <> 'QUIZ'`                       | TODO: awaiting user SQL run     |
| ThrowsTyping rows with `quizAssignedByCoach = true`                   | TODO: awaiting user SQL run     |
| ThrowsTyping rows with `complexesAnalyzed > 0`                        | TODO: awaiting user SQL run     |
| Rename-pair population parity (optimal vs complex, estimated vs sessions) | TODO: awaiting user SQL run |
| ThrowsTyping `quizCompletedDate` ISO-validity count                   | TODO: awaiting user SQL run     |

### 3.3 Pair 3 — `AthleteThrowsSession` ↔ `CoachThrowsSession`

Canonical-target suggestion (for PLAN, not settled): **`ThrowsSession`** — drop both role prefixes, discriminator is `userId`. Pair is nearly symmetric.

| Field                | Athlete                                                        | Coach                                                          | Flag             |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| `id`                 | `String @id cuid`                                              | `String @id cuid`                                              | both             |
| discriminator        | `athleteId String` → `AthleteProfile`                          | `coachId String` → `CoachProfile`                              | discriminator    |
| `event`              | `String` (plain text)                                          | `EventType` enum                                               | **type diff**    |
| `date`               | `String` (YYYY-MM-DD)                                          | `String` (YYYY-MM-DD)                                          | both             |
| `focus`              | `String?`                                                      | `String?`                                                      | both             |
| `notes`              | `String?`                                                      | `String?`                                                      | both             |
| `sleepQuality`       | `Int?`                                                         | `Int?`                                                         | both             |
| `sorenessLevel`      | `Int?`                                                         | `Int?`                                                         | both             |
| `energyLevel`        | `Int?`                                                         | `Int?`                                                         | both             |
| `sessionRpe`         | `Int?`                                                         | `Int?`                                                         | both             |
| `sessionFeeling`     | `String?`                                                      | `String?`                                                      | both             |
| `techniqueRating`    | `Int?`                                                         | `Int?`                                                         | both             |
| `mentalFocus`        | `Int?`                                                         | `Int?`                                                         | both             |
| `bestPart`           | `String?`                                                      | `String?`                                                      | both             |
| `improvementArea`    | `String?`                                                      | `String?`                                                      | both             |
| `loggedByCoach`      | `Boolean @default(false)`                                      | —                                                              | **athlete-only** |
| `createdAt`          | `DateTime @default(now())`                                     | `DateTime @default(now())`                                     | both             |
| `updatedAt`          | `DateTime @updatedAt`                                          | `DateTime @updatedAt`                                          | both             |
| **Index**            | `@@index([athleteId, date])`, `@@index([athleteId, event])`    | `@@index([coachId, date])`, `@@index([coachId, event])`        | equivalent shape |

**Prod usage back-fill slots** (from `section-3a`, `-3b`, `-3c`, `-3d`):

| Probe                                                                 | Value                           |
| --------------------------------------------------------------------- | ------------------------------- |
| AthleteThrowsSession rows with `loggedByCoach = true`                 | TODO: awaiting user SQL run     |
| AthleteThrowsSession rows with `event` outside enum set               | TODO: awaiting user SQL run     |
| Shared nullable-feedback field population (RPE, feeling, …) both sides | TODO: awaiting user SQL run    |

### 3.4 Pair 4 — `AthleteDrillLog` ↔ `CoachDrillLog`

Canonical-target suggestion (for PLAN, not settled): **`DrillLog`** — drop both role prefixes. Pair is identical modulo session-FK target; unifying Pair 3 auto-unifies this.

| Field                     | Athlete                                                   | Coach                                                  | Flag             |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| `id`                      | `String @id cuid`                                         | `String @id cuid`                                      | both             |
| `sessionId`               | `String` → `AthleteThrowsSession`                         | `String` → `CoachThrowsSession`                        | FK target only   |
| `drillType`               | `String`                                                  | `String`                                               | both             |
| `implementWeight`         | `Float?`                                                  | `Float?`                                               | both             |
| `implementWeightUnit`     | `String @default("kg")`                                   | `String @default("kg")`                                | both             |
| `implementWeightOriginal` | `Float?`                                                  | `Float?`                                               | both             |
| `wireLength`              | `String?`                                                 | `String?`                                              | both             |
| `throwCount`              | `Int @default(0)`                                         | `Int @default(0)`                                      | both             |
| `bestMark`                | `Float?`                                                  | `Float?`                                               | both             |
| `bestMarkUnit`            | `String @default("meters")`                               | `String @default("meters")`                            | both             |
| `bestMarkOriginal`        | `Float?`                                                  | `Float?`                                               | both             |
| `notes`                   | `String?`                                                 | `String?`                                              | both             |
| `createdAt`               | `DateTime @default(now())`                                | `DateTime @default(now())`                             | both             |
| **Index**                 | `@@index([sessionId])`                                    | `@@index([sessionId])`                                 | equivalent       |

**Zero field diffs.** Unification is mechanical once Pair 3 lands.

**Prod usage back-fill slots** (from `section-4a`, `-4b`, `-4c`):

| Probe                                                                 | Value                           |
| --------------------------------------------------------------------- | ------------------------------- |
| Field-population parity both sides (weight, wire, bestMark, notes, throwCount stats) | TODO: awaiting user SQL run |
| Distinct `drillType` distribution per side                            | TODO: awaiting user SQL run     |
| Distinct `wireLength` distribution per side                           | TODO: awaiting user SQL run     |

## 4. Inbound FK map (who references these models)

Derived via `grep -nE "\b<Model>(\[|\?| )" prisma/schema.prisma`. The **only** references to these eight models from other models are parent back-refs — no third table holds a FK into any pair member:

| Model                  | Inbound FKs / back-refs                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `ThrowsPR`             | `AthleteProfile.throwsPRs: ThrowsPR[]`                                                 |
| `CoachPR`              | `CoachProfile.coachPRs: CoachPR[]`                                                     |
| `ThrowsTyping`         | `AthleteProfile.throwsTyping: ThrowsTyping?`                                           |
| `CoachTyping`          | `CoachProfile.coachTyping: CoachTyping?`                                               |
| `AthleteThrowsSession` | `AthleteProfile.selfLoggedSessions: AthleteThrowsSession[]`; `AthleteDrillLog.session` |
| `CoachThrowsSession`   | `CoachProfile.selfLoggedSessions: CoachThrowsSession[]`; `CoachDrillLog.session`       |
| `AthleteDrillLog`      | `AthleteThrowsSession.drillLogs: AthleteDrillLog[]`                                    |
| `CoachDrillLog`        | `CoachThrowsSession.drillLogs: CoachDrillLog[]`                                        |

**Consequence:** consolidation won't require rewriting FKs in any third table. Touch points outside the 8 models are the two parent profiles and the two session↔drillLog relations. Migration surface is tight.

**Prod back-fill slot** (from `section-5a-inbound-fk-counts.csv`, `section-5b-orphan-check.csv`):

| Probe                                                                 | Value                           |
| --------------------------------------------------------------------- | ------------------------------- |
| Inbound FK counts per back-ref relation                               | TODO: awaiting user SQL run     |
| Orphan-row count (DrillLog without parent session, PR without profile) | TODO: awaiting user SQL run    |

## 5. Existing indexes per model

| Model                    | Unique                                                | Secondary indexes                                |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| `ThrowsPR`               | `[athleteId, event, implement]`                       | —                                                |
| `ThrowsTyping`           | `athleteId` (single-column)                           | —                                                |
| `AthleteThrowsSession`   | —                                                     | `[athleteId, date]`, `[athleteId, event]`        |
| `AthleteDrillLog`        | —                                                     | `[sessionId]`                                    |
| `CoachPR`                | `[coachId, event, implement]`                         | `[coachId]`                                      |
| `CoachTyping`            | `coachId` (single-column)                             | —                                                |
| `CoachThrowsSession`     | —                                                     | `[coachId, date]`, `[coachId, event]`            |
| `CoachDrillLog`          | —                                                     | `[sessionId]`                                    |

Unified-table index plan is a PLAN concern, not a RESEARCH one. Noted here for reference only.

## 6. Coach-as-athlete overlap — back-fill slot

From `section-6a-dual-profile-count.csv` and `section-6b-dual-profile-active-count.csv`:

| Probe                                                                            | Value                           |
| -------------------------------------------------------------------------------- | ------------------------------- |
| Users with both CoachProfile and AthleteProfile                                  | TODO: awaiting user SQL run     |
| Users active on both sides (nonzero rows on ≥1 athlete-side AND ≥1 coach-side)   | TODO: awaiting user SQL run     |

Low count here = the feature serves few dual-role users, and PR 2 is mostly about removing technical debt. High count = consolidation also unlocks product capabilities.

## 7. Preliminary risk tiers (observation only)

Scoping hint for future PLAN — not a commitment. Low → high:

1. **Pair 4** (`AthleteDrillLog` / `CoachDrillLog`) — **LOW**. Identical schema. Moves with Pair 3.
2. **Pair 3** (`AthleteThrowsSession` / `CoachThrowsSession`) — **LOW-MEDIUM**. Nearly symmetric; one `event` type diff, one `loggedByCoach` semantic to absorb.
3. **Pair 1** (`ThrowsPR` / `CoachPR`) — **MEDIUM**. Type diffs on `event` and `achievedAt`; coach-only `sessionId`/`drillType` to preserve; missing `createdAt`/`updatedAt` on coach side.
4. **Pair 2** (`ThrowsTyping` / `CoachTyping`) — **HIGH**. Extensive naming asymmetry, coach-only *Label/*Conf fields, athlete-only tracking fields, date type diff. Fresh `BondarchukTyping` table likely cleaner than in-place merge.

## 8. Open questions for MODE: PLAN

These are noted for the PLAN session, not resolved here:

1. **Unified discriminator** — `userId` (FK to `User`) or role-specific `athleteId` / `coachId` alongside each other? Affects every consumer query.
2. **Table naming** — `ThrowsPR` / `ThrowsSession` keep the `Throws` prefix, or drop to `PR` / `Session`? The prefix will collide with future lifting-PR tables; decide before MODE: PLAN lands.
3. **Type-diff direction** — `event` String→enum, `achievedAt` String→DateTime: migration direction and backfill strategy.
4. **Prod-driven drops** — any *Label/*Conf/athlete-only field that the §3 back-fill shows as 100% null in prod is a candidate for removal rather than carry-over.

## 9. Scope guardrails — what this manifest does NOT contain

- **No MODE: PLAN output.** No step-by-step migration, no column-add/backfill/drop sequence, no rollback strategy.
- **No Prisma schema edits.** `prisma/schema.prisma` is untouched.
- **No migration files.** None created; `prisma migrate dev` was not run.
- **No callsite changes.** No `.ts` file consuming `prisma.coach{PR,Typing,ThrowsSession,DrillLog}` was read or modified.
- **No Bondarchuk engine changes.** PR 2 schema work MUST NOT alter engine logic — that's a separate concern.
- **No target unified schema.** That's a PLAN deliverable.

MODE: PLAN is frozen until PR 1 24h soak closes clean AND the user explicitly approves.
