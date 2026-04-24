# Schema Consolidation Manifest — PR 2 (MODE: RESEARCH)

**Generated:** 2026-04-24
**Mode:** RESEARCH per CLAUDE-standards.md §Development Mode Protocol — observe only. No MODE: PLAN; no code.
**Scope:** four coach-as-athlete Prisma model pairs flagged in the original consolidation brief.
**Gating:** this manifest is the input to PR 2 MODE: PLAN. MODE: PLAN does NOT start until the PR 1 24h soak window closes clean.

---

## 0. Why this matters

The four pairs below exist only because a coach can also be an athlete. Each pair duplicates fields and invariants: adding a feature costs twice, bugs hide in one side without the other, and the programming engine can't serve both surfaces from a single model. Consolidating to unified tables with a discriminator column (or a `userId` back-ref to `User` rather than role-specific profile IDs) lets every feature ship once.

## 1. The four pairs

| Athlete-side            | Coach-side            | Prisma lines (athlete / coach) |
| ----------------------- | --------------------- | ------------------------------ |
| `ThrowsPR`              | `CoachPR`             | 1643 / 2040                    |
| `ThrowsTyping`          | `CoachTyping`         | 1712 / 2057                    |
| `AthleteThrowsSession`  | `CoachThrowsSession`  | 1812 / 1866                    |
| `AthleteDrillLog`       | `CoachDrillLog`       | 1846 / 1896                    |

## 2. Row counts

### 2.1 Local-dev reference (fact, not prod)

Queried 2026-04-24 against `postgresql://anthonysommers@localhost:5432/podium_throws` — the seeded dev database. Useful for understanding the typical test-data shape; **NOT a substitute for prod counts.**

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

### 2.2 Prod row counts — BLOCKED

**Status:** blocker. Per user directive "query via the Supabase MCP, do not guess." My MCP session lists five Supabase projects under the visible org, including `podium-throws` at `db.mnsqqrmtqafhfstoqbeo.supabase.co`. Queries against that project time out — the project is marked INACTIVE and first-hit wake-ups take >30s; the MCP request window is shorter than that. Two additional blocks:

- `.env.vercel.local` reads are sandbox-denied (contains live creds).
- `list_tables` on the visible project was sandbox-denied as "beyond the specific row-count/field research described."

**What I need from the user before PR 2 MODE: PLAN:**

1. Confirm the correct prod project ID. The earlier pre-merge read of `.env.local` pointed at host `db.bfmswuxblbwomntvkwdw.supabase.co` — NOT one of the five projects the MCP currently lists. Is the prod DB under a different Supabase org, or has the project been renamed?
2. Either (a) wake the prod project so MCP queries succeed (log into Supabase dashboard, click any table, trigger compute activation), or (b) authorize me to run the specific queries in §2.3 below against an acknowledged project ID.
3. Sandbox permission for `list_tables` + `execute_sql` scoped to the 8 models in this manifest.

### 2.3 Prod queries to run once unblocked

Copy-paste ready. Each returns one row per model with count. Also includes the coach-only-field-usage probe each pair needs.

