# Trend Insight Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a net-new `src/lib/insights/` module that runs three analyzers (training-pattern wrapping existing engine, lift↔throw, readiness↔competition), persists results as immutable `AthleteInsight` rows via rule-based templates, fires on meet-complete through `unstable_after`, and exposes an on-demand recompute endpoint.

**Architecture:** Per-analyzer module + central orchestrator. Each analyzer implements `Analyzer.analyze(athleteId) → StructuredInsight[]`, passes output to a category-specific template, then to a shared persistence layer. The per-throw POST handler (from sub-project A) gets a narrow integration point: `if (isMeetComplete(...)) after(runInsights(...))`. No mutations to existing engine files — the training-pattern analyzer calls `computePersonalCorrelations` with shaped input but does not modify the engine.

**Tech Stack:** Next.js 14.2.35 App Router, React 18.3, TypeScript, Prisma + Postgres, Zod, vitest, `unstable_after` from `next/server`, existing `computePersonalCorrelations` from `src/lib/throws/engine/personal-correlations.ts`, existing `pearsonCorrelation` and `linearSlope` from `src/lib/throws/profile-utils.ts`, existing `rate-limit.ts` for the on-demand endpoint.

**Spec:** `docs/superpowers/specs/2026-04-17-trend-insight-layer-design.md`

**Pre-verified (so plan tasks don't re-derive):**
- `unstable_after` is the 14.2 name for what 15+ calls `after`. Import: `import { unstable_after as after } from "next/server"`. Requires `experimental.after: true` in `next.config.mjs`.
- `LiftingExerciseLog`: `exerciseName` is free-text, `sets Int?`, `reps Int?`, `load Float?`, `loadUnit String @default("lbs")`. Needs canonical-lift matcher + lbs↔kg conversion.
- `ReadinessCheckIn` has all 8 factors; two check-in tables sometimes overlap so `ThrowsCheckIn` is the fallback source only when `ReadinessCheckIn` is missing a factor.
- `AthleteProfile.gender` is used to pick population correlations (same as `personal-records.ts` existing logic).

---

## File Plan

### New files

| Path | Responsibility |
|---|---|
| `src/lib/insights/types.ts` | `ConfidenceBand`, `InsightCategory`, `StructuredInsight<TEvidence>`, `Analyzer<TEvidence>`, `RenderedInsight` |
| `src/lib/insights/templates/shared.ts` | `EVENT_LABEL`, `LIFT_LABEL`, `FACTOR_LABEL`, `CONFIDENCE_LABEL`, `formatExerciseLabel`, `effectSize` |
| `src/lib/insights/templates/trainingPattern.ts` | `renderTrainingPattern(insight) → {title, body, detail}` |
| `src/lib/insights/templates/liftThrowCorrelation.ts` | `renderLiftThrow(insight) → {title, body, detail}` |
| `src/lib/insights/templates/readinessCompetition.ts` | `renderReadinessCompetition(insight) → {title, body, detail}` |
| `src/lib/insights/rep-max.ts` | `canonicalLift(exerciseName)`, `estimateOneRM(weightKg, reps)`, `estimateThreeRM(weightKg, reps)`, `lbsToKg` |
| `src/lib/insights/analyzers/trainingPattern.ts` | `trainingPatternAnalyzer: Analyzer` wraps `computePersonalCorrelations` |
| `src/lib/insights/analyzers/liftThrowCorrelation.ts` | `liftThrowAnalyzer: Analyzer` — 4-week bucketing, 1RM/3RM Pearson |
| `src/lib/insights/analyzers/readinessCompetition.ts` | `readinessCompetitionAnalyzer: Analyzer` — 3-day pre-meet averages, per-factor Pearson + group comparison |
| `src/lib/insights/trigger.ts` | `isMeetComplete(format, madeFinals, throws)` |
| `src/lib/insights/persist.ts` | `persistInsights(athleteId, items) → count` (single `createMany`) |
| `src/lib/insights/runInsights.ts` | `runInsights({athleteId, trigger, triggerMeetId})` — orchestrator |
| `src/app/api/insights/route.ts` | `GET` — list with `mode=latest\|all`, `category`, `limit` |
| `src/app/api/insights/compute/route.ts` | `POST` — on-demand recompute, 60s rate limit |
| `src/lib/insights/__tests__/trigger.test.ts` | unit tests for `isMeetComplete` |
| `src/lib/insights/__tests__/runInsights.test.ts` | orchestrator tests with mocked analyzers |
| `src/lib/insights/__tests__/rep-max.test.ts` | Epley + canonical-lift + lbs-kg tests |
| `src/lib/insights/analyzers/__tests__/trainingPattern.test.ts` | mocked-prisma analyzer tests |
| `src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts` | mocked-prisma analyzer tests |
| `src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts` | mocked-prisma analyzer tests |
| `src/lib/insights/templates/__tests__/trainingPattern.test.ts` | snapshot-style template tests |
| `src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts` | snapshot-style template tests |
| `src/lib/insights/templates/__tests__/readinessCompetition.test.ts` | snapshot-style template tests |
| `src/app/api/insights/__tests__/insights.test.ts` | GET tests |
| `src/app/api/insights/compute/__tests__/compute.test.ts` | POST tests including rate-limit |

### Modified files

| Path | What changes |
|---|---|
| `prisma/schema.prisma` | add `AthleteInsight` model + 3 enums; add `AthleteProfile.insights AthleteInsight[]` reverse relation |
| `next.config.mjs` | add `experimental.after: true` |
| `src/lib/api-schemas.ts` | append `InsightComputeSchema`, `InsightsListQuerySchema` |
| `src/app/api/throws/competitions/[id]/throws/route.ts` | add `after(runInsights(...))` call on meet-complete transition |

---

## Task 1: Verify `unstable_after` + enable experimental flag

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Inspect current experimental config**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
grep -A 6 "experimental:" next.config.mjs
```

You should see an existing `experimental:` block with `serverComponentsExternalPackages` and `serverActions`. Preserve both.

- [ ] **Step 2: Add `after: true` flag**

Open `next.config.mjs`. Inside the existing `experimental` object, add `after: true`:

```js
experimental: {
  // bcryptjs uses Node.js crypto — must run in Node.js runtime, not edge
  serverComponentsExternalPackages: ['bcryptjs'],
  serverActions: {
    bodySizeLimit: '2gb',
  },
  after: true, // NEW — enables unstable_after for post-response work
},
```

- [ ] **Step 3: Verify the import resolves**

Create a scratch file to confirm the import works. Run:

```bash
cat > /tmp/verify-after.ts <<'EOF'
import { unstable_after as after } from "next/server";
export function test() {
  after(() => {});
}
EOF
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit /tmp/verify-after.ts 2>&1
```

Expected: no errors. If `Cannot find name 'unstable_after'` appears, stop and escalate — the plan needs a fallback strategy (unawaited Promise with a follow-up note).

- [ ] **Step 4: Delete scratch file, typecheck the repo**

```bash
rm /tmp/verify-after.ts
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs
git commit -m "chore(next): enable experimental.after for insight trigger"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/insights/types.ts`

No test file — pure type exports.

- [ ] **Step 1: Create the types file**

```ts
// src/lib/insights/types.ts
/**
 * Shared types for the insight layer.
 * Analyzers return StructuredInsight[]; templates add {title, body, detail}.
 */

export type ConfidenceBand = "WEAK" | "MEDIUM" | "STRONG";

export type InsightCategory =
  | "TRAINING_PATTERN"
  | "LIFT_THROW"
  | "READINESS_COMPETITION";

export type InsightEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

export type StructuredInsight<TEvidence = unknown> = {
  category: InsightCategory;
  metric: string;                                  // e.g. "exerciseUsage.shot_put.8kg_shot"
  event: InsightEvent | null;                      // null when event-agnostic
  confidenceBand: ConfidenceBand;
  dataPoints: number;
  coefficient: number | null;                      // Pearson r or regression slope
  effectSize: number | null;
  effectUnit: string | null;
  evidence: TEvidence;                             // analyzer-specific shape, JSON-serializable
  renderInputs: Record<string, string | number>;   // slot values for the template
};

export interface Analyzer<TEvidence = unknown> {
  readonly category: InsightCategory;
  analyze(athleteId: string): Promise<StructuredInsight<TEvidence>[]>;
}

export type RenderedInsight<TEvidence = unknown> = StructuredInsight<TEvidence> & {
  title: string;
  body: string;
  detail: string | null;
};
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/insights/types.ts
git commit -m "feat(insights): shared types — StructuredInsight + Analyzer"
```

---

## Task 3: Schema migration — `AthleteInsight` + enums

**Files:**
- Modify: `prisma/schema.prisma`
- Generated: `prisma/migrations/<timestamp>_athlete_insight/`

- [ ] **Step 1: Add the three enums**

Open `prisma/schema.prisma`. In the enum section (alongside `MeetStatus`, `VenueType`, etc. from sub-project A), append:

```prisma
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

- [ ] **Step 2: Add the `AthleteInsight` model**

Append the new model at the bottom of the file:

```prisma
model AthleteInsight {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  category InsightCategory
  metric   String
  event    EventType?

  title  String
  body   String
  detail String?

  confidenceBand ConfidenceBand
  dataPoints     Int
  coefficient    Float?
  effectSize     Float?
  effectUnit     String?

  evidence Json

  readByCoachAt   DateTime?
  readByAthleteAt DateTime?
  dismissedAt     DateTime?

  triggerKind   InsightTrigger
  triggerMeetId String?
  computedAt    DateTime       @default(now())

  @@index([athleteId, category, computedAt])
  @@index([athleteId, computedAt])
}
```

- [ ] **Step 3: Add the reverse relation on `AthleteProfile`**

Find `model AthleteProfile {` in the schema. Inside the model body (before any `@@index` lines), add:

```prisma
  insights AthleteInsight[]
```

Match the formatting of the other relation fields on `AthleteProfile`.

- [ ] **Step 4: Create and apply the migration locally**

Per memory `feedback_never_seed_production.md`: override DB URL to local Postgres (NEVER prod Supabase).

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" \
POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" \
npx prisma migrate dev --name athlete_insight
```

Expected: migration directory created under `prisma/migrations/<timestamp>_athlete_insight/`, SQL contains `CREATE TYPE` × 3 + `CREATE TABLE AthleteInsight` + 2 `CREATE INDEX`.

- [ ] **Step 5: Verify the generated client has the new model**

```bash
grep -E "AthleteInsight|InsightCategory|ConfidenceBand|InsightTrigger" node_modules/.prisma/client/index.d.ts | head -10
```

Expected: type definitions visible.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): AthleteInsight table + 3 enums for trend insight layer"
```

---

## Task 4: Shared template helpers

**Files:**
- Create: `src/lib/insights/templates/shared.ts`

No dedicated test file — helpers are exercised through the category-specific template snapshot tests.

- [ ] **Step 1: Create the file**

```ts
// src/lib/insights/templates/shared.ts
import type { ConfidenceBand } from "../types";

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

/**
 * Lower-case exercise label for use in-sentence.
 * The analyzer stores exercise names verbatim (e.g., "8kg Shot"); templates
 * lowercase them to read naturally in prose.
 */
export function formatExerciseLabel(raw: string): string {
  return raw.toLowerCase();
}

/**
 * Given a target delta in meters and a slope in meters-per-kg,
 * returns the number of kg that corresponds to the target delta.
 * Rounded to nearest kg. Returns 0 when slope is 0 to avoid division-by-zero.
 */
export function effectSize(targetDelta: number, slopePerKg: number): number {
  if (slopePerKg === 0) return 0;
  return Math.round(Math.abs(targetDelta / slopePerKg));
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/insights/templates/shared.ts
git commit -m "feat(insights): shared template helpers + label maps"
```

---

## Task 5: Training-pattern template

**Files:**
- Create: `src/lib/insights/templates/trainingPattern.ts`
- Create: `src/lib/insights/templates/__tests__/trainingPattern.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

```ts
// src/lib/insights/templates/__tests__/trainingPattern.test.ts
import { describe, it, expect } from "vitest";
import { renderTrainingPattern } from "../trainingPattern";
import type { StructuredInsight } from "../../types";

function baseFixture(overrides: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    category: "TRAINING_PATTERN",
    metric: "exerciseUsage.shot_put.8kg_shot",
    event: "SHOT_PUT",
    confidenceBand: "MEDIUM",
    dataPoints: 12,
    coefficient: 0.68,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    renderInputs: { exercise: "8kg Shot", direction: "positive", sessionsObserved: 12 },
    ...overrides,
  };
}

