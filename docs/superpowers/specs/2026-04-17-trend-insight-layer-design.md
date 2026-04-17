# Trend Insight Layer — Design

**Status:** Draft · awaiting user review
**Date:** 2026-04-17
**Sub-project:** B of a three-part initiative (A shipped 2026-04-17)

## Context

Second sub-project of the competition + trend-analysis initiative:

- **A. Competition Logging v2** — *shipped* 2026-04-17; structured per-throw meet logging
- **B. Trend Insight Layer** *(this spec)* — post-hoc analysis layer that produces durable, human-readable insights from existing engine signals plus two new cross-domain correlations
- **C. Insight Delivery + Permissions** *(future spec)* — coach-gated detail, notifications, UI surfaces
- **D. Expanded Data Collection** *(optional, deferred)*

## The re-framing

The initial pitch was "build a trend analysis engine from scratch." Exploration revealed the Bondarchuk programming engine already contains substantial analytical machinery:

| Existing capability | File |
|---|---|
| Volume IV population correlations (750 coefficients, `event × gender × exercise × distance band`) | `src/lib/throws/correlations.ts` |
| Personal correlations (per-athlete Pearson of exercise usage × performance delta, blended with population over 5→30 data-point ramp) | `src/lib/throws/engine/personal-correlations.ts` |
| Feedback loop (logarithmic growth fit, complex-effectiveness scoring, deficit attribution, volume adjustment) | `src/lib/throws/engine/feedback-loop.ts` |
| Adaptation decision tree (readiness + mark trend + soreness → recommendations) | `src/lib/throws/engine/adaptation-checker.ts` |
| Autoregulation triggers (program-to-program, block-to-block) | `src/lib/throws/autoregulation/*` |

The gap is not raw analytics — it is a surfacing layer. The existing engine consumes its output internally to prescribe training; it never produces human-readable insights, never persists them, and never runs in response to post-competition events.

## Goal

A net-new `src/lib/insights/` module that runs three analyzers over an athlete's data, persists the results as immutable `AthleteInsight` rows via rule-based templates, fires automatically on meet-complete through Next.js `after()`, and exposes an on-demand recompute endpoint.

## Non-goals