```sql
-- Simple row counts
SELECT 'ThrowsPR'              AS model, count(*) FROM "ThrowsPR"
UNION ALL SELECT 'CoachPR',              count(*) FROM "CoachPR"
UNION ALL SELECT 'ThrowsTyping',         count(*) FROM "ThrowsTyping"
UNION ALL SELECT 'CoachTyping',          count(*) FROM "CoachTyping"
UNION ALL SELECT 'AthleteThrowsSession', count(*) FROM "AthleteThrowsSession"
UNION ALL SELECT 'CoachThrowsSession',   count(*) FROM "CoachThrowsSession"
UNION ALL SELECT 'AthleteDrillLog',      count(*) FROM "AthleteDrillLog"
UNION ALL SELECT 'CoachDrillLog',        count(*) FROM "CoachDrillLog";

-- Pair 1: does CoachPR use any of its coach-only fields?
SELECT
  count(*) FILTER (WHERE "sessionId" IS NOT NULL) AS coach_with_session,
  count(*) FILTER (WHERE "drillType" IS NOT NULL) AS coach_with_drillType,
  count(*) FILTER (WHERE "source" IS DISTINCT FROM 'session') AS coach_with_nondefault_source
FROM "CoachPR";

-- Pair 1: does ThrowsPR use createdAt / updatedAt fields coach-side lacks?
-- (CoachPR has no createdAt/updatedAt — we need to add them on consolidation.)
-- No query needed; we'll add them unconditionally.

-- Pair 2: CoachTyping confidence + label fields the athlete side lacks
SELECT
  count(*) FILTER (WHERE "adaptationLabel"     IS NOT NULL) AS with_adaptLabel,
  count(*) FILTER (WHERE "adaptationConf"      IS NOT NULL) AS with_adaptConf,
  count(*) FILTER (WHERE "transferLabel"       IS NOT NULL) AS with_transferLabel,
  count(*) FILTER (WHERE "transferConf"        IS NOT NULL) AS with_transferConf,
  count(*) FILTER (WHERE "selfFeelingLabel"    IS NOT NULL) AS with_sfLabel,
  count(*) FILTER (WHERE "selfFeelingConf"     IS NOT NULL) AS with_sfConf,
  count(*) FILTER (WHERE "lightImplLabel"      IS NOT NULL) AS with_lightLabel,
  count(*) FILTER (WHERE "lightImplConf"       IS NOT NULL) AS with_lightConf,
  count(*) FILTER (WHERE "recoveryLabel"       IS NOT NULL) AS with_recoveryLabel,
  count(*) FILTER (WHERE "recoveryConf"        IS NOT NULL) AS with_recoveryConf,
  count(*) FILTER (WHERE "methodReason"        IS NOT NULL) AS with_methodReason
FROM "CoachTyping";

-- Pair 2: ThrowsTyping athlete-only fields coach-side lacks
SELECT
  count(*) FILTER (WHERE "typingSource"         <> 'QUIZ')  AS with_nonquiz_source,
  count(*) FILTER (WHERE "quizAssignedByCoach"  = true)     AS with_coach_assigned,
  count(*) FILTER (WHERE "complexesAnalyzed"    > 0)        AS with_complexes,
  count(*) FILTER (WHERE "totalSessionsTracked" > 0)        AS with_sessions_tracked
FROM "ThrowsTyping";

-- Pair 3: AthleteThrowsSession.loggedByCoach usage
SELECT count(*) FILTER (WHERE "loggedByCoach" = true) AS logged_by_coach_count
FROM "AthleteThrowsSession";

-- Pair 4: no coach-only fields — identical schema modulo the session-FK target
-- (confirmed in §3.4 below).
```

## 3. Field-by-field diffs

### 3.1 Pair 1 — `ThrowsPR` ↔ `CoachPR`

Canonical-target suggestion: **`ThrowsPR`** as the unified table (longer history, more inbound Links, established index). Add coach-only columns as nullable. Migrate `CoachPR` rows in; swap `CoachProfile.coachPRs → ThrowsPR[]` relation.

| Field                         | ThrowsPR                                           | CoachPR                                              | Flag             |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------- | ---------------- |
| `id`                          | `String @id @default(cuid())`                      | `String @id @default(cuid())`                        | both             |
| discriminator                 | `athleteId String` → `AthleteProfile`              | `coachId String` → `CoachProfile`                    | discriminator    |
| `event`                       | `String` (plain text, e.g. `"SHOT_PUT"`)           | `EventType` enum                                     | **type diff**    |
| `implement`                   | `String`                                           | `String`                                             | both             |
| `distance`                    | `Float`                                            | `Float`                                              | both             |
| `achievedAt`                  | `String` (YYYY-MM-DD)                              | `DateTime @default(now())`                           | **type diff**    |
| `source`                      | `String?` (`"TRAINING" \| "COMPETITION"`)          | `String? @default("session")`                        | both; defaults differ |
| `sessionId`                   | —                                                  | `String?`                                            | **coach-only**   |
| `drillType`                   | —                                                  | `String?`                                            | **coach-only**   |
| `createdAt`                   | `DateTime @default(now())`                         | —                                                    | **athlete-only** |
| `updatedAt`                   | `DateTime @updatedAt`                              | —                                                    | **athlete-only** |
| **Unique**                    | `@@unique([athleteId, event, implement])`          | `@@unique([coachId, event, implement])`              | equivalent shape |
| **Index**                     | —                                                  | `@@index([coachId])`                                 | coach-only       |