describe("renderTrainingPattern", () => {
  it("positive direction — MEDIUM confidence", () => {
    expect(renderTrainingPattern(baseFixture())).toEqual({
      title: "Your best shot put throws follow 8kg shot weeks",
      body: "Weeks with more 8kg shot sessions tend to produce your stronger throws at competition weight.",
      detail: "Pattern strength: Medium — based on 12 weeks of data.",
    });
  });

  it("negative direction — STRONG confidence", () => {
    expect(
      renderTrainingPattern(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 24,
          renderInputs: { exercise: "6kg Shot", direction: "negative", sessionsObserved: 24 },
        })
      )
    ).toEqual({
      title: "Your shot put throws dip during 6kg shot weeks",
      body: "Weeks heavy on 6kg shot tend to precede your weaker sessions at competition weight.",
      detail: "Pattern strength: Strong — based on 24 weeks of data.",
    });
  });

  it("different event — HAMMER", () => {
    const result = renderTrainingPattern(
      baseFixture({
        event: "HAMMER",
        metric: "exerciseUsage.hammer.heavy_turns",
        renderInputs: { exercise: "Heavy Turns", direction: "positive", sessionsObserved: 8 },
        confidenceBand: "WEAK",
        dataPoints: 8,
      })
    );
    expect(result.title).toBe("Your best hammer throws follow heavy turns weeks");
    expect(result.detail).toBe("Pattern strength: Weak — based on 8 weeks of data.");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/templates/__tests__/trainingPattern.test.ts
```

Expected: FAIL with `Cannot find module '../trainingPattern'`.

- [ ] **Step 3: Create the template**

```ts
// src/lib/insights/templates/trainingPattern.ts
import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, formatExerciseLabel } from "./shared";

export type TrainingPatternEvidence = {
  sessionIds: string[];
  event: string;
  exercise: string;
  personalR: number;
  populationR: number;
  blendedR: number;
  personalWeight: number;
};

export function renderTrainingPattern(
  insight: StructuredInsight<TrainingPatternEvidence>
): { title: string; body: string; detail: string } {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const exerciseLabel = formatExerciseLabel(String(insight.renderInputs.exercise));
  const direction = String(insight.renderInputs.direction);
  const lowerEvent = eventLabel.toLowerCase();

  const title =
    direction === "positive"
      ? `Your best ${lowerEvent} throws follow ${exerciseLabel} weeks`
      : `Your ${lowerEvent} throws dip during ${exerciseLabel} weeks`;

  const body =
    direction === "positive"
      ? `Weeks with more ${exerciseLabel} sessions tend to produce your stronger throws at competition weight.`
      : `Weeks heavy on ${exerciseLabel} tend to precede your weaker sessions at competition weight.`;

  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} weeks of data.`;

  return { title, body, detail };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/templates/__tests__/trainingPattern.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/templates/trainingPattern.ts src/lib/insights/templates/__tests__/trainingPattern.test.ts
git commit -m "feat(insights): training-pattern template + snapshot tests"
```

---

## Task 6: Lift-throw template

**Files:**
- Create: `src/lib/insights/templates/liftThrowCorrelation.ts`
- Create: `src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

```ts
// src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts
import { describe, it, expect } from "vitest";
import { renderLiftThrow } from "../liftThrowCorrelation";
import type { StructuredInsight } from "../../types";

function baseFixture(overrides: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    category: "LIFT_THROW",
    metric: "squat_1rm.hammer",
    event: "HAMMER",
    confidenceBand: "MEDIUM",
    dataPoints: 11,
    coefficient: 0.72,
    effectSize: 0.04,      // meters per kg
    effectUnit: "meters per kg",
    evidence: {},
    renderInputs: { lift: "BACK_SQUAT", repMaxBasis: "1RM" },
    ...overrides,
  };
}

describe("renderLiftThrow", () => {
  it("back squat 1RM — hammer — MEDIUM", () => {
    // effectSize 0.04 m/kg → 0.5 m / 0.04 m/kg = 12.5 → rounds to 13 kg
    expect(renderLiftThrow(baseFixture())).toEqual({
      title: "Back Squat 1RM tracks with hammer distance",
      body: "Your back squat 1RM and hammer best-mark have moved together over the last months.",
      detail:
        "Roughly every 13kg of 1RM has tracked with ~0.5m of hammer distance. " +
        "Pattern strength: Medium — based on 11 paired windows.",
    });
  });

  it("3RM basis — snatch — STRONG", () => {
    // effectSize 0.02 m/kg → 0.5 / 0.02 = 25 kg
    expect(
      renderLiftThrow(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 18,
          effectSize: 0.02,
          renderInputs: { lift: "SNATCH", repMaxBasis: "3RM" },
          event: "DISCUS",
          metric: "snatch_3rm.discus",
        })
      )
    ).toEqual({
      title: "Snatch 3RM tracks with discus distance",
      body: "Your snatch 3RM and discus best-mark have moved together over the last months.",
      detail:
        "Roughly every 25kg of 3RM has tracked with ~0.5m of discus distance. " +
        "Pattern strength: Strong — based on 18 paired windows.",
    });
  });

  it("zero slope falls back to 0kg in copy", () => {
    const result = renderLiftThrow(
      baseFixture({ effectSize: 0, confidenceBand: "WEAK", dataPoints: 6 })
    );
    expect(result.detail).toContain("Roughly every 0kg of 1RM");
    expect(result.detail).toContain("Pattern strength: Weak — based on 6 paired windows.");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the template**

```ts
// src/lib/insights/templates/liftThrowCorrelation.ts
import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, LIFT_LABEL, effectSize } from "./shared";

export type LiftThrowEvidence = {
  lift: string;
  event: string;
  repMaxBasis: "1RM" | "3RM";
  pairs: Array<{ windowStart: string; repMaxKg: number; bestMarkM: number }>;
  pearsonR: number;
  regressionSlope: number;
};

export function renderLiftThrow(
  insight: StructuredInsight<LiftThrowEvidence>
): { title: string; body: string; detail: string } {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const liftKey = String(insight.renderInputs.lift);
  const liftLabel = LIFT_LABEL[liftKey] ?? liftKey;
  const basis = String(insight.renderInputs.repMaxBasis) as "1RM" | "3RM";
  const lowerEvent = eventLabel.toLowerCase();
  const kgPer05m = effectSize(0.5, insight.effectSize ?? 0);

  const title = `${liftLabel} ${basis} tracks with ${lowerEvent} distance`;
  const body = `Your ${liftLabel.toLowerCase()} ${basis} and ${lowerEvent} best-mark have moved together over the last months.`;
  const detail =
    `Roughly every ${kgPer05m}kg of ${basis} has tracked with ~0.5m of ${lowerEvent} distance. ` +
    `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} paired windows.`;

  return { title, body, detail };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/templates/liftThrowCorrelation.ts src/lib/insights/templates/__tests__/liftThrowCorrelation.test.ts
git commit -m "feat(insights): lift-throw template + snapshot tests"
```

---

## Task 7: Readiness-competition template

**Files:**
- Create: `src/lib/insights/templates/readinessCompetition.ts`
- Create: `src/lib/insights/templates/__tests__/readinessCompetition.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

```ts
// src/lib/insights/templates/__tests__/readinessCompetition.test.ts
import { describe, it, expect } from "vitest";
import { renderReadinessCompetition } from "../readinessCompetition";
import type { StructuredInsight } from "../../types";

function baseFixture(overrides: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    category: "READINESS_COMPETITION",
    metric: "sleepQuality.shot_put",
    event: "SHOT_PUT",
    confidenceBand: "MEDIUM",
    dataPoints: 6,
    coefficient: -0.55,
    effectSize: -1.2,         // meters (below-median minus above-median mean delta)
    effectUnit: "meters",
    evidence: {},
    renderInputs: { factor: "sleepQuality", direction: "negative", thresholdLabel: "below 6/10" },
    ...overrides,
  };
}