- UI surfaces for insights *(sub-project C)*
- Coach-gating of athlete detail *(sub-project C)*
- Notification routing for new insights *(sub-project C)*
- Weekly digest / scheduled cron *(sub-project C)*
- LLM-generated prose (templates only)
- Read / dismissed mutation endpoints (schema has the columns; endpoints go in C)
- A fourth insight category (volume plateau, overreaching, PR-trajectory forecast)
- Cross-athlete comparisons (roster benchmarks)
- Changes to `personal-correlations.ts` or any existing `throws/engine/` file
- New wearable integration work (we consume what's already in `ReadinessCheckIn`)

## Decisions made during brainstorming

| Decision | Chosen option | Why |
|---|---|---|
| MVP scope | Minimum layer + two cross-domain correlations (lift↔throw, readiness↔comp) | Thin wrapper feels like nothing; everything-everywhere is too much for one spec |
| Trigger model | Post-competition (`after()` on meet-complete) + on-demand endpoint | Captures the emotionally-relevant "just after the meet" moment; on-demand covers athletes with no recent meets |
| Three MVP insight types | training-pattern (wraps existing engine), lift↔throw (new), readiness↔comp (new) | One that surfaces existing signal, two that fill real gaps |
| Lift-correlation basis | 1RM and 3RM over time, take the stronger correlation | User preference — rep-max series over weekly-max |
| Readiness factors | All of sleepQuality, sleepHours, soreness, stress, energyMood, HRV, restingHR, strain | More data = more signal; per-factor skip handles missing data |
| Storage model | Append-only history; reader groups by `(athleteId, category, metric)` for latest-per-slot | Coaching tool benefits from historical continuity; dedup belongs at read time |
| Minimum data thresholds | 5 weeks (training-pattern), 6 paired windows (lift↔throw), 4 competitions (readiness↔comp) | Floor prevents noisy MVP insights; engine stays silent when data is thin |
| Confidence UX | Three-band label + data-point count inline; raw coefficient stored for future UI | Coaches aren't statisticians; "Medium (8 weeks)" beats "r = 0.68" |
| Trigger granularity | Meet-complete detection, fires once per meet | One compute per meet event vs 6 per throw |
| Execution model | Next.js `after()` from per-throw POST | Guaranteed completion on Fluid Compute; doesn't block the throw save |
| Text generation | Rule-based templates, snapshot-tested | Deterministic, testable, zero external dependency; LLM is a later polish layer |
| Engine architecture | Per-analyzer module + central orchestrator | Mirrors existing `throws/engine/` file-per-gap structure; adding Type 4 later is one new file |

---

## Architecture Overview

### Where it sits in the codebase

```
existing: src/lib/throws/engine/          ← program generator (consumes correlations internally)
          src/lib/throws/correlations.ts  ← Volume IV population data (reused by insights)
          src/lib/throws/autoregulation/  ← mid-program adjustments (separate concern)

NEW:      src/lib/insights/               ← post-hoc trend layer (this spec)
          prisma.athleteInsight           ← append-only history
          api/insights/**                 ← on-demand endpoint
          api/throws/competitions/[id]/throws  ← calls after(runInsights(...)) when meet-complete
```

### Key boundaries

- **Insight engine reads; never mutates training data.** It writes only to `AthleteInsight`. Never touches `AthleteProfile`, `ThrowLog`, `ThrowsCompetition`, or existing engine state.
- **Analyzers are pure given their inputs.** `analyze(athleteId) → StructuredInsight[]` — DB reads only, no external calls. Mocked-prisma testable.
- **Templates never re-fetch data.** Input is `StructuredInsight`; output is `{ title, body, detail }`. If we ever swap to LLM, only this layer changes.
- **The existing programming engine is untouched.** `personal-correlations.ts` is called with data shaped by the training-pattern analyzer; the engine file itself is not modified.

### Key invariants

- Each `AthleteInsight` row is immutable after create. "Updating" means writing a new row.
- Running the engine twice with the same inputs produces identical insight data (idempotent at the analyzer level). Concurrent runs may both write; latest-per-slot at read time resolves this.
- An insight is persisted only if an analyzer produced output above its threshold. No empty-state rows.
- The insight layer is allowed to be silent — athletes with thin data get no insights. That is expected behavior.

---

## Data Model

### New Prisma model

```prisma
model AthleteInsight {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  category  InsightCategory     // TRAINING_PATTERN | LIFT_THROW | READINESS_COMPETITION
  metric    String              // e.g. "exerciseUsage.shot_put.8kg_shot", "squat_1rm.hammer"
  event     EventType?          // nullable when event-agnostic

  title     String
  body      String
  detail    String?

  confidenceBand  ConfidenceBand    // WEAK | MEDIUM | STRONG
  dataPoints      Int
  coefficient     Float?            // Pearson r or regression slope
  effectSize      Float?
  effectUnit      String?

  evidence  Json                // category-specific payload, Zod-validated at write time

  readByCoachAt    DateTime?
  readByAthleteAt  DateTime?
  dismissedAt      DateTime?

  triggerKind      InsightTrigger   // MEET_COMPLETE | ON_DEMAND | CRON (reserved)
  triggerMeetId    String?          // FK-less pointer
  computedAt       DateTime         @default(now())

  @@index([athleteId, category, computedAt])
  @@index([athleteId, computedAt])
}

enum InsightCategory {
  TRAINING_PATTERN
  LIFT_THROW
  READINESS_COMPETITION
}

enum ConfidenceBand {
  WEAK
  MEDIUM
  STRONG
}

enum InsightTrigger {
  MEET_COMPLETE
  ON_DEMAND
  CRON
}
```

### Why this shape

- `metric` is a stable string key for grouping across runs. Free-form (not enum) because Type 2 needs per-lift-per-event keys (`squat_1rm.hammer`, `clean_1rm.hammer`, etc.) and enumerating them creates migration pressure.
- `coefficient` / `effectSize` / `effectUnit` separate raw numbers from human phrases. Cards show `title` / `body`; future "show me the math" views consume the numeric trio.
- `evidence` is structured JSON, one shape per category, Zod-validated at write time inside each analyzer.
- `readByCoachAt` and `readByAthleteAt` are distinct — coach read doesn't mark it read for the athlete. Mutation endpoints are out of scope here; columns exist so sub-project C doesn't need a migration.
- `triggerKind = CRON` is reserved enum value for sub-project C.
- The two indexes cover "list by category" and "list chronologically."

### What's NOT in the schema

- No `parentInsightId` / `supersededBy` — latest-per-slot grouping is derivable at query time via `(athleteId, category, metric)` + `max(computedAt)`.
- No `expiresAt` — insights don't expire; UI decides relevance.
- No text-search column — per-athlete low volume (10-30 per season); sequential scan is fine.

### TypeScript contracts (`src/lib/insights/types.ts`)

```ts
export type ConfidenceBand = "WEAK" | "MEDIUM" | "STRONG";
export type InsightCategory = "TRAINING_PATTERN" | "LIFT_THROW" | "READINESS_COMPETITION";

export type StructuredInsight<TEvidence = unknown> = {
  category: InsightCategory;
  metric: string;
  event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN" | null;
  confidenceBand: ConfidenceBand;
  dataPoints: number;
  coefficient: number | null;
  effectSize: number | null;
  effectUnit: string | null;
  evidence: TEvidence;
  renderInputs: Record<string, string | number>;
};

export interface Analyzer<TEvidence = unknown> {
  category: InsightCategory;
  analyze(athleteId: string): Promise<StructuredInsight<TEvidence>[]>;
}

export type RenderedInsight = StructuredInsight & {
  title: string;
  body: string;
  detail: string | null;
};
```

Analyzers return arrays because a single category can produce multiple insights (one per event, or one per lift × event pair).

---

## The Three Analyzers

All live under `src/lib/insights/analyzers/`. Each is a single file, pure given DB reads, independently testable.

### `trainingPattern.ts` — wraps existing engine

**Computes:** per event, the top 1-2 exercises most correlated with competition results.

**Inputs:** `AthleteThrowsSession` + `AthleteDrillLog` rows (practice history), `ThrowLog` rows with `isCompetition=true` at competition weight.

**Algorithm:**
1. Per event, build `SessionExerciseRecord[]` (existing engine's input shape)
2. Fetch population correlations for `(event, gender)` from `correlations.ts`
3. Call `computePersonalCorrelations(sessionHistory, populationCorrelations)` unchanged
4. Filter to exercises where blended `|r| >= 0.4` AND personal data points `>= 5`
5. Take top 2 positive correlations per event
6. Emit one `StructuredInsight` per `(event, exercise)` pair

**Confidence bands:** 5-10 weak / 10-20 medium / 20+ strong.

**Evidence payload:**
```ts
type TrainingPatternEvidence = {
  sessionIds: string[];     // up to 10 most recent
  event: string;
  exercise: string;
  personalR: number;
  populationR: number;
  blendedR: number;
  personalWeight: number;   // 0..1
};
```

**Skip:** no practice sessions OR zero exercises clear the floor → `[]`.

### `liftThrowCorrelation.ts` — NEW

**Computes:** per tracked lift × event pair, whether rep-max progression correlates with best-throw progression.

**Inputs:** `LiftingExerciseLog` rows (5 tracked lifts: back squat, front squat, power clean, snatch, bench press); `ThrowLog` at competition weight.

**Algorithm:**
1. Per lift: walk logs chronologically, maintain rolling estimated **1RM** and **3RM** via Epley (`weight × (1 + reps/30)` for sets at `reps ≤ 10`; ignore higher-rep sets for max estimation; back-solve Epley for 3RM)
2. Bucket to **4-week windows** — max 1RM and max 3RM per window
3. Per event: bucket competition-weight `ThrowLog` rows to same 4-week windows; max best-throw per window
4. Pair observations where both lift max and throw max exist
5. Run Pearson on `(1RM, bestMark)` and `(3RM, bestMark)` separately; keep whichever correlation is stronger
6. Compute regression slope (meters per kg of the chosen rep-max)
7. Emit only when `|r| >= 0.4` AND paired count `>= 6`

**Confidence bands:** 6-9 weak / 10-14 medium / 15+ strong.

**Evidence payload:**
```ts
type LiftThrowEvidence = {
  lift: string;
  event: string;
  repMaxBasis: "1RM" | "3RM";
  pairs: Array<{ windowStart: string; repMaxKg: number; bestMarkM: number }>;  // up to 15 most recent
  pearsonR: number;
  regressionSlope: number;                 // meters per kg
};
```

**Skip:** <6 paired windows, no lifts logged at all, or `|r| < 0.4` per pair.

### `readinessCompetition.ts` — NEW

**Computes:** per readiness factor × event, whether poor readiness in the 3 days before a meet correlates with worse competition results.

**Inputs:** every `ThrowsCompetition` with `meetStatus = COMPLETED` and ≥1 non-foul throw; `ReadinessCheckIn` rows in the 3-day window preceding each meet's `date`; `ThrowsCheckIn` as fallback for factors `ReadinessCheckIn` doesn't carry.

**Factors correlated:** `sleepQuality`, `sleepHours`, `soreness` (inverted), `stressLevel` (inverted), `energyMood`, `hrvMs`, `restingHR` (inverted), `whoopStrain`. Missing factors silently skipped at per-factor level.

**Algorithm:**
1. Per meet: compute `bestMark` (max non-foul throw at competition weight) and `bestMarkDeltaFromPR = bestMark − competitionPR`
2. Compute 3-day pre-meet average per factor (skip meets where <2 of 3 days have check-ins)
3. Per factor: pair `(pre-meet avg, bestMarkDeltaFromPR)` across all meets; skip factor if <4 paired meets
4. Run Pearson; compute below-median vs above-median mean delta (group comparison is the surfaced `effectSize`)
5. Emit per factor where `|r| >= 0.4` AND paired count `>= 4`

**Confidence bands:** 4-5 weak / 6-8 medium / 9+ strong.

**Effect size surface:** below-median-minus-above-median mean bestMarkDelta (meters). E.g., -1.2m means meets with below-median sleep quality are 1.2m worse on average than above-median ones.

**Evidence payload:**
```ts
type ReadinessCompetitionEvidence = {
  factor: string;
  event: string;
  pairs: Array<{ competitionId: string; preAvg: number; bestMarkDeltaM: number }>;
  pearsonR: number;
  belowMedianMeanDelta: number;
  aboveMedianMeanDelta: number;
};
```

**Analyzer-wide skip:** <4 completed meets total, or no readiness check-ins at all. Per-factor skip otherwise.

---

## Templates

Lives in `src/lib/insights/templates/`. Deterministic, snapshot-testable, minimal prose. One file per category + `shared.ts` for label maps and helpers.

### `trainingPattern.ts`

```ts
export function render(insight: StructuredInsight<TrainingPatternEvidence>) {
  const eventLabel = EVENT_LABEL[insight.event ?? ""];
  const exerciseLabel = formatExerciseLabel(insight.renderInputs.exercise as string);

  const title =
    insight.renderInputs.direction === "positive"
      ? `Your best ${eventLabel.toLowerCase()} throws follow ${exerciseLabel} weeks`
      : `Your ${eventLabel.toLowerCase()} throws dip during ${exerciseLabel} weeks`;

  const body =
    insight.renderInputs.direction === "positive"
      ? `Weeks with more ${exerciseLabel} sessions tend to produce your stronger throws at competition weight.`
      : `Weeks heavy on ${exerciseLabel} tend to precede your weaker sessions at competition weight.`;

  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} weeks of data.`;

  return { title, body, detail };
}
```

### `liftThrowCorrelation.ts`

```ts
export function render(insight: StructuredInsight<LiftThrowEvidence>) {
  const eventLabel = EVENT_LABEL[insight.event ?? ""];
  const liftLabel = LIFT_LABEL[insight.renderInputs.lift as string];
  const basis = insight.renderInputs.repMaxBasis as "1RM" | "3RM";
  const kgPer05m = effectSize(0.5, insight.effectSize ?? 0);

  const title = `${liftLabel} ${basis} tracks with ${eventLabel.toLowerCase()} distance`;

  const body = `Your ${liftLabel.toLowerCase()} ${basis} and ${eventLabel.toLowerCase()} best-mark have moved together over the last months.`;

  const detail =
    `Roughly every ${kgPer05m}kg of ${basis} has tracked with ~0.5m of ${eventLabel.toLowerCase()} distance. ` +
    `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} paired windows.`;

  return { title, body, detail };
}
```

### `readinessCompetition.ts`

```ts
export function render(insight: StructuredInsight<ReadinessCompetitionEvidence>) {
  const eventLabel = EVENT_LABEL[insight.event ?? ""];
  const factorLabel = FACTOR_LABEL[insight.renderInputs.factor as string];
  const threshold = insight.renderInputs.thresholdLabel as string;
  const meters = Math.abs(insight.effectSize ?? 0).toFixed(1);

  const title = `${factorLabel} affects your ${eventLabel.toLowerCase()} meets`;

  const body =
    insight.renderInputs.direction === "negative"
      ? `Your ${eventLabel.toLowerCase()} meets go roughly ${meters}m worse when ${factorLabel.toLowerCase()} is ${threshold} in the 3 days before.`
      : `Your ${eventLabel.toLowerCase()} meets go roughly ${meters}m better when ${factorLabel.toLowerCase()} is above median in the 3 days before.`;

  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} competitions.`;

  return { title, body, detail };
}
```

### `shared.ts` — label maps + helpers

```ts
export const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

export const LIFT_LABEL: Record<string, string> = {
  BACK_SQUAT: "Back Squat",
  FRONT_SQUAT: "Front Squat",
  POWER_CLEAN: "Power Clean",
  SNATCH: "Snatch",
  BENCH_PRESS: "Bench Press",
};

export const FACTOR_LABEL: Record<string, string> = {
  sleepQuality: "Sleep quality",
  sleepHours: "Sleep duration",
  soreness: "Soreness",
  stressLevel: "Stress level",
  energyMood: "Energy",
  hrvMs: "HRV",
  restingHR: "Resting heart rate",
  whoopStrain: "Strain",
};

export const CONFIDENCE_LABEL: Record<ConfidenceBand, string> = {
  WEAK: "Weak",
  MEDIUM: "Medium",
  STRONG: "Strong",
};

export function formatExerciseLabel(raw: string): string {
  return raw.toLowerCase();
}

export function effectSize(targetDelta: number, slopePerKg: number): number {
  if (slopePerKg === 0) return 0;
  return Math.round(Math.abs(targetDelta / slopePerKg));
}
```

### What templates DON'T do

- No event-time language (no "last week", "recently")
- No numeric formatting beyond `.toFixed(1|2)` — never "approximately" or fuzzy words
- No imperative suggestions ("so you should...") — sub-project C territory
- No HTML / Markdown — plain strings only

---

## Orchestration + Persistence + Trigger

### Orchestrator — `src/lib/insights/runInsights.ts`

Single entry point, used by both the `after()` trigger and the on-demand endpoint:

```ts
const ANALYZERS = [
  { analyzer: trainingPatternAnalyzer,       render: renderTrainingPattern },
  { analyzer: liftThrowAnalyzer,             render: renderLiftThrow },
  { analyzer: readinessCompetitionAnalyzer,  render: renderReadinessCompetition },
] as const;

export type RunInsightsInput = {
  athleteId: string;
  trigger: InsightTrigger;
  triggerMeetId?: string;
};

export type RunInsightsResult = {
  persistedCount: number;
  skippedAnalyzers: string[];
};

export async function runInsights(input: RunInsightsInput): Promise<RunInsightsResult> {
  const rendered: Array<RenderedInsight & { triggerKind: InsightTrigger; triggerMeetId: string | null }> = [];
  const skipped: string[] = [];

  for (const { analyzer, render } of ANALYZERS) {
    try {
      const structured = await analyzer.analyze(input.athleteId);
      if (structured.length === 0) {
        skipped.push(analyzer.category);
        continue;
      }
      for (const s of structured) {
        const { title, body, detail } = render(s);
        rendered.push({ ...s, title, body, detail, triggerKind: input.trigger, triggerMeetId: input.triggerMeetId ?? null });
      }
    } catch (err) {
      logger.error("insight analyzer failed", { category: analyzer.category, athleteId: input.athleteId, error: err });
    }
  }

  const persistedCount = await persistInsights(input.athleteId, rendered);
  return { persistedCount, skippedAnalyzers: skipped };
}
```

Per-analyzer try/catch so one failure doesn't block the others. Errors logged via `logger.error`, never silently swallowed.

### Persistence — `src/lib/insights/persist.ts`

Single `createMany` call. No dedup at write time (latest-per-slot at read time is cheaper given the index).

```ts
export async function persistInsights(
  athleteId: string,
  items: Array<RenderedInsight & { triggerKind: InsightTrigger; triggerMeetId: string | null }>
): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items.map((i) => ({ /* ...map all columns... */ }));
  const result = await prisma.athleteInsight.createMany({ data: rows });
  return result.count;
}
```

### Trigger — `isMeetComplete` helper

```ts
// src/lib/insights/trigger.ts
export function isMeetComplete(
  format: CompFormat,
  madeFinals: boolean | null,
  throws: Array<{ round: "PRELIM" | "FINALS"; attemptInRound: number }>
): boolean {
  const hasPrelim = (n: number) => throws.some((t) => t.round === "PRELIM" && t.attemptInRound === n);
  const hasFinals = (n: number) => throws.some((t) => t.round === "FINALS" && t.attemptInRound === n);

  if (format === "FOUR_STRAIGHT") {
    return hasPrelim(1) && hasPrelim(2) && hasPrelim(3) && hasPrelim(4);
  }
  const prelimsComplete = hasPrelim(1) && hasPrelim(2) && hasPrelim(3);
  if (!prelimsComplete) return false;
  if (madeFinals) return hasFinals(1) && hasFinals(2) && hasFinals(3);
  return true;
}
```

### Per-throw handler wiring

Modify `src/app/api/throws/competitions/[id]/throws/route.ts` (from sub-project A). After the throw create + legacy-result clear + notify call, before the return:

```ts
import { after } from "next/server";
import { runInsights } from "@/lib/insights/runInsights";
import { isMeetComplete } from "@/lib/insights/trigger";

const throwsAfter = [...meet.throws, { round: parsed.round, attemptInRound: parsed.attemptInRound }];
if (isMeetComplete(meet.format ?? "THREE_PLUS_THREE", meet.madeFinals, throwsAfter)) {
  after(async () => {
    try {
      await runInsights({
        athleteId: meet.athleteId,
        trigger: "MEET_COMPLETE",
        triggerMeetId: meet.id,
      });
    } catch (err) {
      logger.error("post-meet insights failed", { meetId: meet.id, error: err });
    }
  });
}
```

**Note on `after()`:** requires either Next.js 15+ or Next.js 14.2 with the `experimental.after` flag. Implementation's **first task** is verifying `after` works locally; if it doesn't, fall back to unawaited Promise and flag for a later Next.js upgrade.

---

## API Surface

All routes follow `{ success, data | error }`, validate via Zod, gate via `canAccessAthlete`.

### `GET /api/insights` — list

| Query param | Values | Default |
|---|---|---|
| `athleteId` | required | — |
| `mode` | `latest` \| `all` | `latest` |
| `category` | `TRAINING_PATTERN` \| `LIFT_THROW` \| `READINESS_COMPETITION` | all |
| `limit` | 1-100 | 50 |

`latest` mode uses Postgres `DISTINCT ON (athleteId, category, metric) ORDER BY ... computedAt DESC` via `prisma.$queryRaw`. `all` mode orders by `computedAt DESC`.

Response: `{ success: true, data: { insights: AthleteInsight[], total: number } }`.

### `POST /api/insights/compute` — on-demand recompute

Body: `{ athleteId }`. Runs `runInsights({ trigger: "ON_DEMAND" })` **synchronously** — the caller expects to re-fetch afterward and see fresh data.

Rate limit: 60 seconds per athlete (reused from `src/lib/rate-limit.ts`). Second call within window returns 429 with `retryAfter` hint.

Expected runtime at typical data volume: 500-1500ms.

### Zod schemas (append to `src/lib/api-schemas.ts`)

```ts
export const InsightComputeSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
});

export const InsightsListQuerySchema = z.object({
  athleteId: z.string().min(1),
  mode: z.enum(["latest", "all"]).optional().default("latest"),
  category: z.enum(["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"]).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
```

### Deliberate non-features

- No insight mutation endpoints (schema has columns; sub-project C adds endpoints)
- No per-insight GET (MVP cards show everything from the list)
- No compute-single-analyzer endpoint (YAGNI)
- No cron endpoint (reserved)
- No response caching (insights change; stale reads confuse coaches)

---

## Testing

Per project TDD rule: tests first, watch them fail, implement.

### Analyzer tests — `src/lib/insights/analyzers/__tests__/*`

**`trainingPattern.test.ts`** — happy path (12 weeks, MEDIUM band), skip <5 points, skip `|r| < 0.4` floor, negative-direction path, per-event fan-out.

**`liftThrowCorrelation.test.ts`** — happy path (8 windows, `r=0.72`, STRONG), 3RM-stronger-than-1RM basis selection, Epley helper correctness (85kg × 5 reps → ~99kg 1RM), skip <6 windows, skip `|r| < 0.4`, multi-lift fan-out.

**`readinessCompetition.test.ts`** — happy path (6 meets, sleep quality, `r=-0.55`, MEDIUM), group-comparison effect-size populated, missing-day exclusion, per-factor skip (sleep OK, HRV missing → one insight), analyzer-wide skip (<4 meets).

### Template snapshot tests — `src/lib/insights/templates/__tests__/*`

Fixed `StructuredInsight` fixtures → exact-string assertions on `title` / `body` / `detail`. Roughly 8 fixtures total. Breaks on casual prose edits (exactly what we want).

### Orchestrator test — `src/lib/insights/__tests__/runInsights.test.ts`

Mocked analyzers + real orchestration: all three produce → persisted with combined count; one throws → other two still run, skipped count reflects thrown one; all return `[]` → `persistedCount: 0`; `trigger` and `triggerMeetId` passthrough verified.

### Trigger test — `src/lib/insights/__tests__/trigger.test.ts`

Pure `isMeetComplete` tests:

- `FOUR_STRAIGHT` + 4 prelims → true
- `FOUR_STRAIGHT` + 3 prelims → false
- `THREE_PLUS_THREE` + `madeFinals=false` + 3 prelims → true
- `THREE_PLUS_THREE` + `madeFinals=true` + 3 prelims only → false
- `THREE_PLUS_THREE` + `madeFinals=true` + 3 prelims + 3 finals → true
- Order-agnostic input still works

### Per-throw handler integration — extend existing `throws.test.ts`

- Meet-complete transition fires `after(runInsights)` with `trigger: "MEET_COMPLETE"`
- Non-complete POST (prelim 2 of 3) does NOT fire
- `after()` mocked to run synchronously so assertions work
- `runInsights` throwing inside `after` doesn't fail the throw save

### API route tests — `src/app/api/insights/__tests__/insights.test.ts`

- GET latest / all / category filter / missing athleteId (400) / forbidden (403)
- POST `/compute` calls `runInsights`, returns `persistedCount`; rate-limit second call (429); bad body (400)

### Manual end-to-end verification (before marking B done)

1. `npm run dev`, log in as coach, load a seeded athlete with rich training history
2. Log a complete meet → check Postgres for fresh `AthleteInsight` rows with the right `triggerMeetId`
3. `GET /api/insights?athleteId=…&mode=latest` → verify the rendered text matches
4. `POST /api/insights/compute` → verify rate-limit kicks in on second call within 60s
5. Athlete with no lifts and no check-ins → only training-pattern insights appear
6. `npx tsc --noEmit && npm run lint && npm test` — all green

### What we explicitly don't test

- Insight UI rendering (sub-project C)
- Cron (no cron in this spec)
- LLM prose
- Cross-athlete comparisons
- Performance benchmarks (acceptable at our scale; revisit if hot)

---

## Deliverables

**Schema:**
- [ ] Migration: new `AthleteInsight` table + `InsightCategory`, `ConfidenceBand`, `InsightTrigger` enums
- [ ] `athleteId` → `AthleteProfile` FK with `onDelete: Cascade`
- [ ] Two composite indexes

**Library — analyzers:**
- [ ] `src/lib/insights/types.ts`
- [ ] `src/lib/insights/analyzers/trainingPattern.ts`
- [ ] `src/lib/insights/analyzers/liftThrowCorrelation.ts` (includes Epley 1RM/3RM helper)
- [ ] `src/lib/insights/analyzers/readinessCompetition.ts`

**Library — rendering / orchestration / persistence:**
- [ ] `src/lib/insights/templates/shared.ts`
- [ ] `src/lib/insights/templates/trainingPattern.ts`
- [ ] `src/lib/insights/templates/liftThrowCorrelation.ts`
- [ ] `src/lib/insights/templates/readinessCompetition.ts`
- [ ] `src/lib/insights/runInsights.ts`
- [ ] `src/lib/insights/persist.ts`
- [ ] `src/lib/insights/trigger.ts`

**API:**
- [ ] `GET /api/insights` (list with latest-per-slot default)
- [ ] `POST /api/insights/compute` (rate-limited on-demand recompute)
- [ ] Zod schemas in `src/lib/api-schemas.ts`

**Integration:**
- [ ] Per-throw POST wires `after(runInsights)` on meet-complete

**Tests:** all categories above.

---

## Success Criteria

1. Coach logs the final throw of a complete meet for an athlete with rich history → within seconds, `GET /api/insights?athleteId=…` returns fresh insights across 1-3 categories, with the right `triggerMeetId`.
2. Athlete with no lift logs still gets training-pattern insights; lift-throw analyzer silently skips.
3. Brand-new athlete with 2 practice sessions, no meets → engine runs, writes nothing, returns `persistedCount: 0`, no errors.
4. `POST /api/insights/compute` twice within 60s → second returns 429.
5. Template snapshot tests break on casual prose edits (preventing drift).
6. `npx tsc --noEmit` clean, `npm run lint` clean, all new tests pass, existing 238 passing tests still pass.
7. No mutation to `ThrowLog`, `ThrowsCompetition`, `AthleteProfile`, or any existing engine file outside `api/throws/competitions/[id]/throws/route.ts` (which only gains the `after()` hook).

---

## Risks + Open Items for Implementation

- **`after()` availability.** Codebase is Next.js 14.2. `after` is fully stable in 15+; 14.2 needs `experimental.after` in `next.config.js`. **Implementation first step:** verify `after` works locally before proceeding with analyzer work. If it doesn't, fall back to unawaited Promise with a flagged follow-up.
- **`LiftingExerciseLog` schema assumption.** Spec assumes `weight`, `reps`, and stable lift identifier for the 5 tracked lifts. If the actual schema differs (e.g., pre-computed rep-maxes, free-text lift names), the Epley helper needs defensive parsing. **Implementation should read the schema first.**
- **`ReadinessCheckIn` factor coverage.** Some factors (`whoopStrain`, `restingHR`) may not be in the model. Missing factors are silently skipped; fix is one-line removal.
- **3-day pre-meet window edge case.** Back-to-back meets produce overlapping windows. Acceptable; evidence may list the same check-in twice.
- **Template determinism under i18n.** Fixed-string tests break under i18n. Not a concern now (English only), flagged.

---

## Scope Guardrails (Stop and Ask)

If any of these come up during implementation, stop and ask before adding:

- UI for insights → sub-project C
- Notification routing for new insights → sub-project C
- Read / dismissed mutation endpoints → sub-project C
- Scheduled cron / weekly digest → sub-project C
- LLM-generated prose → later polish
- A fourth insight category → later spec
- Cross-athlete comparisons → separate feature
- Changes to `personal-correlations.ts` or any existing `throws/engine/` file → spec READS from the engine, doesn't modify it
- New WHOOP / Oura integration → consume what's already there
- Coach permission to hide specific insights from specific athletes → sub-project C