Coach-only columns that must survive as nullable: `sessionId`, `drillType`. Needs prod check to decide if either can simply be dropped (§2.3 query `Pair 1`).

Reconciliation calls for MODE: PLAN:
- **`event`:** promote both sides to the `EventType` enum. Athletes currently store plain text; migration rewrites four strings → enum values in place. Low risk.
- **`achievedAt`:** standardize on `DateTime`. ThrowsPR's string format (YYYY-MM-DD) loses time-of-day info but gains portability. Either normalize with `to_date(achievedAt, 'YYYY-MM-DD')` or keep as `String` to avoid churn. Recommend `DateTime` for consistency with the rest of the schema.
- Add `createdAt` / `updatedAt` to the unified table; backfill with a sane default (e.g., `achievedAt` → `createdAt`) for migrated CoachPR rows.

### 3.2 Pair 2 — `ThrowsTyping` ↔ `CoachTyping`

Canonical-target suggestion: a **new unified `BondarchukTyping`** table. Both sides have extensive asymmetry here — naming conflicts (`quizAdaptationSpeed` vs `adaptationSpeedResponses`), storage type diffs (`String` vs `String @db.Text`), and role-specific computed fields on both sides. A rename-in-place merge is messier than a clean new table.

| Field (proposed unified name)    | ThrowsTyping                                          | CoachTyping                                            | Flag             |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| `id`                             | `String @id cuid`                                     | `String @id cuid`                                      | both             |
| discriminator (`userId`)         | `athleteId String @unique` → AthleteProfile          | `coachId String @unique` → CoachProfile                | discriminator    |
| `adaptationSpeedResponses`       | `quizAdaptationSpeed String?`                        | `adaptationSpeedResponses String? @db.Text`           | rename + promote to Text |
| `transferTypeResponses`          | `quizTransferType String?`                           | `transferTypeResponses String? @db.Text`              | rename + Text    |
| `selfFeelingResponses`           | `quizSelfFeeling String?`                            | `selfFeelingResponses String? @db.Text`               | rename + Text    |
| `lightImplResponses`             | `quizLightImpl String?`                              | `lightImplResponses String? @db.Text`                 | rename + Text    |
| `recoveryResponses`              | `quizRecovery String?`                               | `recoveryResponses String? @db.Text`                  | rename + Text    |
| `adaptationGroup`                | `Int?`                                               | `Int?`                                                 | both             |
| `adaptationLabel`                | —                                                    | `String?`                                              | **coach-only**   |
| `adaptationConf`                 | `confidenceAdaptation Int @default(0)`               | `adaptationConf Int?`                                  | rename + null vs default(0) |
| `transferType`                   | `String?`                                            | `String?`                                              | both             |
| `transferLabel`                  | —                                                    | `String?`                                              | **coach-only**   |
| `transferConf`                   | `confidenceTransfer Int @default(0)`                 | `transferConf Int?`                                    | rename + null vs default(0) |
| `selfFeelingAccuracy`            | `String?`                                            | `String?`                                              | both             |
| `selfFeelingLabel`               | —                                                    | `String?`                                              | **coach-only**   |
| `selfFeelingConf`                | `confidenceSelfFeeling Int @default(0)`              | `selfFeelingConf Int?`                                 | rename + null vs default(0) |
| `lightImplResponse`              | `String?`                                            | `String?`                                              | both             |
| `lightImplLabel`                 | —                                                    | `String?`                                              | **coach-only**   |
| `lightImplConf`                  | —                                                    | `Int?`                                                 | **coach-only**   |
| `recoveryProfile`                | `String?`                                            | `String?`                                              | both             |
| `recoveryLabel`                  | —                                                    | `String?`                                              | **coach-only**   |
| `recoveryConf`                   | —                                                    | `Int?`                                                 | **coach-only**   |
| `recommendedMethod`              | `String?`                                            | `String?`                                              | both             |
| `methodReason`                   | —                                                    | `String? @db.Text`                                     | **coach-only**   |
| `complexDuration`                | `optimalComplexDuration String?`                     | `complexDuration String?`                              | rename           |
| `sessionsToForm`                 | `estimatedSessionsToForm Int?`                       | `sessionsToForm Int?`                                  | rename           |
| `complexesAnalyzed`              | `Int @default(0)`                                    | —                                                      | **athlete-only** |
| `totalSessionsTracked`           | `Int @default(0)`                                    | —                                                      | **athlete-only** |
| `quizCompletedDate`              | `String?`                                            | `completedAt DateTime @default(now())`                 | **type diff**    |
| `lastRefinedDate`                | `String?`                                            | `updatedAt DateTime @updatedAt`                        | **type diff**    |
| `typingSource`                   | `String @default("QUIZ")`                            | —                                                      | **athlete-only** |
| `quizAssignedByCoach`            | `Boolean @default(false)`                            | —                                                      | **athlete-only** |
| `quizAssignedDate`               | `String?`                                            | —                                                      | **athlete-only** |
| `createdAt`                      | `DateTime @default(now())`                           | —                                                      | **athlete-only** |
| `updatedAt`                      | `DateTime @updatedAt`                                | `updatedAt DateTime @updatedAt`                        | both             |