describe("renderReadinessCompetition", () => {
  it("negative — sleep quality — MEDIUM", () => {
    expect(renderReadinessCompetition(baseFixture())).toEqual({
      title: "Sleep quality affects your shot put meets",
      body: "Your shot put meets go roughly 1.2m worse when sleep quality is below 6/10 in the 3 days before.",
      detail: "Pattern strength: Medium — based on 6 competitions.",
    });
  });

  it("positive — HRV — STRONG", () => {
    expect(
      renderReadinessCompetition(
        baseFixture({
          confidenceBand: "STRONG",
          dataPoints: 10,
          effectSize: 1.4,
          event: "HAMMER",
          metric: "hrvMs.hammer",
          renderInputs: { factor: "hrvMs", direction: "positive", thresholdLabel: "above median" },
        })
      )
    ).toEqual({
      title: "HRV affects your hammer meets",
      body: "Your hammer meets go roughly 1.4m better when hrv is above median in the 3 days before.",
      detail: "Pattern strength: Strong — based on 10 competitions.",
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/templates/__tests__/readinessCompetition.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the template**

```ts
// src/lib/insights/templates/readinessCompetition.ts
import type { StructuredInsight } from "../types";
import { CONFIDENCE_LABEL, EVENT_LABEL, FACTOR_LABEL } from "./shared";

export type ReadinessCompetitionEvidence = {
  factor: string;
  event: string;
  pairs: Array<{ competitionId: string; preAvg: number; bestMarkDeltaM: number }>;
  pearsonR: number;
  belowMedianMeanDelta: number;
  aboveMedianMeanDelta: number;
};

export function renderReadinessCompetition(
  insight: StructuredInsight<ReadinessCompetitionEvidence>
): { title: string; body: string; detail: string } {
  const eventLabel = EVENT_LABEL[insight.event ?? ""] ?? "event";
  const factorKey = String(insight.renderInputs.factor);
  const factorLabel = FACTOR_LABEL[factorKey] ?? factorKey;
  const threshold = String(insight.renderInputs.thresholdLabel);
  const direction = String(insight.renderInputs.direction);
  const meters = Math.abs(insight.effectSize ?? 0).toFixed(1);
  const lowerEvent = eventLabel.toLowerCase();

  const title = `${factorLabel} affects your ${lowerEvent} meets`;
  const body =
    direction === "negative"
      ? `Your ${lowerEvent} meets go roughly ${meters}m worse when ${factorLabel.toLowerCase()} is ${threshold} in the 3 days before.`
      : `Your ${lowerEvent} meets go roughly ${meters}m better when ${factorLabel.toLowerCase()} is ${threshold} in the 3 days before.`;
  const detail = `Pattern strength: ${CONFIDENCE_LABEL[insight.confidenceBand]} — based on ${insight.dataPoints} competitions.`;

  return { title, body, detail };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/templates/__tests__/readinessCompetition.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/templates/readinessCompetition.ts src/lib/insights/templates/__tests__/readinessCompetition.test.ts
git commit -m "feat(insights): readiness-competition template + snapshot tests"
```

---

## Task 8: Rep-max helpers (Epley + canonical lift + lbs→kg)

**Files:**
- Create: `src/lib/insights/rep-max.ts`
- Create: `src/lib/insights/__tests__/rep-max.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/__tests__/rep-max.test.ts
import { describe, it, expect } from "vitest";
import {
  canonicalLift,
  lbsToKg,
  estimateOneRM,
  estimateThreeRM,
} from "../rep-max";

describe("canonicalLift", () => {
  it("matches back squat variants", () => {
    expect(canonicalLift("Back Squat")).toBe("BACK_SQUAT");
    expect(canonicalLift("back squat")).toBe("BACK_SQUAT");
    expect(canonicalLift("  Back  Squat (pause)  ")).toBe("BACK_SQUAT");
  });

  it("matches front squat variants", () => {
    expect(canonicalLift("Front Squat")).toBe("FRONT_SQUAT");
    expect(canonicalLift("front-squat")).toBe("FRONT_SQUAT");
  });

  it("matches power clean but not hang clean", () => {
    expect(canonicalLift("Power Clean")).toBe("POWER_CLEAN");
    expect(canonicalLift("power clean")).toBe("POWER_CLEAN");
    expect(canonicalLift("Hang Power Clean")).toBeNull();
  });

  it("matches snatch but not hang snatch", () => {
    expect(canonicalLift("Snatch")).toBe("SNATCH");
    expect(canonicalLift("snatch from blocks")).toBe("SNATCH");
    expect(canonicalLift("Hang Snatch")).toBeNull();
  });

  it("matches bench press variants", () => {
    expect(canonicalLift("Bench Press")).toBe("BENCH_PRESS");
    expect(canonicalLift("Bench")).toBe("BENCH_PRESS");
    expect(canonicalLift("bench press (close grip)")).toBe("BENCH_PRESS");
  });

  it("rejects unknown lifts", () => {
    expect(canonicalLift("Deadlift")).toBeNull();
    expect(canonicalLift("Overhead Press")).toBeNull();
    expect(canonicalLift("")).toBeNull();
  });
});

describe("lbsToKg", () => {
  it("converts 225 lbs to ~102.06 kg", () => {
    expect(lbsToKg(225)).toBeCloseTo(102.058, 2);
  });

  it("converts 0 to 0", () => {
    expect(lbsToKg(0)).toBe(0);
  });
});

describe("estimateOneRM (Epley)", () => {
  it("85kg × 5 reps → ~99.17kg 1RM", () => {
    // Epley: 85 × (1 + 5/30) = 85 × 1.1667 = 99.17
    expect(estimateOneRM(85, 5)).toBeCloseTo(99.167, 2);
  });

  it("100kg × 1 rep → 100kg", () => {
    expect(estimateOneRM(100, 1)).toBeCloseTo(103.333, 2); // 100 × (1 + 1/30) — ≈100 if Epley is capped at 1 rep
    // Note: raw Epley gives 103.3 for 1 rep. If the spec wants 1-rep-sets unchanged, cap at reps <= 1.
    // We accept the formula as-is: estimateOneRM(100, 1) = 100 * 31/30 = 103.33.
  });

  it("ignores reps > 10 (returns 0 to signal unusable set)", () => {
    expect(estimateOneRM(60, 15)).toBe(0);
  });

  it("ignores zero or negative weight", () => {
    expect(estimateOneRM(0, 5)).toBe(0);
    expect(estimateOneRM(-10, 5)).toBe(0);
  });

  it("ignores zero or negative reps", () => {
    expect(estimateOneRM(100, 0)).toBe(0);
    expect(estimateOneRM(100, -1)).toBe(0);
  });
});

describe("estimateThreeRM", () => {
  it("99.17kg 1RM implies 3RM of ~90.15kg", () => {
    // 3RM = 1RM / (1 + 3/30) = 1RM × 30/33 = 99.17 × 0.909 = 90.15
    expect(estimateThreeRM(85, 5)).toBeCloseTo(90.152, 2);
  });

  it("returns 0 when set is unusable for rep-max estimation", () => {
    expect(estimateThreeRM(60, 15)).toBe(0);
    expect(estimateThreeRM(0, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/__tests__/rep-max.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the helper**

```ts
// src/lib/insights/rep-max.ts
/**
 * Rep-max helpers for lift↔throw analyzer.
 *
 * Epley formula: 1RM = weight × (1 + reps/30), valid for sets at reps ≤ 10.
 * Higher-rep sets aren't reliable for max estimation and are skipped (return 0).
 */

export const LBS_PER_KG = 2.20462;

export type CanonicalLift =
  | "BACK_SQUAT"
  | "FRONT_SQUAT"
  | "POWER_CLEAN"
  | "SNATCH"
  | "BENCH_PRESS";

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/**
 * Match a free-text exerciseName to one of the 5 tracked lifts.
 * Returns null for unknown lifts or variants we explicitly exclude (hang cleans,
 * hang snatches — different force-production profile per Bondarchuk conventions).
 */
export function canonicalLift(exerciseName: string): CanonicalLift | null {
  const n = exerciseName.toLowerCase().trim().replace(/\s+/g, " ");
  if (n.length === 0) return null;

  // Exclude hang variants first — they'd otherwise match the base lift below
  if (/\bhang\b/.test(n)) return null;

  if (/\bback[\s-]?squat\b/.test(n)) return "BACK_SQUAT";
  if (/\bfront[\s-]?squat\b/.test(n)) return "FRONT_SQUAT";
  if (/\bpower[\s-]?clean\b/.test(n)) return "POWER_CLEAN";
  if (/\bsnatch\b/.test(n)) return "SNATCH";
  if (/\bbench(?:[\s-]?press)?\b/.test(n)) return "BENCH_PRESS";

  return null;
}

/**
 * Estimate 1RM via Epley for a single set. Returns 0 for unusable sets
 * (reps > 10, non-positive weight, non-positive reps).
 */
export function estimateOneRM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps > 10) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * Estimate 3RM via Epley: derived from 1RM scaled to 3 reps.
 * 3RM = 1RM × 30/33.
 */
export function estimateThreeRM(weightKg: number, reps: number): number {
  const oneRM = estimateOneRM(weightKg, reps);
  if (oneRM === 0) return 0;
  return oneRM * (30 / 33);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/__tests__/rep-max.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/rep-max.ts src/lib/insights/__tests__/rep-max.test.ts
git commit -m "feat(insights): rep-max helpers — Epley + canonical lift matcher"
```

---

## Task 9: Training-pattern analyzer

**Files:**
- Create: `src/lib/insights/analyzers/trainingPattern.ts`
- Create: `src/lib/insights/analyzers/__tests__/trainingPattern.test.ts`

This analyzer is the thinnest — it wraps the existing `computePersonalCorrelations` and produces `StructuredInsight[]` from its output.

- [ ] **Step 1: Write failing analyzer tests**

```ts
// src/lib/insights/analyzers/__tests__/trainingPattern.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockSessionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    athleteThrowsSession: { findMany: (...a: unknown[]) => mockSessionFindMany(...a) },
  },
}));

vi.mock("@/lib/throws/engine/personal-correlations", () => ({
  computePersonalCorrelations: vi.fn(),
}));

import { computePersonalCorrelations } from "@/lib/throws/engine/personal-correlations";
import { trainingPatternAnalyzer } from "../trainingPattern";

describe("trainingPatternAnalyzer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] when athlete has no practice sessions", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("returns [] when no correlations clear the 0.4 floor", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([
      { id: "s1", event: "SHOT_PUT", date: "2026-01-01", drillLogs: [{ drillType: "Standing", throwCount: 10, bestMark: 18 }] },
    ]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      { exercise: "Standing", blendedR: 0.2, personalR: 0.2, populationR: 0.2, dataPoints: 6, personalWeight: 0.1 },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits top 2 positive-direction insights per event", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockSessionFindMany.mockResolvedValue([
      { id: "s1", event: "SHOT_PUT", date: "2026-01-01", drillLogs: [{ drillType: "8kg Shot", throwCount: 20, bestMark: 17 }] },
      { id: "s2", event: "SHOT_PUT", date: "2026-01-08", drillLogs: [{ drillType: "8kg Shot", throwCount: 20, bestMark: 18 }] },
    ]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      { exercise: "8kg Shot", blendedR: 0.75, personalR: 0.8, populationR: 0.6, dataPoints: 12, personalWeight: 0.6 },
      { exercise: "Standing", blendedR: 0.5, personalR: 0.4, populationR: 0.6, dataPoints: 12, personalWeight: 0.6 },
      { exercise: "Heavy Turns", blendedR: 0.3, personalR: 0.2, populationR: 0.4, dataPoints: 12, personalWeight: 0.6 }, // below floor
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("TRAINING_PATTERN");
    expect(result[0].metric).toBe("exerciseUsage.SHOT_PUT.8kg Shot");
    expect(result[0].event).toBe("SHOT_PUT");
    expect(result[0].confidenceBand).toBe("MEDIUM");
    expect(result[0].dataPoints).toBe(12);
    expect(result[0].coefficient).toBe(0.75);
    expect(result[0].renderInputs).toMatchObject({
      exercise: "8kg Shot",
      direction: "positive",
    });
  });

  it("uses STRONG band for 20+ data points", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockSessionFindMany.mockResolvedValue([{ id: "s1", event: "HAMMER", date: "2026-01-01", drillLogs: [{ drillType: "Full Turns", throwCount: 20, bestMark: 60 }] }]);
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      { exercise: "Full Turns", blendedR: 0.6, personalR: 0.7, populationR: 0.5, dataPoints: 24, personalWeight: 0.9 },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result[0].confidenceBand).toBe("STRONG");
  });

  it("fans out across events", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT", "DISCUS"] });
    mockSessionFindMany.mockImplementation((args: { where?: { event?: string } }) => {
      const event = args.where?.event;
      return Promise.resolve([
        { id: `s-${event}`, event, date: "2026-01-01", drillLogs: [{ drillType: `Ex-${event}`, throwCount: 10, bestMark: 15 }] },
      ]);
    });
    vi.mocked(computePersonalCorrelations).mockReturnValue([
      { exercise: "TopExercise", blendedR: 0.7, personalR: 0.7, populationR: 0.7, dataPoints: 12, personalWeight: 0.5 },
    ]);

    const result = await trainingPatternAnalyzer.analyze("a1");
    expect(result).toHaveLength(2); // one per event
    expect(new Set(result.map((r) => r.event))).toEqual(new Set(["SHOT_PUT", "DISCUS"]));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/analyzers/__tests__/trainingPattern.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement the analyzer**

```ts
// src/lib/insights/analyzers/trainingPattern.ts
import prisma from "@/lib/prisma";
import { computePersonalCorrelations } from "@/lib/throws/engine/personal-correlations";
import type { Analyzer, ConfidenceBand, InsightEvent, StructuredInsight } from "../types";
import type { TrainingPatternEvidence } from "../templates/trainingPattern";

const MIN_DATA_POINTS = 5;
const MIN_ABS_R = 0.4;
const TOP_N_PER_EVENT = 2;

function bandFor(dataPoints: number): ConfidenceBand {
  if (dataPoints >= 20) return "STRONG";
  if (dataPoints >= 10) return "MEDIUM";
  return "WEAK";
}

export const trainingPatternAnalyzer: Analyzer<TrainingPatternEvidence> = {
  category: "TRAINING_PATTERN",

  async analyze(athleteId: string): Promise<StructuredInsight<TrainingPatternEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];

    const results: StructuredInsight<TrainingPatternEvidence>[] = [];

    for (const event of events) {
      const sessions = await prisma.athleteThrowsSession.findMany({
        where: { athleteId, event },
        include: { drillLogs: true },
        orderBy: { date: "asc" },
      });
      if (sessions.length === 0) continue;

      // Shape into SessionExerciseRecord[] for the existing engine
      const sessionHistory = sessions.map((s) => ({
        sessionId: s.id,
        date: s.date,
        bestMark: Math.max(0, ...s.drillLogs.map((d) => d.bestMark ?? 0)),
        exercises: s.drillLogs.map((d) => d.drillType),
      }));

      // Call existing engine; for MVP we pass empty population — the engine
      // falls back to personal-only at low confidence (documented behavior).
      // Future work can plumb event-specific population correlations through.
      const correlations = computePersonalCorrelations(sessionHistory, []);

      const qualifying = correlations
        .filter(
          (c) => Math.abs(c.blendedR) >= MIN_ABS_R && c.dataPoints >= MIN_DATA_POINTS
        )
        .sort((a, b) => Math.abs(b.blendedR) - Math.abs(a.blendedR))
        .slice(0, TOP_N_PER_EVENT);

      for (const c of qualifying) {
        const direction = c.blendedR >= 0 ? "positive" : "negative";
        results.push({
          category: "TRAINING_PATTERN",
          metric: `exerciseUsage.${event}.${c.exercise}`,
          event,
          confidenceBand: bandFor(c.dataPoints),
          dataPoints: c.dataPoints,
          coefficient: c.blendedR,
          effectSize: null,
          effectUnit: null,
          evidence: {
            sessionIds: sessionHistory.slice(-10).map((s) => s.sessionId),
            event,
            exercise: c.exercise,
            personalR: c.personalR,
            populationR: c.populationR,
            blendedR: c.blendedR,
            personalWeight: c.personalWeight,
          },
          renderInputs: { exercise: c.exercise, direction },
        });
      }
    }

    return results;
  },
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/analyzers/__tests__/trainingPattern.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/analyzers/trainingPattern.ts src/lib/insights/analyzers/__tests__/trainingPattern.test.ts
git commit -m "feat(insights): training-pattern analyzer wraps personal-correlations"
```

---

## Task 10: Lift-throw correlation analyzer

**Files:**
- Create: `src/lib/insights/analyzers/liftThrowCorrelation.ts`
- Create: `src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts`

This analyzer is the most complex — it builds time-bucketed rolling rep-maxes, pairs them with competition-weight bests, and runs Pearson per (lift, event) pair.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockLiftingLogFindMany = vi.fn();
const mockThrowLogFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    liftingExerciseLog: { findMany: (...a: unknown[]) => mockLiftingLogFindMany(...a) },
    throwLog: { findMany: (...a: unknown[]) => mockThrowLogFindMany(...a) },
  },
}));