Reconciliation calls:
- **Rename pairs** (`quiz*` vs `*Responses`, `confidence*` vs `*Conf`, `optimalComplexDuration` vs `complexDuration`, `estimatedSessionsToForm` vs `sessionsToForm`) — pick one canonical name. The coach side's naming (`*Responses`, `*Conf`, `complexDuration`, `sessionsToForm`) is shorter; the athlete side's `quiz*` prefix documents intent. Recommend **coach-side naming** — shorter and avoids implying all responses came from a quiz (athletes' `typingSource` already distinguishes `QUIZ` vs `COACH`).
- **Nullable vs default(0)** on the `*Conf` fields — unify as nullable (`Int?`). `default(0)` plus nullable is logically ambiguous.
- **Storage type** (`String` vs `String @db.Text`) — promote all JSON-response columns to `@db.Text`. Postgres treats them the same; this makes the intent explicit.
- **Coach-only *Label columns** — all need to survive as nullable. Run §2.3 "Pair 2" query first to confirm nonzero usage; if truly empty in prod, consider dropping.
- **Date string vs DateTime** — move to `DateTime` everywhere. Prod backfill: `to_timestamp("quizCompletedDate", 'YYYY-MM-DD')`.

### 3.3 Pair 3 — `AthleteThrowsSession` ↔ `CoachThrowsSession`

Canonical-target suggestion: **`ThrowsSession`** (drop both role prefixes; discriminator is `userId`). Pair is nearly symmetric — this is the easy one.

| Field                | Athlete                                      | Coach                                        | Flag             |
| -------------------- | -------------------------------------------- | -------------------------------------------- | ---------------- |
| `id`                 | `String @id cuid`                            | `String @id cuid`                            | both             |
| discriminator        | `athleteId String` → `AthleteProfile`        | `coachId String` → `CoachProfile`            | discriminator    |
| `event`              | `String` (plain text)                        | `EventType` enum                             | **type diff**    |
| `date`               | `String` (YYYY-MM-DD)                        | `String` (YYYY-MM-DD)                        | both             |
| `focus`              | `String?`                                    | `String?`                                    | both             |
| `notes`              | `String?`                                    | `String?`                                    | both             |
| `sleepQuality`       | `Int?`                                       | `Int?`                                       | both             |
| `sorenessLevel`      | `Int?`                                       | `Int?`                                       | both             |
| `energyLevel`        | `Int?`                                       | `Int?`                                       | both             |
| `sessionRpe`         | `Int?`                                       | `Int?`                                       | both             |
| `sessionFeeling`     | `String?`                                    | `String?`                                    | both             |
| `techniqueRating`    | `Int?`                                       | `Int?`                                       | both             |
| `mentalFocus`        | `Int?`                                       | `Int?`                                       | both             |
| `bestPart`           | `String?`                                    | `String?`                                    | both             |
| `improvementArea`    | `String?`                                    | `String?`                                    | both             |
| `loggedByCoach`      | `Boolean @default(false)`                    | —                                            | **athlete-only** |
| `createdAt`          | `DateTime @default(now())`                   | `DateTime @default(now())`                   | both             |
| `updatedAt`          | `DateTime @updatedAt`                        | `DateTime @updatedAt`                        | both             |
| **Index**            | `@@index([athleteId, date])`, `@@index([athleteId, event])` | `@@index([coachId, date])`, `@@index([coachId, event])` | equivalent shape |

Reconciliation calls:
- **`event`:** same call as Pair 1 — promote to `EventType`. Migration rewrites four text values in place.
- **`loggedByCoach`:** drop the flag on the unified table; the discriminator (is the row owned by an athlete or a coach?) replaces it. Athlete rows where `loggedByCoach = true` become "athlete record where the session was entered by someone else" — that's a `enteredByUserId` column in the unified model, separate from the `userId` that owns it. §2.3 Pair 3 query measures how many rows this affects.

### 3.4 Pair 4 — `AthleteDrillLog` ↔ `CoachDrillLog`

Canonical-target suggestion: **`DrillLog`** (drop both role prefixes). Pair is identical modulo the session-FK target; unifying the session tables auto-unifies this.

| Field                        | Athlete                                                   | Coach                                                  | Flag             |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| `id`                         | `String @id cuid`                                         | `String @id cuid`                                      | both             |
| `sessionId`                  | `String` → `AthleteThrowsSession`                         | `String` → `CoachThrowsSession`                        | FK target (resolves via Pair 3 unification) |
| `drillType`                  | `String`                                                  | `String`                                               | both             |
| `implementWeight`            | `Float?`                                                  | `Float?`                                               | both             |
| `implementWeightUnit`        | `String @default("kg")`                                   | `String @default("kg")`                                | both             |
| `implementWeightOriginal`    | `Float?`                                                  | `Float?`                                               | both             |
| `wireLength`                 | `String?`                                                 | `String?`                                              | both             |
| `throwCount`                 | `Int @default(0)`                                         | `Int @default(0)`                                      | both             |
| `bestMark`                   | `Float?`                                                  | `Float?`                                               | both             |
| `bestMarkUnit`               | `String @default("meters")`                               | `String @default("meters")`                            | both             |
| `bestMarkOriginal`           | `Float?`                                                  | `Float?`                                               | both             |
| `notes`                      | `String?`                                                 | `String?`                                              | both             |
| `createdAt`                  | `DateTime @default(now())`                                | `DateTime @default(now())`                             | both             |
| **Index**                    | `@@index([sessionId])`                                    | `@@index([sessionId])`                                 | equivalent       |

Reconciliation call: **zero field diffs.** Unification is mechanical once Pair 3 is done.

## 4. Inbound FK map (who references these models)

Confirmed via `grep -nE "\\b<Model>(\\[|\\?| )" prisma/schema.prisma`. The **only** references to these eight models from other models are parent back-refs — no third table holds a FK into any of the pair members:

| Model                  | Inbound FKs / back-refs                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `ThrowsPR`             | `AthleteProfile.throwsPRs: ThrowsPR[]`                                              |
| `CoachPR`              | `CoachProfile.coachPRs: CoachPR[]`                                                  |
| `ThrowsTyping`         | `AthleteProfile.throwsTyping: ThrowsTyping?`                                        |
| `CoachTyping`          | `CoachProfile.coachTyping: CoachTyping?`                                            |
| `AthleteThrowsSession` | `AthleteProfile.selfLoggedSessions: AthleteThrowsSession[]`; `AthleteDrillLog.session` |
| `CoachThrowsSession`   | `CoachProfile.selfLoggedSessions: CoachThrowsSession[]`; `CoachDrillLog.session`   |
| `AthleteDrillLog`      | `AthleteThrowsSession.drillLogs: AthleteDrillLog[]`                                 |
| `CoachDrillLog`        | `CoachThrowsSession.drillLogs: CoachDrillLog[]`                                     |

**Consequence:** consolidation won't require rewriting FKs in any third table. The only touch points outside the 8 models are the two parent profiles and the two session↔drillLog relations. Migration surface is tight.

## 5. Existing indexes per model

| Model                    | Unique                                                | Secondary indexes                                |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| `ThrowsPR`               | `[athleteId, event, implement]`                       | —                                                |
| `ThrowsDrillPR`          | `[athleteId, event, drillType, implement]`            | —                                                |
| `ThrowsTyping`           | `athleteId` (single-column)                           | —                                                |
| `AthleteThrowsSession`   | —                                                     | `[athleteId, date]`, `[athleteId, event]`        |
| `AthleteDrillLog`        | —                                                     | `[sessionId]`                                    |
| `CoachPR`                | `[coachId, event, implement]`                         | `[coachId]`                                      |
| `CoachTyping`            | `coachId` (single-column)                             | —                                                |
| `CoachThrowsSession`     | —                                                     | `[coachId, date]`, `[coachId, event]`            |
| `CoachDrillLog`          | —                                                     | `[sessionId]`                                    |

Unified-table index plan (preliminary):

- `ThrowsPR` → keep `@@unique([userId, event, implement])` (rename `athleteId/coachId` to `userId`). Add `@@index([userId])` for non-unique access — that's what `CoachPR` had separately; covering it under the unique is cheaper.
- `BondarchukTyping` → `@@unique([userId])` as a single-column unique.
- `ThrowsSession` → `@@index([userId, date])`, `@@index([userId, event])`. Drop role-prefix on both.
- `DrillLog` → `@@index([sessionId])`.

## 6. Consolidation risk tiers (informing MODE: PLAN)

Order of difficulty / risk, low → high. Not a plan, just scoping for later.

1. **Pair 4** (`AthleteDrillLog` / `CoachDrillLog`) — **LOW**. Identical schema. Moves with Pair 3.
2. **Pair 3** (`AthleteThrowsSession` / `CoachThrowsSession`) — **LOW-MEDIUM**. Nearly symmetric; one `event` type diff, one `loggedByCoach` semantic (resolved via `enteredByUserId`).
3. **Pair 1** (`ThrowsPR` / `CoachPR`) — **MEDIUM**. Type diffs on `event` and `achievedAt`; coach-only `sessionId`/`drillType` fields to preserve.
4. **Pair 2** (`ThrowsTyping` / `CoachTyping`) — **HIGH**. Extensive naming asymmetry, coach-only *Label fields, athlete-only tracking fields, date type diffs. Recommend a fresh `BondarchukTyping` table rather than in-place merge.

## 7. Open questions — answer before MODE: PLAN

1. **Prod access** — see §2.2. Project ID + wake + query authorization.
2. **Unified discriminator** — `userId` (FK to `User`) or keep `athleteId` / `coachId` alongside each other? `userId` is cleaner; athlete/coach discrimination happens via `User.role`. Impact: every consumer query shifts from `where: { athleteId: X }` to `where: { user: { role: 'ATHLETE' }, userId: X }` or equivalent.
3. **Naming** — `ThrowsPR` stays, or rename to `PR` / `PersonalRecord`? Same for `ThrowsSession` vs `Session`. The "Throws" prefix will collide with future lifting-PR tables; decide now to avoid another rename later.
4. **Backfill strategy for type diffs** — `event` string→enum is easy; `achievedAt`/`date` string→DateTime needs a choice on time-of-day (midnight UTC? the coach's timezone?).
5. **MODE: PLAN gating** — user instruction: PR 2 MODE: PLAN starts only after PR 1 24h soak closes clean. Do not PREEMPT with a plan even if soak is clearly going well. Wait for the 24h summary + explicit approval.

## 8. What this manifest does NOT contain

- **No MODE: PLAN output.** No step-by-step migration, no column-add/backfill/column-drop sequence, no rollback strategy. That's next.
- **No Prisma schema edits.** The `prisma/schema.prisma` file is untouched.
- **No migration files.** None created; `prisma migrate dev` was not run.
- **No Bondarchuk engine changes.** PR 2 schema work must NOT alter engine logic — that's PR 3 territory if it happens.