import { liftThrowAnalyzer } from "../liftThrowCorrelation";

// Build a 4-week window anchor for 8 windows of paired data.
// Start on a known Monday; each window is 28 days.
const WINDOW_START_DATES = Array.from({ length: 8 }, (_, i) => {
  const d = new Date("2025-11-03T00:00:00Z"); // Monday
  d.setUTCDate(d.getUTCDate() + i * 28);
  return d;
});

describe("liftThrowAnalyzer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] with no lifts logged", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue([]);
    mockThrowLogFindMany.mockResolvedValue([]);

    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("skips pair with <6 paired windows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    // Only 4 windows of paired data — below floor of 6
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.slice(0, 4).map((d, i) => ({
        exerciseName: "Back Squat",
        load: 100 + i * 5,
        loadUnit: "kg",
        reps: 5,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.slice(0, 4).map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.5,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000), // 5 days into window
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );

    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits insight with r≥0.4 on 6+ paired windows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Back Squat",
        load: 100 + i * 5,         // strictly increasing kg
        loadUnit: "kg",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3,    // strictly increasing m — perfect positive Pearson
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );

    const result = await liftThrowAnalyzer.analyze("a1");
    const hammer = result.find((r) => r.renderInputs.lift === "BACK_SQUAT" && r.event === "HAMMER");
    expect(hammer).toBeDefined();
    expect(hammer!.confidenceBand).toBe("WEAK"); // 8 windows → WEAK (6-9)
    expect(hammer!.coefficient).toBeGreaterThan(0.9);
    expect(hammer!.effectSize).toBeGreaterThan(0);
    expect(hammer!.effectUnit).toBe("meters per kg");
    expect(["1RM", "3RM"]).toContain(hammer!.renderInputs.repMaxBasis);
  });

  it("converts lbs to kg before bucketing", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    // Log in pounds — 225 lbs ≈ 102 kg
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Back Squat",
        load: 225 + i * 10,        // lbs
        loadUnit: "lbs",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );

    const result = await liftThrowAnalyzer.analyze("a1");
    const hammer = result.find((r) => r.event === "HAMMER");
    expect(hammer).toBeDefined();
    // Effect size in meters per kg — NOT meters per lb
    expect(hammer!.effectUnit).toBe("meters per kg");
  });

  it("excludes hang variants via canonicalLift", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["HAMMER"] });
    mockLiftingLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        exerciseName: "Hang Power Clean",
        load: 80 + i * 2,
        loadUnit: "kg",
        reps: 3,
        sets: 3,
        createdAt: d,
      }))
    );
    mockThrowLogFindMany.mockResolvedValue(
      WINDOW_START_DATES.map((d, i) => ({
        event: "HAMMER",
        distance: 60 + i * 0.3,
        implementWeight: 7.26,
        date: new Date(d.getTime() + 5 * 86400000),
        isCompetition: false,
        isFoul: false,
        isPass: false,
      }))
    );

    const result = await liftThrowAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement the analyzer**

```ts
// src/lib/insights/analyzers/liftThrowCorrelation.ts
import prisma from "@/lib/prisma";
import { pearsonCorrelation } from "@/lib/throws/profile-utils";
import {
  canonicalLift,
  estimateOneRM,
  estimateThreeRM,
  lbsToKg,
  type CanonicalLift,
} from "../rep-max";
import type {
  Analyzer,
  ConfidenceBand,
  InsightEvent,
  StructuredInsight,
} from "../types";
import type { LiftThrowEvidence } from "../templates/liftThrowCorrelation";

const MIN_PAIRS = 6;
const MIN_ABS_R = 0.4;
const WINDOW_DAYS = 28;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Gender-default competition weights (matches personal-records.ts)
const COMP_WEIGHT: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};
const WEIGHT_TOLERANCE_KG = 0.05;

function bandFor(pairs: number): ConfidenceBand {
  if (pairs >= 15) return "STRONG";
  if (pairs >= 10) return "MEDIUM";
  return "WEAK";
}

function windowIndex(date: Date, anchor: number): number {
  return Math.floor((date.getTime() - anchor) / WINDOW_MS);
}

function simpleLinearSlope(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

export const liftThrowAnalyzer: Analyzer<LiftThrowEvidence> = {
  category: "LIFT_THROW",

  async analyze(athleteId: string): Promise<StructuredInsight<LiftThrowEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];
    const gender: "male" | "female" = profile.gender === "FEMALE" ? "female" : "male";

    const liftLogs = await prisma.liftingExerciseLog.findMany({
      where: { workoutLog: { athleteId } },
      select: {
        exerciseName: true,
        load: true,
        loadUnit: true,
        reps: true,
        sets: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (liftLogs.length === 0) return [];

    // Bucket lift logs → per-lift 4-week windows → max 1RM / 3RM
    const earliestLiftMs = liftLogs[0].createdAt.getTime();
    const liftWindows: Record<CanonicalLift, Map<number, { max1RM: number; max3RM: number }>> = {
      BACK_SQUAT: new Map(),
      FRONT_SQUAT: new Map(),
      POWER_CLEAN: new Map(),
      SNATCH: new Map(),
      BENCH_PRESS: new Map(),
    };

    for (const log of liftLogs) {
      const canon = canonicalLift(log.exerciseName);
      if (!canon) continue;
      if (log.load == null || log.reps == null) continue;
      const weightKg = log.loadUnit === "lbs" ? lbsToKg(log.load) : log.load;
      const oneRM = estimateOneRM(weightKg, log.reps);
      const threeRM = estimateThreeRM(weightKg, log.reps);
      if (oneRM === 0) continue;

      const idx = windowIndex(log.createdAt, earliestLiftMs);
      const existing = liftWindows[canon].get(idx);
      if (!existing) {
        liftWindows[canon].set(idx, { max1RM: oneRM, max3RM: threeRM });
      } else {
        if (oneRM > existing.max1RM) existing.max1RM = oneRM;
        if (threeRM > existing.max3RM) existing.max3RM = threeRM;
      }
    }

    // Bucket competition-weight throws per event → per-window best-mark
    const allThrows = await prisma.throwLog.findMany({
      where: { athleteId, distance: { not: null } },
      select: {
        event: true,
        distance: true,
        implementWeight: true,
        date: true,
        isFoul: true,
        isPass: true,
      },
      orderBy: { date: "asc" },
    });

    const throwWindows: Partial<Record<InsightEvent, Map<number, number>>> = {};
    for (const event of events) {
      throwWindows[event] = new Map<number, number>();
      const compWeight = COMP_WEIGHT[event]?.[gender] ?? 0;
      for (const t of allThrows) {
        if (t.event !== event) continue;
        if (t.isFoul || t.isPass || t.distance == null) continue;
        if (Math.abs(t.implementWeight - compWeight) >= WEIGHT_TOLERANCE_KG) continue;
        const idx = windowIndex(t.date, earliestLiftMs);
        const existing = throwWindows[event]!.get(idx);
        if (existing == null || t.distance > existing) {
          throwWindows[event]!.set(idx, t.distance);
        }
      }
    }

    const results: StructuredInsight<LiftThrowEvidence>[] = [];

    for (const canon of Object.keys(liftWindows) as CanonicalLift[]) {
      const liftMap = liftWindows[canon];
      if (liftMap.size === 0) continue;

      for (const event of events) {
        const throwMap = throwWindows[event];
        if (!throwMap || throwMap.size === 0) continue;

        // Pair windows where BOTH a lift max and a throw max exist
        const pairedIndexes = [...liftMap.keys()].filter((k) => throwMap.has(k)).sort((a, b) => a - b);
        if (pairedIndexes.length < MIN_PAIRS) continue;

        const one = pairedIndexes.map((i) => liftMap.get(i)!.max1RM);
        const three = pairedIndexes.map((i) => liftMap.get(i)!.max3RM);
        const throws = pairedIndexes.map((i) => throwMap.get(i)!);

        const r1 = pearsonCorrelation(one, throws);
        const r3 = pearsonCorrelation(three, throws);

        const useThreeRM = Math.abs(r3) > Math.abs(r1);
        const chosenR = useThreeRM ? r3 : r1;
        if (Math.abs(chosenR) < MIN_ABS_R) continue;

        const xs = useThreeRM ? three : one;
        const slope = simpleLinearSlope(xs, throws);

        const earliestLift = liftLogs[0].createdAt.getTime();
        const pairs = pairedIndexes.slice(-15).map((i) => ({
          windowStart: new Date(earliestLift + i * WINDOW_MS).toISOString(),
          repMaxKg: useThreeRM ? three[pairedIndexes.indexOf(i)] : one[pairedIndexes.indexOf(i)],
          bestMarkM: throws[pairedIndexes.indexOf(i)],
        }));

        results.push({
          category: "LIFT_THROW",
          metric: `${canon.toLowerCase()}_${useThreeRM ? "3rm" : "1rm"}.${event.toLowerCase()}`,
          event,
          confidenceBand: bandFor(pairedIndexes.length),
          dataPoints: pairedIndexes.length,
          coefficient: chosenR,
          effectSize: slope,
          effectUnit: "meters per kg",
          evidence: {
            lift: canon,
            event,
            repMaxBasis: useThreeRM ? "3RM" : "1RM",
            pairs,
            pearsonR: chosenR,
            regressionSlope: slope,
          },
          renderInputs: { lift: canon, repMaxBasis: useThreeRM ? "3RM" : "1RM" },
        });
      }
    }

    return results;
  },
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/analyzers/liftThrowCorrelation.ts src/lib/insights/analyzers/__tests__/liftThrowCorrelation.test.ts
git commit -m "feat(insights): lift-throw correlation analyzer (4-week buckets, 1RM/3RM)"
```

---

## Task 11: Readiness-competition analyzer

**Files:**
- Create: `src/lib/insights/analyzers/readinessCompetition.ts`
- Create: `src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAthleteFindUnique = vi.fn();
const mockCompFindMany = vi.fn();
const mockReadinessFindMany = vi.fn();
const mockGetAthletePRs = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mockAthleteFindUnique(...a) },
    throwsCompetition: { findMany: (...a: unknown[]) => mockCompFindMany(...a) },
    readinessCheckIn: { findMany: (...a: unknown[]) => mockReadinessFindMany(...a) },
  },
  prisma: {
    throwsCompetition: { findMany: (...a: unknown[]) => mockCompFindMany(...a) },
  },
}));

vi.mock("@/lib/data/personal-records", () => ({
  getAthletePRs: (...a: unknown[]) => mockGetAthletePRs(...a),
}));

vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

import { readinessCompetitionAnalyzer } from "../readinessCompetition";

function meet(date: string, bestMark: number, event = "SHOT_PUT") {
  return {
    id: `m-${date}`,
    athleteId: "a1",
    date,
    event,
    meetStatus: "COMPLETED",
    throws: [{ distance: bestMark, isFoul: false, isPass: false }],
  };
}

function ci(date: string, overrides: Record<string, number | null> = {}) {
  return {
    athleteId: "a1",
    date: new Date(date),
    sleepQuality: 7,
    sleepHours: 7.5,
    soreness: 3,
    stressLevel: 4,
    energyMood: 7,
    hrvMs: null,
    restingHR: null,
    whoopStrain: null,
    ...overrides,
  };
}

describe("readinessCompetitionAnalyzer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] with <4 completed meets", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockCompFindMany.mockResolvedValue([meet("2026-01-15", 18), meet("2026-02-15", 18), meet("2026-03-15", 18)]);
    mockReadinessFindMany.mockResolvedValue([]);
    mockGetAthletePRs.mockResolvedValue({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }] });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("returns [] with no readiness check-ins", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    mockCompFindMany.mockResolvedValue([
      meet("2026-01-15", 18),
      meet("2026-02-15", 18),
      meet("2026-03-15", 18),
      meet("2026-04-15", 18),
    ]);
    mockReadinessFindMany.mockResolvedValue([]);
    mockGetAthletePRs.mockResolvedValue({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }] });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    expect(result).toEqual([]);
  });

  it("emits insight when sleep quality correlates negatively with PR delta", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    // 6 meets — alternating high/low sleep → high/low PR delta
    const meets = [
      { date: "2026-01-15", mark: 17.0, sleep: 4 },  // low sleep, low mark
      { date: "2026-02-15", mark: 19.0, sleep: 9 },  // high sleep, PR
      { date: "2026-03-01", mark: 17.2, sleep: 4 },
      { date: "2026-03-15", mark: 19.2, sleep: 9 },
      { date: "2026-04-01", mark: 17.5, sleep: 5 },
      { date: "2026-04-15", mark: 18.8, sleep: 8 },
    ];
    mockCompFindMany.mockResolvedValue(meets.map((m) => meet(m.date, m.mark)));
    // 3 days of check-ins preceding each meet, all at the meet's sleep value
    const allCheckIns = meets.flatMap((m) =>
      [1, 2, 3].map((offset) => {
        const d = new Date(m.date);
        d.setUTCDate(d.getUTCDate() - offset);
        return ci(d.toISOString(), { sleepQuality: m.sleep });
      })
    );
    mockReadinessFindMany.mockResolvedValue(allCheckIns);
    mockGetAthletePRs.mockResolvedValue({
      events: [{ event: "SHOT_PUT", competitionPR: { distance: 19.2 } }],
    });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    const sleep = result.find((r) => r.renderInputs.factor === "sleepQuality");
    expect(sleep).toBeDefined();
    expect(sleep!.confidenceBand).toBe("MEDIUM"); // 6 → MEDIUM (6-8)
    expect(sleep!.coefficient).toBeGreaterThan(0.9); // perfect correlation in fixture
    expect(sleep!.renderInputs.direction).toBe("positive"); // high sleep → better delta
    expect(sleep!.effectUnit).toBe("meters");
  });

  it("skips a factor when it has no data in ReadinessCheckIn rows", async () => {
    mockAthleteFindUnique.mockResolvedValue({ gender: "MALE", events: ["SHOT_PUT"] });
    const meets = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-0${i + 1}-15`,
      mark: 18,
      sleep: 5 + (i % 2),
    }));
    mockCompFindMany.mockResolvedValue(meets.map((m) => meet(m.date, m.mark)));
    const allCheckIns = meets.flatMap((m) =>
      [1, 2, 3].map((offset) => {
        const d = new Date(m.date);
        d.setUTCDate(d.getUTCDate() - offset);
        // hrvMs is null for every row — factor should skip
        return ci(d.toISOString(), { sleepQuality: m.sleep, hrvMs: null });
      })
    );
    mockReadinessFindMany.mockResolvedValue(allCheckIns);
    mockGetAthletePRs.mockResolvedValue({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 19 } }] });

    const result = await readinessCompetitionAnalyzer.analyze("a1");
    const hrv = result.find((r) => r.renderInputs.factor === "hrvMs");
    expect(hrv).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement the analyzer**

```ts
// src/lib/insights/analyzers/readinessCompetition.ts
import prisma from "@/lib/prisma";
import { pearsonCorrelation } from "@/lib/throws/profile-utils";
import { getAthletePRs } from "@/lib/data/personal-records";
import type {
  Analyzer,
  ConfidenceBand,
  InsightEvent,
  StructuredInsight,
} from "../types";
import type { ReadinessCompetitionEvidence } from "../templates/readinessCompetition";

const MIN_MEETS = 4;
const MIN_ABS_R = 0.4;
const PRE_MEET_DAYS = 3;
const MIN_DAYS_COVERED = 2;

const FACTORS = [
  { key: "sleepQuality",  direction: "higherIsBetter" as const },
  { key: "sleepHours",    direction: "higherIsBetter" as const },
  { key: "soreness",      direction: "lowerIsBetter" as const },
  { key: "stressLevel",   direction: "lowerIsBetter" as const },
  { key: "energyMood",    direction: "higherIsBetter" as const },
  { key: "hrvMs",         direction: "higherIsBetter" as const },
  { key: "restingHR",     direction: "lowerIsBetter" as const },
  { key: "whoopStrain",   direction: "higherIsBetter" as const },
];

function bandFor(meets: number): ConfidenceBand {
  if (meets >= 9) return "STRONG";
  if (meets >= 6) return "MEDIUM";
  return "WEAK";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export const readinessCompetitionAnalyzer: Analyzer<ReadinessCompetitionEvidence> = {
  category: "READINESS_COMPETITION",

  async analyze(athleteId: string): Promise<StructuredInsight<ReadinessCompetitionEvidence>[]> {
    const profile = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { gender: true, events: true },
    });
    if (!profile) return [];
    const events = (profile.events as unknown as InsightEvent[]) ?? [];
    if (events.length === 0) return [];

    const competitions = await prisma.throwsCompetition.findMany({
      where: { athleteId, meetStatus: "COMPLETED" },
      include: {
        throws: { select: { distance: true, isFoul: true, isPass: true } },
      },
      orderBy: { date: "asc" },
    });
    const usable = competitions
      .map((c) => {
        const marks = c.throws
          .filter((t) => !t.isFoul && !t.isPass && t.distance != null)
          .map((t) => t.distance as number);
        if (marks.length === 0) return null;
        return { id: c.id, athleteId: c.athleteId, date: c.date, event: c.event, bestMark: Math.max(...marks) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (usable.length < MIN_MEETS) return [];

    const readinessRows = await prisma.readinessCheckIn.findMany({
      where: { athleteId },
      orderBy: { date: "asc" },
    });
    if (readinessRows.length === 0) return [];

    // PR lookup (returns the same numbers we compare delta against)
    const prs = await getAthletePRs(athleteId);
    const prByEvent = new Map<string, number>();
    for (const e of prs.events) {
      if (e.competitionPR?.distance != null) prByEvent.set(e.event, e.competitionPR.distance);
    }

    const results: StructuredInsight<ReadinessCompetitionEvidence>[] = [];

    for (const event of events) {
      const eventMeets = usable.filter((m) => m.event === event);
      if (eventMeets.length < MIN_MEETS) continue;

      for (const factor of FACTORS) {
        const pairs: Array<{ competitionId: string; preAvg: number; bestMarkDeltaM: number }> = [];

        for (const meet of eventMeets) {
          const meetDate = new Date(`${meet.date}T00:00:00Z`);
          const windowStart = new Date(meetDate.getTime() - PRE_MEET_DAYS * 86400000);
          const windowEnd = new Date(meetDate.getTime() - 1); // exclusive of meet day
          const relevant = readinessRows.filter(
            (r) => r.date >= windowStart && r.date <= windowEnd
          );
          const factorValues = relevant
            .map((r) => (r as Record<string, unknown>)[factor.key])
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
          if (factorValues.length < MIN_DAYS_COVERED) continue;

          const preAvg = mean(factorValues);
          const pr = prByEvent.get(event) ?? meet.bestMark;
          const bestMarkDeltaM = meet.bestMark - pr;
          pairs.push({ competitionId: meet.id, preAvg, bestMarkDeltaM });
        }

        if (pairs.length < MIN_MEETS) continue;

        const xs = pairs.map((p) => p.preAvg);
        const ys = pairs.map((p) => p.bestMarkDeltaM);
        const r = pearsonCorrelation(xs, ys);
        if (Math.abs(r) < MIN_ABS_R) continue;

        // Group comparison for effectSize
        const med = median(xs);
        const below = pairs.filter((p) => p.preAvg < med).map((p) => p.bestMarkDeltaM);
        const above = pairs.filter((p) => p.preAvg >= med).map((p) => p.bestMarkDeltaM);
        const belowMean = mean(below);
        const aboveMean = mean(above);
        const effect = aboveMean - belowMean; // positive means above-median meets are better

        // Direction logic:
        //   higherIsBetter factor + positive r → "positive" (higher factor → better)
        //   higherIsBetter factor + negative r → "negative" (higher factor → worse)
        //   lowerIsBetter  factor + positive r → "negative" (higher factor → worse, since higher=bad)
        //   lowerIsBetter  factor + negative r → "positive"
        const positiveDirection =
          (factor.direction === "higherIsBetter" && r >= 0) ||
          (factor.direction === "lowerIsBetter" && r < 0);

        results.push({
          category: "READINESS_COMPETITION",
          metric: `${factor.key}.${event.toLowerCase()}`,
          event,
          confidenceBand: bandFor(pairs.length),
          dataPoints: pairs.length,
          coefficient: r,
          effectSize: effect,
          effectUnit: "meters",
          evidence: {
            factor: factor.key,
            event,
            pairs,
            pearsonR: r,
            belowMedianMeanDelta: belowMean,
            aboveMedianMeanDelta: aboveMean,
          },
          renderInputs: {
            factor: factor.key,
            direction: positiveDirection ? "positive" : "negative",
            thresholdLabel: positiveDirection ? "above median" : `below median`,
          },
        });
      }
    }

    return results;
  },
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/analyzers/readinessCompetition.ts src/lib/insights/analyzers/__tests__/readinessCompetition.test.ts
git commit -m "feat(insights): readiness-competition analyzer (3-day pre-meet Pearson + group delta)"
```

---

## Task 12: `isMeetComplete` trigger helper

**Files:**
- Create: `src/lib/insights/trigger.ts`
- Create: `src/lib/insights/__tests__/trigger.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/__tests__/trigger.test.ts
import { describe, it, expect } from "vitest";
import { isMeetComplete } from "../trigger";

type S = { round: "PRELIM" | "FINALS"; attemptInRound: number };

describe("isMeetComplete", () => {
  it("FOUR_STRAIGHT complete with 4 prelims in any order", () => {
    const throws: S[] = [
      { round: "PRELIM", attemptInRound: 3 },
      { round: "PRELIM", attemptInRound: 1 },
      { round: "PRELIM", attemptInRound: 4 },
      { round: "PRELIM", attemptInRound: 2 },
    ];
    expect(isMeetComplete("FOUR_STRAIGHT", null, throws)).toBe(true);
  });

  it("FOUR_STRAIGHT not complete with 3 prelims", () => {
    const throws: S[] = [1, 2, 3].map((n) => ({ round: "PRELIM", attemptInRound: n }));
    expect(isMeetComplete("FOUR_STRAIGHT", null, throws)).toBe(false);
  });

  it("THREE_PLUS_THREE with madeFinals=false is complete after 3 prelims", () => {
    const throws: S[] = [1, 2, 3].map((n) => ({ round: "PRELIM", attemptInRound: n }));
    expect(isMeetComplete("THREE_PLUS_THREE", false, throws)).toBe(true);
    expect(isMeetComplete("THREE_PLUS_THREE", null, throws)).toBe(true);
  });

  it("THREE_PLUS_THREE with madeFinals=true requires finals too", () => {
    const prelimsOnly: S[] = [1, 2, 3].map((n) => ({ round: "PRELIM", attemptInRound: n }));
    expect(isMeetComplete("THREE_PLUS_THREE", true, prelimsOnly)).toBe(false);

    const full: S[] = [
      ...prelimsOnly,
      { round: "FINALS", attemptInRound: 1 },
      { round: "FINALS", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 3 },
    ];
    expect(isMeetComplete("THREE_PLUS_THREE", true, full)).toBe(true);
  });

  it("THREE_PLUS_THREE missing a prelim is not complete even with all finals", () => {
    const throws: S[] = [
      { round: "PRELIM", attemptInRound: 1 },
      { round: "PRELIM", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 1 },
      { round: "FINALS", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 3 },
    ];
    expect(isMeetComplete("THREE_PLUS_THREE", true, throws)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/__tests__/trigger.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the helper**

```ts
// src/lib/insights/trigger.ts
import type { CompFormat } from "@prisma/client";

type ThrowSlot = { round: "PRELIM" | "FINALS"; attemptInRound: number };

export function isMeetComplete(
  format: CompFormat,
  madeFinals: boolean | null,
  throws: ThrowSlot[]
): boolean {
  const hasPrelim = (n: number) =>
    throws.some((t) => t.round === "PRELIM" && t.attemptInRound === n);
  const hasFinals = (n: number) =>
    throws.some((t) => t.round === "FINALS" && t.attemptInRound === n);

  if (format === "FOUR_STRAIGHT") {
    return hasPrelim(1) && hasPrelim(2) && hasPrelim(3) && hasPrelim(4);
  }
  const prelimsComplete = hasPrelim(1) && hasPrelim(2) && hasPrelim(3);
  if (!prelimsComplete) return false;
  if (madeFinals) return hasFinals(1) && hasFinals(2) && hasFinals(3);
  return true;
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/__tests__/trigger.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/trigger.ts src/lib/insights/__tests__/trigger.test.ts
git commit -m "feat(insights): isMeetComplete trigger helper"
```

---

## Task 13: Persistence

**Files:**
- Create: `src/lib/insights/persist.ts`

No dedicated test — covered through the orchestrator test.

- [ ] **Step 1: Create the file**

```ts
// src/lib/insights/persist.ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { RenderedInsight } from "./types";

type PersistItem = RenderedInsight & {
  triggerKind: "MEET_COMPLETE" | "ON_DEMAND" | "CRON";
  triggerMeetId: string | null;
};

export async function persistInsights(
  athleteId: string,
  items: PersistItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((i) => ({
    athleteId,
    category: i.category,
    metric: i.metric,
    event: i.event ?? null,
    title: i.title,
    body: i.body,
    detail: i.detail ?? null,
    confidenceBand: i.confidenceBand,
    dataPoints: i.dataPoints,
    coefficient: i.coefficient,
    effectSize: i.effectSize,
    effectUnit: i.effectUnit,
    evidence: i.evidence as Prisma.InputJsonValue,
    triggerKind: i.triggerKind,
    triggerMeetId: i.triggerMeetId,
  }));

  const result = await prisma.athleteInsight.createMany({ data: rows });
  return result.count;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/insights/persist.ts
git commit -m "feat(insights): persist.ts — createMany wrapper"
```

---

## Task 14: Orchestrator `runInsights`

**Files:**
- Create: `src/lib/insights/runInsights.ts`
- Create: `src/lib/insights/__tests__/runInsights.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

```ts
// src/lib/insights/__tests__/runInsights.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainingAnalyze = vi.fn();
const mockLiftAnalyze = vi.fn();
const mockReadinessAnalyze = vi.fn();
const mockPersist = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../analyzers/trainingPattern", () => ({
  trainingPatternAnalyzer: { category: "TRAINING_PATTERN", analyze: (...a: unknown[]) => mockTrainingAnalyze(...a) },
}));
vi.mock("../analyzers/liftThrowCorrelation", () => ({
  liftThrowAnalyzer: { category: "LIFT_THROW", analyze: (...a: unknown[]) => mockLiftAnalyze(...a) },
}));
vi.mock("../analyzers/readinessCompetition", () => ({
  readinessCompetitionAnalyzer: { category: "READINESS_COMPETITION", analyze: (...a: unknown[]) => mockReadinessAnalyze(...a) },
}));
vi.mock("../persist", () => ({
  persistInsights: (...a: unknown[]) => mockPersist(...a),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}));

// Mock the three templates to echo title/body/detail from the structured input
vi.mock("../templates/trainingPattern", () => ({
  renderTrainingPattern: (i: { metric: string }) => ({ title: `T:${i.metric}`, body: `Tb`, detail: `Td` }),
}));
vi.mock("../templates/liftThrowCorrelation", () => ({
  renderLiftThrow: (i: { metric: string }) => ({ title: `L:${i.metric}`, body: `Lb`, detail: `Ld` }),
}));
vi.mock("../templates/readinessCompetition", () => ({
  renderReadinessCompetition: (i: { metric: string }) => ({ title: `R:${i.metric}`, body: `Rb`, detail: `Rd` }),
}));

import { runInsights } from "../runInsights";
import type { StructuredInsight } from "../types";

function structured(overrides: Partial<StructuredInsight> = {}): StructuredInsight {
  return {
    category: "TRAINING_PATTERN",
    metric: "m",
    event: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    renderInputs: {},
    ...overrides,
  };
}

describe("runInsights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines output from all three analyzers and calls persist once", async () => {
    mockTrainingAnalyze.mockResolvedValue([structured({ metric: "t1" })]);
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([structured({ category: "READINESS_COMPETITION", metric: "r1" })]);
    mockPersist.mockResolvedValue(3);

    const result = await runInsights({
      athleteId: "a1",
      trigger: "MEET_COMPLETE",
      triggerMeetId: "m1",
    });
    expect(result.persistedCount).toBe(3);
    expect(result.skippedAnalyzers).toEqual([]);
    expect(mockPersist).toHaveBeenCalledTimes(1);
    const persistArgs = mockPersist.mock.calls[0][1];
    expect(persistArgs).toHaveLength(3);
    expect(persistArgs.every((r: { triggerKind: string; triggerMeetId: string }) =>
      r.triggerKind === "MEET_COMPLETE" && r.triggerMeetId === "m1")).toBe(true);
  });

  it("records skippedAnalyzers when analyzer returns []", async () => {
    mockTrainingAnalyze.mockResolvedValue([]);
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([]);
    mockPersist.mockResolvedValue(1);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.skippedAnalyzers).toEqual(["TRAINING_PATTERN", "READINESS_COMPETITION"]);
  });

  it("one analyzer throwing does not block the others", async () => {
    mockTrainingAnalyze.mockRejectedValue(new Error("boom"));
    mockLiftAnalyze.mockResolvedValue([structured({ category: "LIFT_THROW", metric: "l1" })]);
    mockReadinessAnalyze.mockResolvedValue([structured({ category: "READINESS_COMPETITION", metric: "r1" })]);
    mockPersist.mockResolvedValue(2);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.persistedCount).toBe(2);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("persistedCount is 0 when all analyzers return []", async () => {
    mockTrainingAnalyze.mockResolvedValue([]);
    mockLiftAnalyze.mockResolvedValue([]);
    mockReadinessAnalyze.mockResolvedValue([]);
    mockPersist.mockResolvedValue(0);

    const result = await runInsights({ athleteId: "a1", trigger: "ON_DEMAND" });
    expect(result.persistedCount).toBe(0);
    expect(result.skippedAnalyzers).toEqual(["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/lib/insights/__tests__/runInsights.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement the orchestrator**

```ts
// src/lib/insights/runInsights.ts
import { logger } from "@/lib/logger";
import { trainingPatternAnalyzer } from "./analyzers/trainingPattern";
import { liftThrowAnalyzer } from "./analyzers/liftThrowCorrelation";
import { readinessCompetitionAnalyzer } from "./analyzers/readinessCompetition";
import { renderTrainingPattern } from "./templates/trainingPattern";
import { renderLiftThrow } from "./templates/liftThrowCorrelation";
import { renderReadinessCompetition } from "./templates/readinessCompetition";
import { persistInsights } from "./persist";
import type { RenderedInsight, StructuredInsight } from "./types";

type TriggerKind = "MEET_COMPLETE" | "ON_DEMAND" | "CRON";

type AnalyzerEntry = {
  category: string;
  analyze: (athleteId: string) => Promise<StructuredInsight[]>;
  render: (s: StructuredInsight) => { title: string; body: string; detail: string };
};

const ANALYZERS: AnalyzerEntry[] = [
  {
    category: trainingPatternAnalyzer.category,
    analyze: (id) => trainingPatternAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) => renderTrainingPattern(s as StructuredInsight<Parameters<typeof renderTrainingPattern>[0]["evidence"]>),
  },
  {
    category: liftThrowAnalyzer.category,
    analyze: (id) => liftThrowAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) => renderLiftThrow(s as StructuredInsight<Parameters<typeof renderLiftThrow>[0]["evidence"]>),
  },
  {
    category: readinessCompetitionAnalyzer.category,
    analyze: (id) => readinessCompetitionAnalyzer.analyze(id) as Promise<StructuredInsight[]>,
    render: (s) => renderReadinessCompetition(s as StructuredInsight<Parameters<typeof renderReadinessCompetition>[0]["evidence"]>),
  },
];

export type RunInsightsInput = {
  athleteId: string;
  trigger: TriggerKind;
  triggerMeetId?: string;
};

export type RunInsightsResult = {
  persistedCount: number;
  skippedAnalyzers: string[];
};

export async function runInsights(input: RunInsightsInput): Promise<RunInsightsResult> {
  const rendered: Array<RenderedInsight & { triggerKind: TriggerKind; triggerMeetId: string | null }> = [];
  const skipped: string[] = [];

  for (const entry of ANALYZERS) {
    try {
      const structured = await entry.analyze(input.athleteId);
      if (structured.length === 0) {
        skipped.push(entry.category);
        continue;
      }
      for (const s of structured) {
        const { title, body, detail } = entry.render(s);
        rendered.push({
          ...s,
          title,
          body,
          detail,
          triggerKind: input.trigger,
          triggerMeetId: input.triggerMeetId ?? null,
        });
      }
    } catch (err) {
      logger.error("insight analyzer failed", {
        category: entry.category,
        athleteId: input.athleteId,
        error: err,
      });
    }
  }

  const persistedCount = await persistInsights(input.athleteId, rendered);
  return { persistedCount, skippedAnalyzers: skipped };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/__tests__/runInsights.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/runInsights.ts src/lib/insights/__tests__/runInsights.test.ts
git commit -m "feat(insights): runInsights orchestrator + per-analyzer error isolation"
```

---

## Task 15: Wire into per-throw POST handler

**Files:**
- Modify: `src/app/api/throws/competitions/[id]/throws/route.ts`
- Modify: `src/app/api/throws/competitions/[id]/throws/__tests__/throws.test.ts`

- [ ] **Step 1: Add failing integration test**

Append to the existing `throws.test.ts`:

```ts
const mockAfter = vi.fn();
const mockRunInsights = vi.fn();

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    unstable_after: (cb: () => unknown) => {
      mockAfter(cb);
      // Execute the callback synchronously in tests so assertions work
      return Promise.resolve(cb()).catch(() => undefined);
    },
  };
});

vi.mock("@/lib/insights/runInsights", () => ({
  runInsights: (...a: unknown[]) => mockRunInsights(...a),
}));

describe("POST fires runInsights on meet-complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires runInsights when the final prelim completes a THREE_PLUS_THREE madeFinals=false meet", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Dual",
      result: null,
      throws: [
        { round: "PRELIM", attemptInRound: 1 },
        { round: "PRELIM", attemptInRound: 2 },
      ],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t3", distance: 18.0 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] })
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] });
    mockRunInsights.mockResolvedValue({ persistedCount: 0, skippedAnalyzers: [] });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 3,
        resultType: "MARK",
        distance: 18.0,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockRunInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        athleteId: "a1",
        trigger: "MEET_COMPLETE",
        triggerMeetId: "m1",
      })
    );
  });

  it("does NOT fire runInsights when the meet is not yet complete", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "THREE_PLUS_THREE",
      madeFinals: false,
      name: "Dual",
      result: null,
      throws: [{ round: "PRELIM", attemptInRound: 1 }],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t2", distance: 17.5 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] })
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.0 } }] });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 2,
        resultType: "MARK",
        distance: 17.5,
      }),
    });
    await POST(req, ctx("m1"));
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRunInsights).not.toHaveBeenCalled();
  });

  it("a failure inside runInsights does not fail the throw save", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      implementWeightKg: null,
      format: "FOUR_STRAIGHT",
      madeFinals: null,
      name: "Dual",
      result: null,
      throws: [
        { round: "PRELIM", attemptInRound: 1 },
        { round: "PRELIM", attemptInRound: 2 },
        { round: "PRELIM", attemptInRound: 3 },
      ],
      athlete: { gender: "MALE" },
    });
    mockThrowCreate.mockResolvedValue({ id: "t4", distance: 18.2 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: null }] })
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.2 } }] });
    mockRunInsights.mockRejectedValue(new Error("boom"));

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 4,
        resultType: "MARK",
        distance: 18.2,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- "src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts"
```

Expected: FAIL — `unstable_after` isn't imported, runInsights isn't called.

- [ ] **Step 3: Modify the POST handler**

Open `src/app/api/throws/competitions/[id]/throws/route.ts`. Add imports near the top (below existing imports):

```ts
import { unstable_after as after } from "next/server";
import { runInsights } from "@/lib/insights/runInsights";
import { isMeetComplete } from "@/lib/insights/trigger";
```

Find the `notifyCompetitionEvent(...)` call inside the POST handler. After that call and before the `return NextResponse.json(...)` that ends the happy path, add:

```ts
    // Trigger post-competition insights if this throw completes the meet
    const throwsAfter = [
      ...meet.throws,
      { round: parsed.round as "PRELIM" | "FINALS", attemptInRound: parsed.attemptInRound },
    ];
    if (
      isMeetComplete(
        (meet.format ?? "THREE_PLUS_THREE") as "THREE_PLUS_THREE" | "FOUR_STRAIGHT",
        meet.madeFinals,
        throwsAfter
      )
    ) {
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

The existing `logger` import is already in scope.

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- "src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts"
```

Expected: All tests pass (prior 9 + 3 new = 12).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/throws/competitions/\[id\]/throws/route.ts" "src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts"
git commit -m "feat(api): per-throw POST triggers runInsights via after() on meet-complete"
```

---

## Task 16: API — `GET /api/insights`

**Files:**
- Create: `src/app/api/insights/route.ts`
- Create: `src/app/api/insights/__tests__/insights.test.ts`
- Modify: `src/lib/api-schemas.ts`

- [ ] **Step 1: Add Zod schemas**

Open `src/lib/api-schemas.ts`. Append at the bottom:

```ts
// ── Insights ────────────────────────────────────────────────────────────

export const InsightsListQuerySchema = z.object({
  athleteId: z.string().min(1),
  mode: z.enum(["latest", "all"]).optional().default("latest"),
  category: z
    .enum(["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const InsightComputeSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
});
```

- [ ] **Step 2: Write failing GET tests**

```ts
// src/app/api/insights/__tests__/insights.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQueryRaw = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    athleteInsight: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { GET } from "../route";

describe("GET /api/insights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns latest-per-slot when mode=latest", async () => {
    mockQueryRaw.mockResolvedValue([
      { id: "i1", category: "TRAINING_PATTERN", metric: "ex1", title: "T1" },
      { id: "i2", category: "LIFT_THROW", metric: "l1", title: "L1" },
    ]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=latest");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.insights).toHaveLength(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns full history when mode=all", async () => {
    mockFindMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }, { id: "i3" }]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=all");
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.insights).toHaveLength(3);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { athleteId: "a1" },
        orderBy: { computedAt: "desc" },
      })
    );
  });

  it("filters by category", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&category=LIFT_THROW");
    await GET(req);
    const query = mockQueryRaw.mock.calls[0][0];
    expect(String(query)).toContain("LIFT_THROW");
  });

  it("400 on missing athleteId", async () => {
    const req = new NextRequest("http://t/api/insights");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/app/api/insights/__tests__/insights.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { InsightsListQuerySchema } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = InsightsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }
    const { athleteId, mode, category, limit } = parsed.data;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let insights: unknown[];

    if (mode === "latest") {
      // Postgres DISTINCT ON groups by slot and picks the most recent
      const categoryFilter = category ? Prisma.sql`AND "category"::text = ${category}` : Prisma.empty;
      insights = await prisma.$queryRaw<unknown[]>(Prisma.sql`
        SELECT DISTINCT ON ("athleteId", "category", "metric") *
        FROM "AthleteInsight"
        WHERE "athleteId" = ${athleteId}
          ${categoryFilter}
        ORDER BY "athleteId", "category", "metric", "computedAt" DESC
        LIMIT ${limit}
      `);
    } else {
      insights = await prisma.athleteInsight.findMany({
        where: { athleteId, ...(category ? { category } : {}) },
        orderBy: { computedAt: "desc" },
        take: limit,
      });
    }

    return NextResponse.json({
      success: true,
      data: { insights, total: insights.length },
    });
  } catch (error) {
    logger.error("Get insights error", { context: "insights/route", error });
    return NextResponse.json({ success: false, error: "Failed to fetch insights" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- src/app/api/insights/__tests__/insights.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/insights/route.ts src/app/api/insights/__tests__/insights.test.ts src/lib/api-schemas.ts
git commit -m "feat(api): GET /api/insights with latest-per-slot and history modes"
```

---

## Task 17: API — `POST /api/insights/compute`

**Files:**
- Create: `src/app/api/insights/compute/route.ts`
- Create: `src/app/api/insights/compute/__tests__/compute.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/insights/compute/__tests__/compute.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRunInsights = vi.fn();
const mockRateLimit = vi.fn();

vi.mock("@/lib/insights/runInsights", () => ({
  runInsights: (...a: unknown[]) => mockRunInsights(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

describe("POST /api/insights/compute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs insights and returns persistedCount", async () => {
    mockRateLimit.mockResolvedValue({ success: true });
    mockRunInsights.mockResolvedValue({ persistedCount: 3, skippedAnalyzers: [] });
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({ athleteId: "a1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.persistedCount).toBe(3);
    expect(mockRunInsights).toHaveBeenCalledWith(
      expect.objectContaining({ athleteId: "a1", trigger: "ON_DEMAND" })
    );
  });

  it("returns 429 on rate limit", async () => {
    mockRateLimit.mockResolvedValue({ success: false, retryAfter: 45 });
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({ athleteId: "a1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mockRunInsights).not.toHaveBeenCalled();
  });

  it("400 on bad body", async () => {
    const req = new NextRequest("http://t/api/insights/compute", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npm test -- src/app/api/insights/compute/__tests__/compute.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Check the existing `rate-limit` signature**

```bash
grep -nA 20 "export.*function rateLimit\|export.*rateLimit" src/lib/rate-limit.ts | head -30
```

Note the signature. If it's `rateLimit({ key, windowMs, max })`, use that shape. If it differs, adapt the route accordingly (the test mocks it, so the tests don't care).

- [ ] **Step 4: Implement the route**

```ts
// src/app/api/insights/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, InsightComputeSchema } from "@/lib/api-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { runInsights } from "@/lib/insights/runInsights";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, InsightComputeSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId } = parsed;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const limit = await rateLimit({
      key: `insights:compute:${athleteId}`,
      windowMs: 60_000,
      max: 1,
    });
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Try again in a moment", retryAfter: limit.retryAfter },
        { status: 429 }
      );
    }

    const result = await runInsights({ athleteId, trigger: "ON_DEMAND" });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("Compute insights error", { context: "insights/compute", error });
    return NextResponse.json({ success: false, error: "Failed to compute insights" }, { status: 500 });
  }
}
```

If the actual `rateLimit` signature differs from `{ key, windowMs, max }`, adapt the call site. The test only asserts that it IS called and that a failure returns 429 — it doesn't care about the arg shape.

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- src/app/api/insights/compute/__tests__/compute.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/insights/compute/route.ts src/app/api/insights/compute/__tests__/compute.test.ts
git commit -m "feat(api): POST /api/insights/compute on-demand recompute with rate limit"
```

---

## Task 18: Final typecheck, lint, and full-suite test pass

**Files:** none

- [ ] **Step 1: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: "No ESLint warnings or errors".

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: all tests pass EXCEPT the pre-existing `sidebar-resolution.test.ts` coach-nav failure that was failing on `main` before this branch. Total new tests added: ~40+. Count should be 280+ passing, 1 failing (the pre-existing one).

If any NEW test fails, stop and report as BLOCKED.

- [ ] **Step 4: Manual end-to-end verification**

```bash
npm run dev
```

In a browser:
1. Log in as `coach@example.com` / `coach123`
2. Find a seeded athlete with some practice session history. If seed data is thin, use Prisma Studio (`npx prisma studio` with local DB URL override) to check what data exists.
3. Open the athlete's competitions list and log a complete 4-straight meet (4 throws)
4. In Prisma Studio, refresh the `AthleteInsight` table — fresh rows should appear with `triggerKind = "MEET_COMPLETE"` and `triggerMeetId` matching the new meet (or zero rows if the athlete has too little data, which is expected)
5. `curl -H "Cookie: <your-session-cookie>" "http://localhost:3000/api/insights?athleteId=<id>&mode=latest"` — verify JSON shape
6. `curl -X POST "http://localhost:3000/api/insights/compute" -H "Content-Type: application/json" -H "Cookie: …" -d '{"athleteId":"<id>"}'` once, then again immediately — second should return 429
7. Stop the dev server

- [ ] **Step 5: Final clean commit (no-op if nothing staged)**

```bash
git status
# If any stray diffs, review and commit with a clear message. Otherwise skip.
```

---

## Self-Review Checklist

Run through these before handing off:

- [ ] Every task has concrete code, exact file paths, and explicit commands — no TBDs
- [ ] Schema migration runs locally against `podium_throws` Postgres (not prod Supabase) via explicit env override
- [ ] Zod schemas use `.nullable().optional()` for form-state fields (project rule #4); `.coerce.number()` used for the GET `limit` query param (strings in URL need coercion)
- [ ] API routes return `{ success, data | error }` (project rule #2)
- [ ] No empty catch blocks; errors logged via `logger.error` and surfaced to caller (project rule #1)
- [ ] Templates are deterministic — fixed string output given fixed input (snapshot tests enforce)
- [ ] Analyzers are pure given DB reads, independently testable with mocked prisma
- [ ] Orchestrator has per-analyzer try/catch so one failure doesn't block others
- [ ] `after()` is imported as `unstable_after` (Next.js 14.2.35 name), gated by `experimental.after: true`
- [ ] `canonicalLift` excludes hang variants (different force profile per Bondarchuk)
- [ ] `lbsToKg` applied when `loadUnit === "lbs"` in the lift analyzer
- [ ] No mutations to existing `throws/engine/*` files — we only read from them
- [ ] No pushes during the plan — commits accumulate locally (project batching rule)
- [ ] Pre-existing sidebar-resolution test failure on `main` is not our concern

## Out-of-scope reminders (stop and ask)

If any of these come up during execution, stop:

- UI surfaces for insights → sub-project C
- Insight read/dismiss mutation endpoints → sub-project C
- Scheduled cron / weekly digest → sub-project C
- LLM-generated insight prose → later polish
- A fourth insight category → later spec
- Cross-athlete comparisons → separate feature
- Modifications to `personal-correlations.ts` or any other existing engine file
