# Competition Logging v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship structured per-throw competition logging — round, attempt-in-round, mark/foul/pass discriminated union, per-meet context (place, weather, wind, venue, implement override), automatic PR detection + notifications, and a lazy legacy-data promotion path.

**Architecture:** Extend `ThrowLog` with nullable competition columns so it remains the single source of truth for every throw. Extend `ThrowsCompetition` with per-meet context; keep the legacy `result: Float?` for existing rows behind a banner. Unified PR resolver (`personal-records.ts`) needs no logic change — it already filters `isCompetition` and resolves competition-weight PRs — but gains one additive derived field (`bestLoggedCompThrow`) for a new UI badge. Per-throw mutations save on row-blur, one row = one POST/PATCH; server-side PR detection runs before and after each write and returns a `prCelebration` payload for the client to celebrate.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma + Postgres, Zod, vitest, React Testing Library, Tailwind + custom component library, existing `createNotification` + `canAccessAthlete` + `{ success, data | error }` envelope.

**Spec:** `docs/superpowers/specs/2026-04-16-competition-logging-v2-design.md`

---

## File Plan

### New files

| Path                                                                    | Responsibility                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/competitions/parseDistance.ts`                                 | ft+in ↔ meters parser mirroring `formatImplementWeight` pattern     |
| `src/lib/competitions/__tests__/parseDistance.test.ts`                  | unit tests for parser                                               |
| `src/lib/competitions/validate.ts`                                      | slot/format/result-type invariants shared by API + UI               |
| `src/lib/competitions/__tests__/validate.test.ts`                       | unit tests for validators                                           |
| `src/lib/competitions/notify.ts`                                        | PR + meet-logged notification helper                                |
| `src/lib/competitions/__tests__/notify.test.ts`                         | vitest mocks + behaviour tests                                      |
| `src/app/api/throws/competitions/[id]/throws/route.ts`                  | per-throw CRUD                                                      |
| `src/app/api/throws/competitions/[id]/promote-legacy/route.ts`          | legacy-result → `competitionPRs` JSON writer                        |
| `src/app/api/throws/competitions/__tests__/competitions.test.ts`        | meet + per-throw + promote-legacy integration tests (mocked prisma) |
| `src/components/competitions/CompetitionThrowsTable.tsx`                | main per-throw editor                                               |
| `src/components/competitions/CompetitionMeetHeader.tsx`                 | inline-editable meet header                                         |
| `src/components/competitions/CompetitionListCard.tsx`                   | list tile                                                           |
| `src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx` | RTL tests                                                           |
| `src/app/(dashboard)/coach/competitions/[id]/page.tsx`                  | coach meet detail (replaces `/results`)                             |
| `src/app/(dashboard)/athlete/competitions/page.tsx`                     | athlete meet list                                                   |
| `src/app/(dashboard)/athlete/competitions/[id]/page.tsx`                | athlete meet detail                                                 |

### Modified files

| Path                                                              | What changes                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                            | add 5 enums; extend `ThrowsCompetition` + `ThrowLog`                                                                                                    |
| `src/lib/api-schemas.ts`                                          | extend `CompetitionCreateSchema` + `CompetitionUpdateSchema`; add `CompetitionThrowCreateSchema`, `CompetitionThrowUpdateSchema`, `LegacyPromoteSchema` |
| `src/lib/data/personal-records.ts`                                | add `bestLoggedCompThrow` to `AthletePREvent` type + compute in resolver                                                                                |
| `src/lib/notifications.ts`                                        | add `COMPETITION_PR` + `COMPETITION_LOGGED` to `NotificationType` union                                                                                 |
| `src/app/api/throws/competitions/route.ts`                        | extend POST/PATCH with new context fields; GET adds `_count.throws` + derived `bestMark`; new DELETE                                                    |
| `src/app/(dashboard)/coach/competitions/_add-meet-modal.tsx`      | add venue/weather/wind/place/status/format/implement-weight inputs                                                                                      |
| `src/app/(dashboard)/coach/competitions/page.tsx`                 | use new list card; show new badges                                                                                                                      |
| `src/app/(dashboard)/coach/competitions/_competitions-client.tsx` | route clicks to `/coach/competitions/[id]` instead of `/results`                                                                                        |

### Deleted files

| Path                                                              | Why                                     |
| ----------------------------------------------------------------- | --------------------------------------- |
| `src/app/(dashboard)/coach/competitions/results/` (entire folder) | Replaced by `/coach/competitions/[id]/` |

---

## Task 1: parseDistance — ft+in ↔ meters parser

**Files:**

- Create: `src/lib/competitions/parseDistance.ts`
- Test: `src/lib/competitions/__tests__/parseDistance.test.ts`

- [ ] **Step 1: Create the test file with failing tests**

```ts
// src/lib/competitions/__tests__/parseDistance.test.ts
import { describe, it, expect } from "vitest";
import { parseDistance, formatDistance } from "../parseDistance";

describe("parseDistance", () => {
  it("parses bare meters", () => {
    expect(parseDistance("18.42")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
    expect(parseDistance("18.42m")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
    expect(parseDistance(" 18.42 m ")).toEqual({ meters: 18.42, unit: "m", original: 18.42 });
  });

  it("parses feet + inches with quote notation", () => {
    // 60'4" = 60 ft + 4 in = 720 + 4 = 724 in = 18.389... m
    const r = parseDistance(`60'4"`);
    expect(r?.unit).toBe("ft");
    expect(r?.original).toBe(60.333333333333336); // 60 + 4/12 ft (exact for display)
    expect(r?.meters).toBeCloseTo(18.3896, 3);
  });

  it("parses feet + inches with dash notation", () => {
    const r = parseDistance("60-4");
    expect(r?.unit).toBe("ft");
    expect(r?.meters).toBeCloseTo(18.3896, 3);
  });

  it("parses whole feet with ft suffix", () => {
    const r = parseDistance("60ft");
    expect(r?.unit).toBe("ft");
    expect(r?.original).toBe(60);
    expect(r?.meters).toBeCloseTo(18.288, 3);
  });

  it("rejects garbage", () => {
    expect(parseDistance("")).toBeNull();
    expect(parseDistance("abc")).toBeNull();
    expect(parseDistance("-5")).toBeNull();
    expect(parseDistance("60'15\"")).toBeNull(); // inches >= 12 invalid
  });
});

describe("formatDistance", () => {
  it("formats meters", () => {
    expect(formatDistance(18.42, "m")).toBe("18.42m");
  });

  it("formats feet as ft'in\"", () => {
    expect(formatDistance(18.3896, "ft")).toBe(`60'4"`);
  });

  it("renders dash for null", () => {
    expect(formatDistance(null, "m")).toBe("—");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- src/lib/competitions/__tests__/parseDistance.test.ts`
Expected: all tests fail with "Cannot find module '../parseDistance'"

- [ ] **Step 3: Implement parseDistance**

```ts
// src/lib/competitions/parseDistance.ts
/**
 * Parse a distance input string into canonical meters + retained original for display.
 * Accepts:
 *   "18.42"      → meters
 *   "18.42m"     → meters
 *   "60'4\""     → ft + in
 *   "60-4"       → ft + in (dash notation)
 *   "60ft"       → whole feet
 */

const M_PER_FT = 0.3048;
const IN_PER_FT = 12;

export type ParsedDistance = {
  meters: number;
  unit: "m" | "ft";
  original: number; // value in original unit (for round-trip display)
};

export function parseDistance(raw: string | null | undefined): ParsedDistance | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s.length === 0) return null;

  // Feet + inches: 60'4" or 60-4
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|-)\s*(\d+(?:\.\d+)?)\s*"?$/);
  if (ftIn) {
    const ft = parseFloat(ftIn[1]);
    const inches = parseFloat(ftIn[2]);
    if (!Number.isFinite(ft) || !Number.isFinite(inches) || inches < 0 || inches >= IN_PER_FT)
      return null;
    const totalFt = ft + inches / IN_PER_FT;
    return { meters: totalFt * M_PER_FT, unit: "ft", original: totalFt };
  }

  // Whole feet with ft suffix
  const ftOnly = s.match(/^(\d+(?:\.\d+)?)\s*ft$/);
  if (ftOnly) {
    const ft = parseFloat(ftOnly[1]);
    if (!Number.isFinite(ft) || ft <= 0) return null;
    return { meters: ft * M_PER_FT, unit: "ft", original: ft };
  }

  // Meters (with optional m suffix)
  const meters = s.match(/^(\d+(?:\.\d+)?)\s*m?$/);
  if (meters) {
    const m = parseFloat(meters[1]);
    if (!Number.isFinite(m) || m <= 0) return null;
    return { meters: m, unit: "m", original: m };
  }

  return null;
}

export function formatDistance(meters: number | null | undefined, unit: "m" | "ft"): string {
  if (meters == null) return "—";
  if (unit === "m") {
    return `${parseFloat(meters.toFixed(2))}m`;
  }
  // feet: convert and split into ft + inches
  const totalFt = meters / M_PER_FT;
  const ft = Math.floor(totalFt);
  const inches = Math.round((totalFt - ft) * IN_PER_FT);
  // Handle inch rollover (e.g. 11.999... → 12)
  if (inches === IN_PER_FT) return `${ft + 1}'0"`;
  return `${ft}'${inches}"`;
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/lib/competitions/__tests__/parseDistance.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitions/parseDistance.ts src/lib/competitions/__tests__/parseDistance.test.ts
git commit -m "feat(competitions): distance parser (meters/ft-in)"
```

---

## Task 2: validate — slot / format / result-type invariants

**Files:**

- Create: `src/lib/competitions/validate.ts`
- Test: `src/lib/competitions/__tests__/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/competitions/__tests__/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateThrowSlot, validateResultInvariants } from "../validate";

describe("validateThrowSlot", () => {
  it("accepts THREE_PLUS_THREE prelims 1-3 and finals 1-3", () => {
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 1)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 3)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 1)).toBeNull();
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 3)).toBeNull();
  });

  it("rejects THREE_PLUS_THREE prelim 4 / finals 4", () => {
    expect(validateThrowSlot("THREE_PLUS_THREE", "PRELIM", 4)).toBe(
      "attemptInRound must be 1-3 for THREE_PLUS_THREE"
    );
    expect(validateThrowSlot("THREE_PLUS_THREE", "FINALS", 4)).toBe(
      "attemptInRound must be 1-3 for THREE_PLUS_THREE"
    );
  });

  it("accepts FOUR_STRAIGHT PRELIM 1-4", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(validateThrowSlot("FOUR_STRAIGHT", "PRELIM", n)).toBeNull();
    }
  });

  it("rejects FOUR_STRAIGHT FINALS or PRELIM 5+", () => {
    expect(validateThrowSlot("FOUR_STRAIGHT", "FINALS", 1)).toBe(
      "FOUR_STRAIGHT has no FINALS round"
    );
    expect(validateThrowSlot("FOUR_STRAIGHT", "PRELIM", 5)).toBe(
      "attemptInRound must be 1-4 for FOUR_STRAIGHT"
    );
  });
});

describe("validateResultInvariants", () => {
  it("MARK requires distance, null foul/pass", () => {
    expect(
      validateResultInvariants({
        resultType: "MARK",
        distance: 18.42,
        isFoul: false,
        isPass: false,
        foulType: null,
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "MARK",
        distance: null,
        isFoul: false,
        isPass: false,
        foulType: null,
      })
    ).toBe("MARK requires a distance");
  });

  it("FOUL requires foulType, null distance, isFoul=true", () => {
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: false,
        foulType: "RING",
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: false,
        foulType: null,
      })
    ).toBe("FOUL requires a foulType");
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: 15,
        isFoul: true,
        isPass: false,
        foulType: "RING",
      })
    ).toBe("FOUL cannot have a distance");
  });

  it("PASS requires no distance / foul / pass=true", () => {
    expect(
      validateResultInvariants({
        resultType: "PASS",
        distance: null,
        isFoul: false,
        isPass: true,
        foulType: null,
      })
    ).toBeNull();
    expect(
      validateResultInvariants({
        resultType: "PASS",
        distance: 15,
        isFoul: false,
        isPass: true,
        foulType: null,
      })
    ).toBe("PASS cannot have a distance");
  });

  it("rejects simultaneous foul + pass", () => {
    expect(
      validateResultInvariants({
        resultType: "FOUL",
        distance: null,
        isFoul: true,
        isPass: true,
        foulType: "RING",
      })
    ).toBe("isFoul and isPass cannot both be true");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/lib/competitions/__tests__/validate.test.ts`
Expected: FAIL with "Cannot find module '../validate'"

- [ ] **Step 3: Implement validate.ts**

```ts
// src/lib/competitions/validate.ts
export type CompFormat = "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
export type ThrowRound = "PRELIM" | "FINALS";
export type FoulType = "RING" | "SECTOR";
export type ResultType = "MARK" | "FOUL" | "PASS";

export function validateThrowSlot(
  format: CompFormat,
  round: ThrowRound,
  attemptInRound: number
): string | null {
  if (format === "FOUR_STRAIGHT") {
    if (round === "FINALS") return "FOUR_STRAIGHT has no FINALS round";
    if (attemptInRound < 1 || attemptInRound > 4)
      return "attemptInRound must be 1-4 for FOUR_STRAIGHT";
    return null;
  }
  // THREE_PLUS_THREE
  if (attemptInRound < 1 || attemptInRound > 3)
    return "attemptInRound must be 1-3 for THREE_PLUS_THREE";
  return null;
}

export type ResultShape = {
  resultType: ResultType;
  distance: number | null;
  isFoul: boolean;
  isPass: boolean;
  foulType: FoulType | null;
};

export function validateResultInvariants(r: ResultShape): string | null {
  if (r.isFoul && r.isPass) return "isFoul and isPass cannot both be true";

  switch (r.resultType) {
    case "MARK":
      if (r.distance == null) return "MARK requires a distance";
      if (r.isFoul) return "MARK cannot be a foul";
      if (r.isPass) return "MARK cannot be a pass";
      return null;
    case "FOUL":
      if (!r.isFoul) return "FOUL resultType requires isFoul=true";
      if (!r.foulType) return "FOUL requires a foulType";
      if (r.distance != null) return "FOUL cannot have a distance";
      return null;
    case "PASS":
      if (!r.isPass) return "PASS resultType requires isPass=true";
      if (r.distance != null) return "PASS cannot have a distance";
      if (r.foulType != null) return "PASS cannot have a foulType";
      return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/lib/competitions/__tests__/validate.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitions/validate.ts src/lib/competitions/__tests__/validate.test.ts
git commit -m "feat(competitions): slot + result-type invariant validators"
```

---

## Task 3: Schema migration — extend ThrowsCompetition + ThrowLog

**Files:**

- Modify: `prisma/schema.prisma`
- Generated: `prisma/migrations/<timestamp>_competition_logging_v2/migration.sql`

- [ ] **Step 1: Locate `ThrowsCompetition` and `ThrowLog` in `prisma/schema.prisma`**

Confirm `ThrowsCompetition` is near line 1684 and `ThrowLog` is near line 649. Search: `model ThrowsCompetition`, `model ThrowLog`.

- [ ] **Step 2: Add the new enums near the existing enum block**

Append to the enum section (after existing enums like `ProgramSource`, `NoteCategory`, `PhaseType`):

```prisma
enum MeetStatus {
  COMPLETED
  DNS
  DNF
  DQ
}

enum VenueType {
  INDOOR
  OUTDOOR
}

enum CompFormat {
  THREE_PLUS_THREE
  FOUR_STRAIGHT
}

enum ThrowRound {
  PRELIM
  FINALS
}

enum FoulType {
  RING
  SECTOR
}
```

- [ ] **Step 3: Extend `ThrowsCompetition`**

Replace the existing `ThrowsCompetition` model definition with:

```prisma
model ThrowsCompetition {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  name      String
  date      String // YYYY-MM-DD
  event     EventType
  priority  String         @default("B") // A, B, C — kept

  // Legacy single-result mode (preserved for existing rows)
  result    Float? // meters; null on new per-throw rows
  resultBy  String? // COACH | ATHLETE — kept for legacy rows

  // NEW per-meet context
  implementWeightKg Float?
  placeFinish       Int?
  meetStatus        MeetStatus  @default(COMPLETED)
  venueType         VenueType?
  weather           String?
  windMps           Float?
  notes             String?
  format            CompFormat? @default(THREE_PLUS_THREE)
  madeFinals        Boolean?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  throws ThrowLog[]

  @@index([athleteId, date])
}
```

- [ ] **Step 4: Extend `ThrowLog`**

Inside the existing `ThrowLog` model (do NOT replace existing fields), add these new columns above the `@@index` lines:

```prisma
  // NEW competition linkage (all nullable — practice rows leave null)
  competitionId   String?
  competition     ThrowsCompetition? @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  round           ThrowRound?
  attemptInRound  Int?
  isFoul          Boolean            @default(false)
  foulType        FoulType?
  isPass          Boolean            @default(false)
```

Then add one new index line alongside the existing ones:

```prisma
  @@index([competitionId])
```

- [ ] **Step 5: Run migration locally**

**IMPORTANT** per memory `feedback_never_seed_production.md`: override the DB URL to the local Postgres; do NOT run against `.env.local` (which has prod Supabase creds).

```bash
POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" \
POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" \
npx prisma migrate dev --name competition_logging_v2
```

Expected: migration created under `prisma/migrations/<timestamp>_competition_logging_v2/` and applied locally. Prisma client regenerated.

- [ ] **Step 6: Verify generated client has new types**

```bash
grep -E "MeetStatus|ThrowRound|FoulType|CompFormat" node_modules/.prisma/client/index.d.ts | head -10
```

Expected: enum type definitions visible.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): competition logging v2 — rounds, fouls, per-meet context"
```

---

## Task 4: Zod — extend CompetitionCreateSchema + CompetitionUpdateSchema

**Files:**

- Modify: `src/lib/api-schemas.ts`
- Test: add cases to existing `src/lib/__tests__/api-schemas.test.ts` (or create if missing)

- [ ] **Step 1: Check whether `api-schemas.test.ts` exists**

```bash
ls src/lib/__tests__/api-schemas.test.ts 2>/dev/null || echo "missing"
```

If missing, create it with this header:

```ts
// src/lib/__tests__/api-schemas.test.ts
import { describe, it, expect } from "vitest";
import * as S from "../api-schemas";
```

- [ ] **Step 2: Write failing tests for extended competition meet schemas**

Append to the test file:

```ts
describe("CompetitionCreateSchema (extended)", () => {
  const base = {
    athleteId: "a1",
    name: "NCAA East",
    date: "2026-05-15",
    event: "SHOT_PUT",
  };

  it("accepts all new optional fields", () => {
    const parsed = S.CompetitionCreateSchema.parse({
      ...base,
      implementWeightKg: 7.26,
      placeFinish: 3,
      meetStatus: "COMPLETED",
      venueType: "OUTDOOR",
      weather: "70°F sunny",
      windMps: -1.2,
      format: "THREE_PLUS_THREE",
      madeFinals: true,
    });
    expect(parsed.placeFinish).toBe(3);
    expect(parsed.windMps).toBe(-1.2);
  });

  it("accepts null for all new optional fields", () => {
    const parsed = S.CompetitionCreateSchema.parse({
      ...base,
      implementWeightKg: null,
      placeFinish: null,
      venueType: null,
      weather: null,
      windMps: null,
      format: null,
      madeFinals: null,
    });
    expect(parsed.placeFinish).toBeNull();
  });

  it("rejects placeFinish < 1", () => {
    expect(() => S.CompetitionCreateSchema.parse({ ...base, placeFinish: 0 })).toThrow();
  });

  it("rejects invalid meetStatus", () => {
    expect(() => S.CompetitionCreateSchema.parse({ ...base, meetStatus: "CANCELLED" })).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to confirm failure**

Run: `npm test -- src/lib/__tests__/api-schemas.test.ts`
Expected: FAIL — unknown keys rejected / no validation on new fields.

- [ ] **Step 4: Extend the schemas**

Open `src/lib/api-schemas.ts`. Find the existing `CompetitionCreateSchema` (near line 217). Replace with:

```ts
export const CompetitionCreateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  name: z.string().min(1, "Competition name is required"),
  date: z.string().min(1, "Date is required"),
  event: z.string().min(1, "Event is required"),
  priority: z.enum(["A", "B", "C"]).optional(),
  result: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),

  // v2 per-meet context (all nullable + optional per project rule #4)
  implementWeightKg: z.number().positive().nullable().optional(),
  placeFinish: z.number().int().min(1).nullable().optional(),
  meetStatus: z.enum(["COMPLETED", "DNS", "DNF", "DQ"]).nullable().optional(),
  venueType: z.enum(["INDOOR", "OUTDOOR"]).nullable().optional(),
  weather: z.string().max(200).nullable().optional(),
  windMps: z.number().nullable().optional(), // allow negative for headwind
  format: z.enum(["THREE_PLUS_THREE", "FOUR_STRAIGHT"]).nullable().optional(),
  madeFinals: z.boolean().nullable().optional(),
});

export const CompetitionUpdateSchema = z.object({
  id: z.string().min(1, "Competition ID is required"),

  // legacy editable fields
  result: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  resultBy: z.string().nullable().optional(),

  // v2 per-meet context
  name: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  priority: z.enum(["A", "B", "C"]).nullable().optional(),
  implementWeightKg: z.number().positive().nullable().optional(),
  placeFinish: z.number().int().min(1).nullable().optional(),
  meetStatus: z.enum(["COMPLETED", "DNS", "DNF", "DQ"]).nullable().optional(),
  venueType: z.enum(["INDOOR", "OUTDOOR"]).nullable().optional(),
  weather: z.string().max(200).nullable().optional(),
  windMps: z.number().nullable().optional(),
  format: z.enum(["THREE_PLUS_THREE", "FOUR_STRAIGHT"]).nullable().optional(),
  madeFinals: z.boolean().nullable().optional(),
});
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `npm test -- src/lib/__tests__/api-schemas.test.ts`
Expected: PASS, 4 new tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-schemas.ts src/lib/__tests__/api-schemas.test.ts
git commit -m "feat(schemas): extend competition meet schemas with v2 context"
```

---

## Task 5: Zod — per-throw and legacy-promote schemas

**Files:**

- Modify: `src/lib/api-schemas.ts`
- Test: `src/lib/__tests__/api-schemas.test.ts`

- [ ] **Step 1: Write failing tests for the discriminated union and promote schema**

Append to `src/lib/__tests__/api-schemas.test.ts`:

```ts
describe("CompetitionThrowCreateSchema (discriminated union)", () => {
  const base = { round: "PRELIM" as const, attemptInRound: 1 };

  it("accepts MARK with positive distance", () => {
    const r = S.CompetitionThrowCreateSchema.parse({
      ...base,
      resultType: "MARK",
      distance: 18.42,
    });
    expect(r.resultType).toBe("MARK");
  });

  it("accepts FOUL with foulType", () => {
    const r = S.CompetitionThrowCreateSchema.parse({
      ...base,
      resultType: "FOUL",
      foulType: "RING",
    });
    expect(r.resultType).toBe("FOUL");
  });

  it("accepts PASS with nothing else", () => {
    const r = S.CompetitionThrowCreateSchema.parse({ ...base, resultType: "PASS" });
    expect(r.resultType).toBe("PASS");
  });

  it("rejects MARK without distance", () => {
    expect(() => S.CompetitionThrowCreateSchema.parse({ ...base, resultType: "MARK" })).toThrow();
  });

  it("rejects negative distance", () => {
    expect(() =>
      S.CompetitionThrowCreateSchema.parse({ ...base, resultType: "MARK", distance: -5 })
    ).toThrow();
  });

  it("rejects FOUL without foulType", () => {
    expect(() => S.CompetitionThrowCreateSchema.parse({ ...base, resultType: "FOUL" })).toThrow();
  });

  it("rejects attemptInRound < 1", () => {
    expect(() =>
      S.CompetitionThrowCreateSchema.parse({ ...base, attemptInRound: 0, resultType: "PASS" })
    ).toThrow();
  });
});

describe("LegacyPromoteSchema", () => {
  it("accepts the bare competitionId param (body is empty)", () => {
    const r = S.LegacyPromoteSchema.parse({});
    expect(r).toEqual({});
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/lib/__tests__/api-schemas.test.ts`
Expected: FAIL — `CompetitionThrowCreateSchema is undefined`.

- [ ] **Step 3: Add the new schemas to `src/lib/api-schemas.ts`**

Append after the `CompetitionUpdateSchema` export:

```ts
// ── Competition Throws (v2) ─────────────────────────────────────────────

const ThrowResultSchema = z.discriminatedUnion("resultType", [
  z.object({ resultType: z.literal("MARK"), distance: z.number().positive() }),
  z.object({ resultType: z.literal("FOUL"), foulType: z.enum(["RING", "SECTOR"]) }),
  z.object({ resultType: z.literal("PASS") }),
]);

const ThrowSlotSchema = z.object({
  round: z.enum(["PRELIM", "FINALS"]),
  attemptInRound: z.number().int().min(1).max(4),
});

const ThrowOptionalsSchema = z.object({
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  wireLength: z.enum(["FULL", "THREE_QUARTER", "HALF"]).nullable().optional(),
});

export const CompetitionThrowCreateSchema = z.intersection(
  ThrowSlotSchema,
  z.intersection(ThrowResultSchema, ThrowOptionalsSchema)
);

export const CompetitionThrowUpdateSchema = z.intersection(
  ThrowSlotSchema.partial(),
  z.intersection(ThrowResultSchema, ThrowOptionalsSchema.partial())
);

// ── Legacy promotion ────────────────────────────────────────────────────
// POST body is empty — the competition ID comes from the URL.
export const LegacyPromoteSchema = z.object({});
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/lib/__tests__/api-schemas.test.ts`
Expected: PASS, 8 new tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-schemas.ts src/lib/__tests__/api-schemas.test.ts
git commit -m "feat(schemas): per-throw discriminated union + legacy promote"
```

---

## Task 6: personal-records — add `bestLoggedCompThrow` derived field

**Files:**

- Modify: `src/lib/data/personal-records.ts`
- Test: `src/lib/data/__tests__/personal-records.test.ts` (create if missing)

- [ ] **Step 1: Check whether the test file exists**

```bash
ls src/lib/data/__tests__/personal-records.test.ts 2>/dev/null || echo "missing"
```

- [ ] **Step 2: Write a failing test**

Create `src/lib/data/__tests__/personal-records.test.ts` (or extend existing):

```ts
// src/lib/data/__tests__/personal-records.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    athleteProfile: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    throwLog: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

import { getAthletePRs } from "../personal-records";

describe("getAthletePRs — bestLoggedCompThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces the best logged comp throw even when manual override is higher", async () => {
    mockFindUnique.mockResolvedValue({
      gender: "MALE",
      events: ["SHOT_PUT"],
      competitionPRs: { SHOT_PUT: 20.5 }, // manual override higher than any logged throw
      updatedAt: new Date("2026-01-01"),
    });
    mockFindMany.mockResolvedValue([
      {
        id: "t1",
        event: "SHOT_PUT",
        implementWeight: 7.26,
        distance: 18.42,
        date: new Date("2026-04-01"),
        isCompetition: true,
        notes: null,
      },
    ]);

    const prs = await getAthletePRs("a1");
    const shot = prs.events.find((e) => e.event === "SHOT_PUT")!;
    expect(shot.competitionPR?.distance).toBe(20.5); // manual wins
    expect(shot.bestLoggedCompThrow?.distance).toBe(18.42); // logged surfaced separately
  });

  it("bestLoggedCompThrow is null when no comp throws logged", async () => {
    mockFindUnique.mockResolvedValue({
      gender: "MALE",
      events: ["SHOT_PUT"],
      competitionPRs: { SHOT_PUT: 20.5 },
      updatedAt: new Date("2026-01-01"),
    });
    mockFindMany.mockResolvedValue([]);

    const prs = await getAthletePRs("a1");
    const shot = prs.events.find((e) => e.event === "SHOT_PUT")!;
    expect(shot.bestLoggedCompThrow).toBeNull();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npm test -- src/lib/data/__tests__/personal-records.test.ts`
Expected: FAIL — `bestLoggedCompThrow` is undefined.

- [ ] **Step 4: Extend the type and resolver**

In `src/lib/data/personal-records.ts`, update `AthletePREvent`:

```ts
export type AthletePREvent = {
  event: PREventKey;
  competitionWeightKg: number;
  competitionPR: PRRecord | null;
  practiceBest: PRRecord | null;
  practiceExceedsPR: boolean;
  bestLoggedCompThrow: PRRecord | null; // NEW
};
```

Inside the `events.map` block where `competitionPRCandidate` is computed, expose the candidate itself as the new field. Replace the return block at the bottom of `eventResults.map`:

```ts
return {
  event,
  competitionWeightKg,
  competitionPR,
  practiceBest,
  practiceExceedsPR,
  bestLoggedCompThrow: competitionPRCandidate, // best ThrowLog comp row, independent of manual merge
};
```

(The existing `competitionPRCandidate` variable already holds exactly what we want — the best `isCompetition=true` row before the manual-override max. No recomputation.)

- [ ] **Step 5: Run tests to confirm pass**

Run: `npm test -- src/lib/data/__tests__/personal-records.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/personal-records.ts src/lib/data/__tests__/personal-records.test.ts
git commit -m "feat(pr-resolver): expose bestLoggedCompThrow for UI badge"
```

---

## Task 7: NotificationType — add COMPETITION_PR + COMPETITION_LOGGED

**Files:**

- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Add the two new types to the `NotificationType` union**

Open `src/lib/notifications.ts`, find the `NotificationType` union (near line 16), add the two new values:

```ts
export type NotificationType =
  | "WORKOUT_ASSIGNED"
  | "WORKOUT_COMPLETED"
  | "WORKOUT_SKIPPED"
  | "PR_ALERT"
  | "LOW_READINESS"
  | "QUESTIONNAIRE_ASSIGNED"
  | "QUESTIONNAIRE_COMPLETE"
  | "STREAK_BROKEN"
  | "ATHLETE_JOINED"
  | "PROGRAM_CHECKPOINT"
  | "COMPLEX_ROTATED"
  | "COMMENT_ADDED"
  | "VIDEO_SHARED"
  | "COMPETITION_REMINDER"
  | "INVITATION_EXPIRED"
  | "PROGRAMMING_REQUESTED"
  | "COMPETITION_PR"
  | "COMPETITION_LOGGED";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat(notifications): competition PR + logged types"
```

---

## Task 8: notify helper — PR detection + meet-logged routing

**Files:**

- Create: `src/lib/competitions/notify.ts`
- Test: `src/lib/competitions/__tests__/notify.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/competitions/__tests__/notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateNotification = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { notifyCompetitionEvent } from "../notify";

describe("notifyCompetitionEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires PR notification to coach when athlete logs", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachProfileId: "c1" });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
      isFirstThrow: false,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPETITION_PR",
        coachId: "c1",
      })
    );
  });

  it("fires PR notification to athlete when coach logs", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachProfileId: "c1" });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "COACH",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
      isFirstThrow: false,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPETITION_PR",
        athleteProfileId: "a1",
      })
    );
  });

  it("fires COMPETITION_LOGGED only on first throw", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachProfileId: "c1" });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: null,
      isFirstThrow: true,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMPETITION_LOGGED" })
    );

    mockCreateNotification.mockClear();
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: null,
      isFirstThrow: false,
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not throw if notification create fails", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachProfileId: "c1" });
    mockCreateNotification.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyCompetitionEvent({
        athleteId: "a1",
        actorRole: "ATHLETE",
        meetName: "Big Invite",
        competitionId: "m1",
        prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
        isFirstThrow: false,
      })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/lib/competitions/__tests__/notify.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/competitions/notify.ts
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export type PRCelebration = {
  event: string;
  oldPR: number;
  newPR: number;
};

export type NotifyInput = {
  athleteId: string;
  actorRole: "COACH" | "ATHLETE";
  meetName: string;
  competitionId: string;
  prCelebration: PRCelebration | null;
  isFirstThrow: boolean;
};

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/**
 * Fire-and-forget notification router for competition events.
 * NEVER throws — all errors are logged and swallowed so the caller's
 * mutation cannot be broken by a notification failure.
 */
export async function notifyCompetitionEvent(input: NotifyInput): Promise<void> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: input.athleteId },
      select: { id: true, coachProfileId: true },
    });
    if (!athlete) return;

    // Decide recipient. Athlete logged → notify coach (if linked). Coach logged → notify athlete.
    const targetCoachId =
      input.actorRole === "ATHLETE" && athlete.coachProfileId ? athlete.coachProfileId : undefined;
    const targetAthleteId = input.actorRole === "COACH" ? athlete.id : undefined;

    // No recipient (e.g., self-coached athlete with no coach) — nothing to send for the PR case.
    if (!targetCoachId && !targetAthleteId) return;

    if (input.prCelebration) {
      const label = EVENT_LABEL[input.prCelebration.event] ?? input.prCelebration.event;
      await createNotification({
        type: "COMPETITION_PR",
        title: "New Competition PR",
        body: `${label} PR at ${input.meetName} — ${input.prCelebration.newPR.toFixed(2)}m (prev ${input.prCelebration.oldPR.toFixed(2)}m)`,
        coachId: targetCoachId,
        athleteProfileId: targetAthleteId,
        metadata: {
          competitionId: input.competitionId,
          event: input.prCelebration.event,
          oldPR: input.prCelebration.oldPR,
          newPR: input.prCelebration.newPR,
        },
      });
    } else if (input.isFirstThrow) {
      await createNotification({
        type: "COMPETITION_LOGGED",
        title: "Meet logged",
        body: `${input.meetName} — first throw entered`,
        coachId: targetCoachId,
        athleteProfileId: targetAthleteId,
        metadata: { competitionId: input.competitionId },
      });
    }
  } catch (err) {
    logger.error("notifyCompetitionEvent failed", { context: "competitions/notify", error: err });
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/lib/competitions/__tests__/notify.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitions/notify.ts src/lib/competitions/__tests__/notify.test.ts
git commit -m "feat(competitions): notification router for PR + first-throw"
```

---

## Task 9: Extend meet-level POST with v2 context fields

**Files:**

- Modify: `src/app/api/throws/competitions/route.ts`
- Test: `src/app/api/throws/competitions/__tests__/competitions.test.ts` (create)

- [ ] **Step 1: Write failing test for POST accepting new fields**

```ts
// src/app/api/throws/competitions/__tests__/competitions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

describe("POST /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates meet with v2 context fields", async () => {
    mockCreate.mockResolvedValue({ id: "m1", athleteId: "a1" });
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "POST",
      body: JSON.stringify({
        athleteId: "a1",
        name: "NCAA East",
        date: "2026-05-15",
        event: "SHOT_PUT",
        venueType: "OUTDOOR",
        windMps: -1.2,
        placeFinish: 3,
        format: "THREE_PLUS_THREE",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        venueType: "OUTDOOR",
        windMps: -1.2,
        placeFinish: 3,
        format: "THREE_PLUS_THREE",
      }),
    });
  });

  it("rejects placeFinish of 0", async () => {
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "POST",
      body: JSON.stringify({
        athleteId: "a1",
        name: "X",
        date: "2026-05-15",
        event: "SHOT_PUT",
        placeFinish: 0,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: FAIL — POST does not pass new fields through to `data`.

- [ ] **Step 3: Update the POST handler**

In `src/app/api/throws/competitions/route.ts`, replace the existing POST with:

```ts
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, CompetitionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      athleteId,
      name,
      date,
      event,
      priority,
      result,
      notes,
      implementWeightKg,
      placeFinish,
      meetStatus,
      venueType,
      weather,
      windMps,
      format,
      madeFinals,
    } = parsed;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competition = await prisma.throwsCompetition.create({
      data: {
        athleteId,
        name,
        date,
        event: event as EventType,
        priority: priority || "B",
        result: result ?? null,
        notes: notes ?? null,
        implementWeightKg: implementWeightKg ?? null,
        placeFinish: placeFinish ?? null,
        meetStatus: meetStatus ?? "COMPLETED",
        venueType: venueType ?? null,
        weather: weather ?? null,
        windMps: windMps ?? null,
        format: format ?? "THREE_PLUS_THREE",
        madeFinals: madeFinals ?? null,
      },
    });

    return NextResponse.json({ success: true, data: competition });
  } catch (error) {
    logger.error("Create competition error", { context: "throws/competitions", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to create competition" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/route.ts src/app/api/throws/competitions/__tests__/competitions.test.ts
git commit -m "feat(api): POST /competitions accepts v2 context fields"
```

---

## Task 10: Extend meet-level GET with bestMark + \_count

**Files:**

- Modify: `src/app/api/throws/competitions/route.ts`
- Test: `src/app/api/throws/competitions/__tests__/competitions.test.ts`

- [ ] **Step 1: Add failing test for GET returning bestMark + throwCount**

Append to the test file:

```ts
import { GET } from "../route";

describe("GET /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns meets with derived bestMark and throwCount", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "m1",
        athleteId: "a1",
        name: "A",
        date: "2026-05-15",
        event: "SHOT_PUT",
        result: null,
        _count: { throws: 3 },
        throws: [
          { distance: 18.0, isFoul: false, isPass: false },
          { distance: null, isFoul: true, isPass: false },
          { distance: 18.42, isFoul: false, isPass: false },
        ],
      },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions?athleteId=a1");
    const res = await GET(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].bestMark).toBe(18.42);
    expect(body.data[0].throwCount).toBe(3);
  });

  it("falls back to legacy result for rows with no throws", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "m2",
        athleteId: "a1",
        name: "Legacy",
        date: "2025-05-15",
        event: "SHOT_PUT",
        result: 17.3,
        _count: { throws: 0 },
        throws: [],
      },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions?athleteId=a1");
    const res = await GET(req);
    const body = await res.json();
    expect(body.data[0].bestMark).toBe(17.3);
    expect(body.data[0].throwCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: FAIL — `bestMark` undefined.

- [ ] **Step 3: Update GET handler**

Replace GET in `src/app/api/throws/competitions/route.ts`:

```ts
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competitions = await prisma.throwsCompetition.findMany({
      where: { athleteId },
      orderBy: { date: "desc" },
      include: {
        _count: { select: { throws: true } },
        throws: {
          select: { distance: true, isFoul: true, isPass: true },
        },
      },
    });

    const shaped = competitions.map((c) => {
      const throwCount = c._count.throws;
      const validDistances = c.throws
        .filter((t) => !t.isFoul && !t.isPass && t.distance != null)
        .map((t) => t.distance as number);
      const bestFromThrows = validDistances.length > 0 ? Math.max(...validDistances) : null;
      // Fall back to legacy `result` if no structured throws yet
      const bestMark = bestFromThrows ?? c.result ?? null;
      // Do not include full throws array in the list payload
      const { throws: _throws, _count, ...rest } = c;
      return { ...rest, bestMark, throwCount };
    });

    return NextResponse.json({ success: true, data: shaped });
  } catch (error) {
    logger.error("Get competitions error", { context: "throws/competitions", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch competitions" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/route.ts src/app/api/throws/competitions/__tests__/competitions.test.ts
git commit -m "feat(api): GET /competitions derives bestMark + throwCount"
```

---

## Task 11: Extend meet-level PATCH; add DELETE

**Files:**

- Modify: `src/app/api/throws/competitions/route.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file:

```ts
import { PATCH, DELETE } from "../route";

describe("PATCH /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates v2 fields", async () => {
    mockFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockUpdate.mockResolvedValue({ id: "m1", athleteId: "a1", placeFinish: 2 });
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "PATCH",
      body: JSON.stringify({ id: "m1", placeFinish: 2, madeFinals: true }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ placeFinish: 2, madeFinals: true }),
      })
    );
  });
});

describe("DELETE /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes meet after authorization", async () => {
    mockFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockDelete.mockResolvedValue({ id: "m1" });
    const req = new NextRequest("http://t/api/throws/competitions?id=m1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("returns 404 if not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/throws/competitions?id=missing", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: FAIL — PATCH doesn't forward new fields; DELETE missing.

- [ ] **Step 3: Replace PATCH handler and append DELETE**

Replace PATCH in `src/app/api/throws/competitions/route.ts` with:

```ts
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, CompetitionUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { id, ...updates } = parsed;

    const existing = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        existing.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Strip undefined, leave null values (null clears the column)
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) data[k] = v;
    }

    const competition = await prisma.throwsCompetition.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: competition });
  } catch (error) {
    logger.error("Update competition error", { context: "throws/competitions", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to update competition" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        existing.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.throwsCompetition.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error("Delete competition error", { context: "throws/competitions", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to delete competition" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/app/api/throws/competitions/__tests__/competitions.test.ts`
Expected: PASS — PATCH + DELETE green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/route.ts src/app/api/throws/competitions/__tests__/competitions.test.ts
git commit -m "feat(api): competition PATCH forwards v2 fields; DELETE with 404"
```

---

## Task 12: Per-throw GET + POST (with PR detection + notify)

**Files:**

- Create: `src/app/api/throws/competitions/[id]/throws/route.ts`
- Test: `src/app/api/throws/competitions/[id]/throws/__tests__/throws.test.ts`

- [ ] **Step 1: Write failing tests covering GET, POST, uniqueness, PR detection**

```ts
// src/app/api/throws/competitions/[id]/throws/__tests__/throws.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompFindUnique = vi.fn();
const mockThrowFindMany = vi.fn();
const mockThrowCreate = vi.fn();
const mockCompUpdate = vi.fn();
const mockProfileFindUnique = vi.fn();
const mockProfileUpdate = vi.fn();
const mockGetAthletePRs = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      findUnique: (...a: unknown[]) => mockCompFindUnique(...a),
      update: (...a: unknown[]) => mockCompUpdate(...a),
    },
    throwLog: {
      findMany: (...a: unknown[]) => mockThrowFindMany(...a),
      create: (...a: unknown[]) => mockThrowCreate(...a),
    },
    athleteProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      update: (...a: unknown[]) => mockProfileUpdate(...a),
    },
  },
  prisma: {
    throwsCompetition: {
      findUnique: (...a: unknown[]) => mockCompFindUnique(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/data/personal-records", () => ({
  getAthletePRs: (...a: unknown[]) => mockGetAthletePRs(...a),
}));
vi.mock("@/lib/competitions/notify", () => ({
  notifyCompetitionEvent: (...a: unknown[]) => mockNotify(...a),
}));

import { GET, POST } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const competitionWeight = 7.26;

describe("GET /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns throws ordered by (round, attemptInRound)", async () => {
    mockCompFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockThrowFindMany.mockResolvedValue([
      { id: "t1", round: "PRELIM", attemptInRound: 1 },
      { id: "t2", round: "FINALS", attemptInRound: 1 },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions/m1/throws");
    const res = await GET(req, ctx("m1"));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(mockThrowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { competitionId: "m1" },
        orderBy: [{ round: "asc" }, { attemptInRound: "asc" }],
      })
    );
  });
});

describe("POST /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  const meet = {
    id: "m1",
    athleteId: "a1",
    event: "SHOT_PUT",
    implementWeightKg: null,
    format: "THREE_PLUS_THREE",
    name: "Big Invite",
    result: 17.0,
    throws: [],
    athlete: { gender: "MALE" },
  };

  it("creates a MARK throw and clears legacy result on first", async () => {
    mockCompFindUnique.mockResolvedValue(meet);
    mockThrowFindMany.mockResolvedValueOnce([]); // count-before-insert
    mockThrowCreate.mockResolvedValue({ id: "t1", distance: 18.42 });
    mockGetAthletePRs
      .mockResolvedValueOnce({ events: [{ event: "SHOT_PUT", competitionPR: null }] })
      .mockResolvedValueOnce({
        events: [{ event: "SHOT_PUT", competitionPR: { distance: 18.42 } }],
      });

    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 1,
        resultType: "MARK",
        distance: 18.42,
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockThrowCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          athleteId: "a1",
          event: "SHOT_PUT",
          implementWeight: competitionWeight, // gender-default for MALE shot
          isCompetition: true,
          competitionId: "m1",
          round: "PRELIM",
          attemptInRound: 1,
          isFoul: false,
          isPass: false,
          distance: 18.42,
        }),
      })
    );
    expect(mockCompUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { result: null },
    });
    const body = await res.json();
    expect(body.data.prCelebration).toEqual({
      event: "SHOT_PUT",
      oldPR: 0,
      newPR: 18.42,
    });
  });

  it("returns 409 on duplicate slot", async () => {
    mockCompFindUnique.mockResolvedValue(meet);
    mockThrowFindMany.mockResolvedValueOnce([{ round: "PRELIM", attemptInRound: 1 }]);
    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({
        round: "PRELIM",
        attemptInRound: 1,
        resultType: "PASS",
      }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(409);
  });

  it("rejects THREE_PLUS_THREE attempt 4", async () => {
    mockCompFindUnique.mockResolvedValue(meet);
    mockThrowFindMany.mockResolvedValueOnce([]);
    const req = new NextRequest("http://t", {
      method: "POST",
      body: JSON.stringify({ round: "PRELIM", attemptInRound: 4, resultType: "PASS" }),
    });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the GET + POST handlers**

```ts
// src/app/api/throws/competitions/[id]/throws/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, CompetitionThrowCreateSchema } from "@/lib/api-schemas";
import { validateThrowSlot } from "@/lib/competitions/validate";
import { getAthletePRs } from "@/lib/data/personal-records";
import { notifyCompetitionEvent } from "@/lib/competitions/notify";
import type { EventType, CompFormat, ThrowRound, FoulType } from "@prisma/client";

// Gender-default competition weights (matches personal-records.ts)
const COMP_WEIGHT: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

function resolveImplementWeight(
  event: string,
  gender: string | null,
  override: number | null
): number {
  if (override != null) return override;
  const w = COMP_WEIGHT[event];
  if (!w) return 0;
  return gender === "FEMALE" ? w.female : w.male;
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const throws = await prisma.throwLog.findMany({
      where: { competitionId: id },
      orderBy: [{ round: "asc" }, { attemptInRound: "asc" }],
    });

    return NextResponse.json({ success: true, data: throws });
  } catch (error) {
    logger.error("Get competition throws error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to fetch throws" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      include: {
        athlete: { select: { gender: true } },
        throws: { select: { round: true, attemptInRound: true } },
      },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, CompetitionThrowCreateSchema);
    if (parsed instanceof NextResponse) return parsed;

    const format = (meet.format ?? "THREE_PLUS_THREE") as CompFormat;
    const slotError = validateThrowSlot(format, parsed.round as ThrowRound, parsed.attemptInRound);
    if (slotError) {
      return NextResponse.json({ success: false, error: slotError }, { status: 400 });
    }

    // Uniqueness check against existing throws (not a DB constraint; enforced here)
    const duplicate = meet.throws.some(
      (t) => t.round === parsed.round && t.attemptInRound === parsed.attemptInRound
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Attempt ${parsed.attemptInRound} of ${parsed.round} already logged`,
        },
        { status: 409 }
      );
    }

    const implementWeight = resolveImplementWeight(
      meet.event,
      meet.athlete?.gender ?? null,
      meet.implementWeightKg
    );

    // PR snapshot BEFORE the write
    const beforePR = await getAthletePRs(meet.athleteId);
    const beforeBest =
      beforePR.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;

    // Discriminated-union → throw-log columns
    let distance: number | null = null;
    let isFoul = false;
    let isPass = false;
    let foulType: FoulType | null = null;
    if (parsed.resultType === "MARK") distance = parsed.distance;
    if (parsed.resultType === "FOUL") {
      isFoul = true;
      foulType = parsed.foulType as FoulType;
    }
    if (parsed.resultType === "PASS") isPass = true;

    const throwLog = await prisma.throwLog.create({
      data: {
        athleteId: meet.athleteId,
        event: meet.event as EventType,
        implementWeight,
        implementWeightUnit: "kg",
        isCompetition: true,
        competitionId: meet.id,
        round: parsed.round as ThrowRound,
        attemptInRound: parsed.attemptInRound,
        isFoul,
        foulType,
        isPass,
        distance,
        notes: parsed.notes ?? null,
        videoUrl: parsed.videoUrl ?? null,
        wireLength: parsed.wireLength ?? null,
      },
    });

    // First throw: clear legacy result
    const isFirstThrow = meet.throws.length === 0;
    if (isFirstThrow && meet.result != null) {
      await prisma.throwsCompetition.update({ where: { id: meet.id }, data: { result: null } });
    }

    // PR detection AFTER the write
    const afterPR = await getAthletePRs(meet.athleteId);
    const afterBest =
      afterPR.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;
    const prCelebration =
      afterBest > beforeBest
        ? { event: meet.event as string, oldPR: beforeBest, newPR: afterBest }
        : null;

    // Fire-and-forget notifications
    await notifyCompetitionEvent({
      athleteId: meet.athleteId,
      actorRole: currentUser.role === "COACH" ? "COACH" : "ATHLETE",
      meetName: meet.name,
      competitionId: meet.id,
      prCelebration,
      isFirstThrow,
    });

    return NextResponse.json({ success: true, data: { throwLog, prCelebration } });
  } catch (error) {
    logger.error("Create competition throw error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to create throw" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/\[id\]/throws/
git commit -m "feat(api): per-throw GET + POST with PR detection"
```

---

## Task 13: Per-throw PATCH + DELETE

**Files:**

- Modify: `src/app/api/throws/competitions/[id]/throws/route.ts`

- [ ] **Step 1: Write failing tests for PATCH and DELETE**

Append to the test file:

```ts
import { PATCH, DELETE } from "../route";

const mockThrowFindUnique = vi.fn();
const mockThrowUpdate = vi.fn();
const mockThrowDelete = vi.fn();

vi.mocked(vi.doMock)?.("@/lib/prisma", () => ({
  default: {
    // re-use previous mocks plus:
  },
}));
// NOTE: in practice add findUnique/update/delete to the initial throwLog mock block

describe("PATCH /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("transitions MARK → FOUL: clears distance, sets foulType", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      format: "THREE_PLUS_THREE",
      name: "X",
      result: null,
      throws: [],
      athlete: { gender: "MALE" },
    });
    mockGetAthletePRs.mockResolvedValue({ events: [{ event: "SHOT_PUT", competitionPR: null }] });
    // Add throwLog.findUnique + update mocks at the top of the test file.
    const req = new NextRequest("http://t?throwLogId=t1", {
      method: "PATCH",
      body: JSON.stringify({ resultType: "FOUL", foulType: "RING" }),
    });
    const res = await PATCH(req, ctx("m1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/throws/competitions/[id]/throws", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes by throwLogId", async () => {
    mockCompFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    // throwLog.findUnique mock: returns row with matching competitionId
    const req = new NextRequest("http://t?throwLogId=t1", { method: "DELETE" });
    const res = await DELETE(req, ctx("m1"));
    expect(res.status).toBe(200);
  });
});
```

> **Note on mocks:** add `findUnique`, `update`, `delete` to the initial `throwLog` mock block at the top of the test file. Example:
>
> ```ts
> throwLog: {
>   findMany: (...a: unknown[]) => mockThrowFindMany(...a),
>   findUnique: (...a: unknown[]) => mockThrowFindUnique(...a),
>   create: (...a: unknown[]) => mockThrowCreate(...a),
>   update: (...a: unknown[]) => mockThrowUpdate(...a),
>   delete: (...a: unknown[]) => mockThrowDelete(...a),
> },
> ```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/throws/`
Expected: FAIL — PATCH/DELETE not exported.

- [ ] **Step 3: Append PATCH and DELETE to the route file**

```ts
// append to src/app/api/throws/competitions/[id]/throws/route.ts

import { CompetitionThrowUpdateSchema } from "@/lib/api-schemas";

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id: competitionId } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const throwLogId = searchParams.get("throwLogId");
    if (!throwLogId) {
      return NextResponse.json(
        { success: false, error: "throwLogId is required" },
        { status: 400 }
      );
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id: competitionId },
      select: {
        athleteId: true,
        event: true,
        format: true,
        name: true,
        athlete: { select: { gender: true } },
      },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.throwLog.findUnique({
      where: { id: throwLogId },
      select: { id: true, competitionId: true },
    });
    if (!existing || existing.competitionId !== competitionId) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, CompetitionThrowUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Build the column diff based on the discriminated union branch the payload matched
    const data: Record<string, unknown> = {};
    if (parsed.round) data.round = parsed.round;
    if (parsed.attemptInRound) data.attemptInRound = parsed.attemptInRound;
    if ("notes" in parsed && parsed.notes !== undefined) data.notes = parsed.notes;
    if ("videoUrl" in parsed && parsed.videoUrl !== undefined) data.videoUrl = parsed.videoUrl;
    if ("wireLength" in parsed && parsed.wireLength !== undefined)
      data.wireLength = parsed.wireLength;

    if ("resultType" in parsed) {
      if (parsed.resultType === "MARK") {
        data.distance = parsed.distance;
        data.isFoul = false;
        data.isPass = false;
        data.foulType = null;
      } else if (parsed.resultType === "FOUL") {
        data.distance = null;
        data.isFoul = true;
        data.isPass = false;
        data.foulType = parsed.foulType;
      } else if (parsed.resultType === "PASS") {
        data.distance = null;
        data.isFoul = false;
        data.isPass = true;
        data.foulType = null;
      }
    }

    // PR snapshot before
    const beforePR = await getAthletePRs(meet.athleteId);
    const beforeBest =
      beforePR.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;

    const throwLog = await prisma.throwLog.update({
      where: { id: throwLogId },
      data,
    });

    const afterPR = await getAthletePRs(meet.athleteId);
    const afterBest =
      afterPR.events.find((e) => e.event === meet.event)?.competitionPR?.distance ?? 0;
    const prCelebration =
      afterBest > beforeBest
        ? { event: meet.event as string, oldPR: beforeBest, newPR: afterBest }
        : null;

    await notifyCompetitionEvent({
      athleteId: meet.athleteId,
      actorRole: currentUser.role === "COACH" ? "COACH" : "ATHLETE",
      meetName: meet.name,
      competitionId,
      prCelebration,
      isFirstThrow: false,
    });

    return NextResponse.json({ success: true, data: { throwLog, prCelebration } });
  } catch (error) {
    logger.error("Update competition throw error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to update throw" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id: competitionId } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const throwLogId = searchParams.get("throwLogId");
    if (!throwLogId) {
      return NextResponse.json(
        { success: false, error: "throwLogId is required" },
        { status: 400 }
      );
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id: competitionId },
      select: { athleteId: true },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.throwLog.findUnique({
      where: { id: throwLogId },
      select: { competitionId: true },
    });
    if (!existing || existing.competitionId !== competitionId) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }

    await prisma.throwLog.delete({ where: { id: throwLogId } });
    return NextResponse.json({ success: true, data: { id: throwLogId } });
  } catch (error) {
    logger.error("Delete competition throw error", { context: "competitions/throws", error });
    return NextResponse.json({ success: false, error: "Failed to delete throw" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/\[id\]/throws/route.ts src/app/api/throws/competitions/\[id\]/throws/__tests__/throws.test.ts
git commit -m "feat(api): per-throw PATCH + DELETE"
```

---

## Task 14: Legacy-promote endpoint

**Files:**

- Create: `src/app/api/throws/competitions/[id]/promote-legacy/route.ts`
- Test: `src/app/api/throws/competitions/[id]/promote-legacy/__tests__/promote.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/throws/competitions/[id]/promote-legacy/__tests__/promote.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompFindUnique = vi.fn();
const mockProfileFindUnique = vi.fn();
const mockProfileUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: { findUnique: (...a: unknown[]) => mockCompFindUnique(...a) },
    athleteProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      update: (...a: unknown[]) => mockProfileUpdate(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /promote-legacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes legacy result to competitionPRs when it exceeds stored value", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      result: 18.42,
    });
    mockProfileFindUnique.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.0 } });
    mockProfileUpdate.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.42 } });

    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { competitionPRs: { SHOT_PUT: 18.42 } },
    });
  });

  it("is idempotent when stored value is higher", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      result: 17.5,
    });
    mockProfileFindUnique.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.0 } });

    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when meet has no legacy result", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1",
      athleteId: "a1",
      event: "SHOT_PUT",
      result: null,
    });
    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/promote-legacy/`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the endpoint**

```ts
// src/app/api/throws/competitions/[id]/promote-legacy/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true, event: true, result: true },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        meet.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (meet.result == null) {
      return NextResponse.json(
        { success: false, error: "No legacy result to promote" },
        { status: 400 }
      );
    }

    const profile = await prisma.athleteProfile.findUnique({
      where: { id: meet.athleteId },
      select: { competitionPRs: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const current = (profile.competitionPRs as Record<string, number | null> | null) ?? {};
    const existing = typeof current[meet.event] === "number" ? (current[meet.event] as number) : 0;

    if (meet.result <= existing) {
      // Idempotent: nothing to do
      return NextResponse.json({
        success: true,
        data: { competitionPRs: current, promoted: false },
      });
    }

    const updated = { ...current, [meet.event]: meet.result };
    const res = await prisma.athleteProfile.update({
      where: { id: meet.athleteId },
      data: { competitionPRs: updated },
      select: { competitionPRs: true },
    });

    return NextResponse.json({
      success: true,
      data: { competitionPRs: res.competitionPRs, promoted: true },
    });
  } catch (error) {
    logger.error("Promote legacy result error", { context: "competitions/promote-legacy", error });
    return NextResponse.json(
      { success: false, error: "Failed to promote legacy result" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/app/api/throws/competitions/\[id\]/promote-legacy/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/throws/competitions/\[id\]/promote-legacy/
git commit -m "feat(api): promote legacy competition result to unified PRs"
```

---

## Task 15: CompetitionThrowsTable — base rendering

**Files:**

- Create: `src/components/competitions/CompetitionThrowsTable.tsx`
- Test: `src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`

- [ ] **Step 1: Write failing RTL tests for base rendering**

```tsx
// src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionThrowsTable } from "../CompetitionThrowsTable";

const baseMeet = {
  id: "m1",
  athleteId: "a1",
  event: "SHOT_PUT",
  format: "THREE_PLUS_THREE" as const,
  madeFinals: false,
  result: null,
  name: "Test",
};

describe("CompetitionThrowsTable — base rendering", () => {
  it("renders 3 prelim rows for THREE_PLUS_THREE", () => {
    render(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(3);
    expect(screen.queryAllByTestId(/^throw-row-FINALS-/)).toHaveLength(0);
  });

  it("shows finals section when madeFinals=true", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, madeFinals: true }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^throw-row-FINALS-/)).toHaveLength(3);
  });

  it("renders 4 rows for FOUR_STRAIGHT", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, format: "FOUR_STRAIGHT" }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(4);
  });

  it("shows legacy banner when result != null and no throws", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId("legacy-banner")).toBeInTheDocument();
    expect(screen.getByText(/17.5m/)).toBeInTheDocument();
  });

  it("hides legacy banner when throws exist", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[
          {
            id: "t1",
            round: "PRELIM",
            attemptInRound: 1,
            distance: 18,
            isFoul: false,
            isPass: false,
            foulType: null,
          } as any,
        ]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByTestId("legacy-banner")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Create the base component**

```tsx
// src/components/competitions/CompetitionThrowsTable.tsx
"use client";
import { useMemo } from "react";

export type CompThrowRow = {
  id: string;
  round: "PRELIM" | "FINALS";
  attemptInRound: number;
  distance: number | null;
  isFoul: boolean;
  isPass: boolean;
  foulType: "RING" | "SECTOR" | null;
  notes: string | null;
  videoUrl: string | null;
  wireLength: string | null;
};

export type CompMeet = {
  id: string;
  athleteId: string;
  event: string;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
  result: number | null;
  name: string;
};

export type ThrowSaveInput = Omit<CompThrowRow, "id"> & { id?: string };

type Props = {
  meet: CompMeet;
  throws: CompThrowRow[];
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (throwLogId: string) => Promise<void>;
  onPromoteLegacy?: () => Promise<void>;
};

function slotsFor(
  format: CompMeet["format"],
  madeFinals: boolean | null
): Array<{ round: "PRELIM" | "FINALS"; attemptInRound: number }> {
  if (format === "FOUR_STRAIGHT") {
    return [1, 2, 3, 4].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
  }
  const prelims = [1, 2, 3].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
  if (madeFinals) {
    return [...prelims, ...[1, 2, 3].map((n) => ({ round: "FINALS" as const, attemptInRound: n }))];
  }
  return prelims;
}

export function CompetitionThrowsTable({ meet, throws, onSave, onDelete, onPromoteLegacy }: Props) {
  const slots = useMemo(
    () => slotsFor(meet.format, meet.madeFinals),
    [meet.format, meet.madeFinals]
  );
  const showLegacyBanner = meet.result != null && throws.length === 0;

  const findThrow = (round: "PRELIM" | "FINALS", attemptInRound: number) =>
    throws.find((t) => t.round === round && t.attemptInRound === attemptInRound) ?? null;

  return (
    <div className="card p-4">
      {showLegacyBanner && (
        <div
          data-testid="legacy-banner"
          className="mb-4 rounded border border-warning-500 bg-warning-500/10 p-3 text-sm"
        >
          This meet was logged before per-throw entry. Add throws below to upgrade — your existing
          result of <strong>{meet.result?.toFixed(2)}m</strong> will be replaced.
          {onPromoteLegacy && (
            <button
              className="btn-secondary ml-2"
              onClick={onPromoteLegacy}
              data-testid="promote-legacy-btn"
            >
              Promote to Unified PR
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {slots.map((slot) => {
          const existing = findThrow(slot.round, slot.attemptInRound);
          return (
            <ThrowRow
              key={`${slot.round}-${slot.attemptInRound}`}
              slot={slot}
              meet={meet}
              existing={existing}
              onSave={onSave}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}

// Placeholder row component — populated in Task 16
function ThrowRow(props: {
  slot: { round: "PRELIM" | "FINALS"; attemptInRound: number };
  meet: CompMeet;
  existing: CompThrowRow | null;
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { slot, existing } = props;
  return (
    <div
      data-testid={`throw-row-${slot.round}-${slot.attemptInRound}`}
      className="flex items-center gap-2 rounded border border-[var(--card-border)] p-2"
    >
      <span className="w-8 text-sm text-muted">{slot.attemptInRound}</span>
      <span className="text-sm">{existing ? formatExisting(existing) : "(empty)"}</span>
    </div>
  );
}

function formatExisting(t: CompThrowRow): string {
  if (t.isFoul) return `Foul (${t.foulType?.toLowerCase()})`;
  if (t.isPass) return "Pass";
  if (t.distance != null) return `${t.distance.toFixed(2)}m`;
  return "—";
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/competitions/
git commit -m "feat(competitions): ThrowsTable base — slot layout + legacy banner"
```

---

## Task 16: ThrowsTable — interactive row (result type + save-on-blur)

**Files:**

- Modify: `src/components/competitions/CompetitionThrowsTable.tsx`
- Test: `src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`

- [ ] **Step 1: Add failing interaction tests**

Append to the test file:

```tsx
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("CompetitionThrowsTable — interactions", () => {
  it("switching to Foul reveals foulType picker", async () => {
    const user = userEvent.setup();
    render(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    const row = screen.getByTestId("throw-row-PRELIM-1");
    const foulBtn = row.querySelector('[data-type="FOUL"]') as HTMLElement;
    await user.click(foulBtn);
    expect(row.querySelector('[data-testid="foul-type-picker"]')).not.toBeNull();
  });

  it("saves on row blur when distance + Mark selected", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={onSave} onDelete={vi.fn()} />
    );
    const row = screen.getByTestId("throw-row-PRELIM-1");
    await user.click(row.querySelector('[data-type="MARK"]') as HTMLElement);
    const input = row.querySelector('input[data-testid="distance-input"]') as HTMLInputElement;
    await user.type(input, "18.42");
    fireEvent.blur(row);
    await waitFor(
      () => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            round: "PRELIM",
            attemptInRound: 1,
            distance: 18.42,
            isFoul: false,
            isPass: false,
          })
        );
      },
      { timeout: 1000 }
    );
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`
Expected: FAIL — picker/input don't exist.

- [ ] **Step 3: Replace the placeholder `ThrowRow` component**

In `src/components/competitions/CompetitionThrowsTable.tsx`, replace the placeholder `ThrowRow` with:

```tsx
import { useState, useRef, useEffect } from "react";
import { parseDistance } from "@/lib/competitions/parseDistance";

type RowResultType = "MARK" | "FOUL" | "PASS" | null;

function ThrowRow(props: {
  slot: { round: "PRELIM" | "FINALS"; attemptInRound: number };
  meet: CompMeet;
  existing: CompThrowRow | null;
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { slot, existing, onSave, onDelete } = props;

  const [resultType, setResultType] = useState<RowResultType>(() =>
    existing ? (existing.isFoul ? "FOUL" : existing.isPass ? "PASS" : "MARK") : null
  );
  const [distanceInput, setDistanceInput] = useState<string>(
    existing?.distance != null ? existing.distance.toFixed(2) : ""
  );
  const [foulType, setFoulType] = useState<"RING" | "SECTOR" | null>(existing?.foulType ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const commit = async () => {
    if (resultType == null) return;

    let distance: number | null = null;
    if (resultType === "MARK") {
      const parsed = parseDistance(distanceInput);
      if (!parsed) return;
      distance = parsed.meters;
    }
    if (resultType === "FOUL" && !foulType) return;

    setSaveState("saving");
    try {
      await onSave({
        id: existing?.id,
        round: slot.round,
        attemptInRound: slot.attemptInRound,
        distance,
        isFoul: resultType === "FOUL",
        isPass: resultType === "PASS",
        foulType: resultType === "FOUL" ? foulType : null,
        notes: existing?.notes ?? null,
        videoUrl: existing?.videoUrl ?? null,
        wireLength: existing?.wireLength ?? null,
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const handleRowBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    // Only save if focus truly left the row
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { void commit(); }, 500);
    }
  };

  return (
    <div
      data-testid={`throw-row-${slot.round}-${slot.attemptInRound}`}
      className="flex flex-wrap items-center gap-2 rounded border border-[var(--card-border)] p-2 sm:flex-nowrap"
      onBlur={handleRowBlur}
    >
      <span className="w-8 text-sm text-muted">{slot.attemptInRound}</span>

      <div role="radiogroup" className="flex gap-1">
        {(["MARK", "FOUL", "PASS"] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-type={t}
            onClick={() => {
              setResultType(t);
              if (t !== "MARK") setDistanceInput("");
              if (t !== "FOUL") setFoulType(null);
            }}
            className={`rounded px-2 py-1 text-xs ${resultType === t ? "bg-primary-500 text-black" : "bg-surface-800 text-muted"}`}
          >
            {t === "MARK" ? "Mark" : t === "FOUL" ? "Foul" : "Pass"}
          </button>
        ))}
      </div>

      {resultType === "MARK" && (
        <input
          data-testid="distance-input"
          value={distanceInput}
          onChange={(e) => setDistanceInput(e.target.value)}
          placeholder="18.42 or 60'4\""
          className="w-32 rounded bg-surface-800 px-2 py-1 text-sm font-mono tabular-nums"
        />
      )}

      {resultType === "FOUL" && (
        <div data-testid="foul-type-picker" className="flex gap-1">
          {(["RING", "SECTOR"] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setFoulType(ft)}
              className={`rounded px-2 py-1 text-xs ${foulType === ft ? "bg-danger-500 text-black" : "bg-surface-800 text-muted"}`}
            >
              {ft.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <SaveStatusDot state={saveState} />
        {existing && (
          <button
            type="button"
            onClick={() => onDelete(existing.id)}
            className="text-xs text-muted hover:text-danger-500"
            aria-label="Delete throw"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function SaveStatusDot({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const color =
    state === "saving" ? "bg-primary-500 animate-pulse"
    : state === "saved" ? "bg-success-500"
    : state === "error" ? "bg-danger-500"
    : "bg-transparent";
  return <span className={`h-2 w-2 rounded-full ${color}`} aria-label={`save ${state}`} />;
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- src/components/competitions/__tests__/CompetitionThrowsTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/competitions/
git commit -m "feat(competitions): ThrowsTable row interactions + save-on-blur"
```

---

## Task 17: CompetitionMeetHeader (inline edit for meet fields)

**Files:**

- Create: `src/components/competitions/CompetitionMeetHeader.tsx`

- [ ] **Step 1: Implement the header component**

The header is largely presentational and built from already-well-tested primitives. No new test file — it will be covered by page-level integration tests. Minimum viable version:

```tsx
// src/components/competitions/CompetitionMeetHeader.tsx
"use client";
import { useState } from "react";

export type MeetHeaderValue = {
  id: string;
  name: string;
  date: string;
  event: string;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
  venueType: "INDOOR" | "OUTDOOR" | null;
  weather: string | null;
  windMps: number | null;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
};

type Props = {
  value: MeetHeaderValue;
  onChange: (patch: Partial<MeetHeaderValue>) => Promise<void>;
  canMakeFinals: boolean;
};

export function CompetitionMeetHeader({ value, onChange, canMakeFinals }: Props) {
  const [dirty, setDirty] = useState<Partial<MeetHeaderValue>>({});

  const merged = { ...value, ...dirty };

  const handleField = <K extends keyof MeetHeaderValue>(key: K, v: MeetHeaderValue[K]) => {
    setDirty((d) => ({ ...d, [key]: v }));
  };

  const handleBlur = async () => {
    if (Object.keys(dirty).length === 0) return;
    await onChange(dirty);
    setDirty({});
  };

  return (
    <div className="card p-4 space-y-3" onBlur={handleBlur}>
      <div className="flex items-center gap-3">
        <input
          value={merged.name}
          onChange={(e) => handleField("name", e.target.value)}
          className="flex-1 bg-transparent text-xl font-heading"
          aria-label="Meet name"
        />
        <input
          type="date"
          value={merged.date}
          onChange={(e) => handleField("date", e.target.value)}
          className="bg-surface-800 rounded px-2 py-1 text-sm"
          aria-label="Meet date"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">Place</span>
          <input
            type="number"
            min={1}
            value={merged.placeFinish ?? ""}
            onChange={(e) =>
              handleField("placeFinish", e.target.value ? Number(e.target.value) : null)
            }
            className="w-16 bg-surface-800 rounded px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Status</span>
          <select
            value={merged.meetStatus}
            onChange={(e) =>
              handleField("meetStatus", e.target.value as MeetHeaderValue["meetStatus"])
            }
            className="bg-surface-800 rounded px-2 py-1"
          >
            {(["COMPLETED", "DNS", "DNF", "DQ"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Venue</span>
          <select
            value={merged.venueType ?? ""}
            onChange={(e) =>
              handleField("venueType", (e.target.value || null) as MeetHeaderValue["venueType"])
            }
            className="bg-surface-800 rounded px-2 py-1"
          >
            <option value="">—</option>
            <option value="INDOOR">Indoor</option>
            <option value="OUTDOOR">Outdoor</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Wind (m/s)</span>
          <input
            type="number"
            step="0.1"
            value={merged.windMps ?? ""}
            onChange={(e) => handleField("windMps", e.target.value ? Number(e.target.value) : null)}
            className="w-20 bg-surface-800 rounded px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex-1 flex items-center gap-2 min-w-[200px]">
          <span className="text-muted">Weather</span>
          <input
            value={merged.weather ?? ""}
            onChange={(e) => handleField("weather", e.target.value || null)}
            placeholder="e.g. 70°F sunny"
            className="flex-1 bg-surface-800 rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Format</span>
          <select
            value={merged.format}
            onChange={(e) => handleField("format", e.target.value as MeetHeaderValue["format"])}
            className="bg-surface-800 rounded px-2 py-1"
          >
            <option value="THREE_PLUS_THREE">3 + 3</option>
            <option value="FOUR_STRAIGHT">4 straight</option>
          </select>
        </label>
        {merged.format === "THREE_PLUS_THREE" && canMakeFinals && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={merged.madeFinals ?? false}
              onChange={(e) => handleField("madeFinals", e.target.checked)}
            />
            <span>Made finals</span>
          </label>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/competitions/CompetitionMeetHeader.tsx
git commit -m "feat(competitions): inline-editable meet header"
```

---

## Task 18: Extend AddMeetModal with v2 fields

**Files:**

- Modify: `src/app/(dashboard)/coach/competitions/_add-meet-modal.tsx`

- [ ] **Step 1: Read the existing modal to understand its shape**

```bash
cat "src/app/(dashboard)/coach/competitions/_add-meet-modal.tsx"
```

- [ ] **Step 2: Add the v2 inputs**

Inside the existing form, above the submit button, add a "More details" disclosure section:

```tsx
{
  /* NEW v2 fields — hidden under a "More details" toggle */
}
<details className="mt-4 border-t border-[var(--card-border)] pt-3">
  <summary className="cursor-pointer text-sm text-muted">More details</summary>
  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Venue</span>
      <select
        name="venueType"
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1"
        defaultValue=""
      >
        <option value="">—</option>
        <option value="INDOOR">Indoor</option>
        <option value="OUTDOOR">Outdoor</option>
      </select>
    </label>
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Format</span>
      <select
        name="format"
        defaultValue="THREE_PLUS_THREE"
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1"
      >
        <option value="THREE_PLUS_THREE">3 + 3 (top 9 advance)</option>
        <option value="FOUR_STRAIGHT">4 straight</option>
      </select>
    </label>
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Implement (kg)</span>
      <input
        name="implementWeightKg"
        type="number"
        step="0.01"
        placeholder="default for event"
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1 font-mono tabular-nums"
      />
    </label>
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Place (at finish)</span>
      <input
        name="placeFinish"
        type="number"
        min={1}
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1 font-mono tabular-nums"
      />
    </label>
    <label className="flex items-center gap-2">
      <span className="text-sm text-muted">Wind (m/s)</span>
      <input
        name="windMps"
        type="number"
        step="0.1"
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1 font-mono tabular-nums"
      />
    </label>
    <label className="sm:col-span-2 flex items-center gap-2">
      <span className="text-sm text-muted">Weather</span>
      <input
        name="weather"
        placeholder="70°F sunny, windy, rain..."
        className="flex-1 bg-[var(--surface-overlay)] rounded px-2 py-1"
      />
    </label>
  </div>
</details>;
```

Then extend the submit handler to include the new fields in the POST body. Find the existing form submit and merge:

```ts
const formData = new FormData(e.currentTarget);
const body = {
  athleteId,
  name: String(formData.get("name") ?? ""),
  date: String(formData.get("date") ?? ""),
  event: String(formData.get("event") ?? ""),
  priority: String(formData.get("priority") ?? "B"),
  venueType: (formData.get("venueType") || null) as "INDOOR" | "OUTDOOR" | null,
  format: (formData.get("format") || "THREE_PLUS_THREE") as "THREE_PLUS_THREE" | "FOUR_STRAIGHT",
  implementWeightKg: formData.get("implementWeightKg")
    ? Number(formData.get("implementWeightKg"))
    : null,
  placeFinish: formData.get("placeFinish") ? Number(formData.get("placeFinish")) : null,
  windMps: formData.get("windMps") ? Number(formData.get("windMps")) : null,
  weather: (formData.get("weather") as string) || null,
};
```

Keep every existing field the modal already sent intact — this only adds.

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/coach/competitions/_add-meet-modal.tsx"
git commit -m "feat(competitions): add meet modal — venue/format/wind/weather/place"
```

---

## Task 19: CompetitionListCard component

**Files:**

- Create: `src/components/competitions/CompetitionListCard.tsx`

- [ ] **Step 1: Build the list card**

```tsx
// src/components/competitions/CompetitionListCard.tsx
"use client";
import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export type CompetitionListItem = {
  id: string;
  name: string;
  date: string;
  event: string;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ" | null;
  venueType: "INDOOR" | "OUTDOOR" | null;
  bestMark: number | null;
  throwCount: number;
};

type Props = {
  item: CompetitionListItem;
  href: string;
};

export function CompetitionListCard({ item, href }: Props) {
  return (
    <Link href={href} className="card card-interactive p-4 block">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base">{item.name}</h3>
          <div className="text-xs text-muted">
            {item.date} · {item.event.replace("_", " ")}
            {item.venueType && ` · ${item.venueType.toLowerCase()}`}
            {item.placeFinish && ` · ${ordinal(item.placeFinish)}`}
          </div>
        </div>
        <div className="text-right">
          {item.bestMark != null ? (
            <div className="font-mono tabular-nums text-lg text-primary-500">
              <AnimatedNumber value={item.bestMark} decimals={2} suffix="m" />
            </div>
          ) : (
            <div className="text-xs text-muted">{item.meetStatus ?? "—"}</div>
          )}
          <div className="text-xs text-muted">
            {item.throwCount} throw{item.throwCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/competitions/CompetitionListCard.tsx
git commit -m "feat(competitions): list card with bestMark + throwCount"
```

---

## Task 20: Coach meet detail page

**Files:**

- Create: `src/app/(dashboard)/coach/competitions/[id]/page.tsx`
- Delete: `src/app/(dashboard)/coach/competitions/results/page.tsx`
- Delete: `src/app/(dashboard)/coach/competitions/results/_results-entry-client.tsx`
- Modify: `src/app/(dashboard)/coach/competitions/_competitions-client.tsx` (update clicks to new route)

- [ ] **Step 1: Create the coach meet detail page**

```tsx
// src/app/(dashboard)/coach/competitions/[id]/page.tsx
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MeetDetailClient } from "./_meet-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function CoachMeetDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, userId: true, user: { select: { email: true } } } },
      throws: { orderBy: [{ round: "asc" }, { attemptInRound: "asc" }] },
    },
  });
  if (!meet) return notFound();

  return <MeetDetailClient meet={meet} />;
}
```

- [ ] **Step 2: Create the client component**

```tsx
// src/app/(dashboard)/coach/competitions/[id]/_meet-detail-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { CompetitionThrowsTable } from "@/components/competitions/CompetitionThrowsTable";
import type {
  CompThrowRow,
  ThrowSaveInput,
} from "@/components/competitions/CompetitionThrowsTable";
import { CompetitionMeetHeader } from "@/components/competitions/CompetitionMeetHeader";
import type { MeetHeaderValue } from "@/components/competitions/CompetitionMeetHeader";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";

type MeetRow = {
  id: string;
  athleteId: string;
  name: string;
  date: string;
  event: string;
  priority: string;
  result: number | null;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
  venueType: "INDOOR" | "OUTDOOR" | null;
  weather: string | null;
  windMps: number | null;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT" | null;
  madeFinals: boolean | null;
  throws: CompThrowRow[];
};

export function MeetDetailClient({ meet }: { meet: MeetRow }) {
  const router = useRouter();
  const toast = useToast();
  const [throws, setThrows] = useState(meet.throws);
  const [meetState, setMeetState] = useState(meet);

  const headerValue: MeetHeaderValue = {
    id: meetState.id,
    name: meetState.name,
    date: meetState.date,
    event: meetState.event,
    placeFinish: meetState.placeFinish,
    meetStatus: meetState.meetStatus,
    venueType: meetState.venueType,
    weather: meetState.weather,
    windMps: meetState.windMps,
    format: meetState.format ?? "THREE_PLUS_THREE",
    madeFinals: meetState.madeFinals,
  };

  const saveHeader = async (patch: Partial<MeetHeaderValue>) => {
    const res = await fetch("/api/throws/competitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: meetState.id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to save meet");
      return;
    }
    setMeetState((m) => ({ ...m, ...patch }));
  };

  const canMakeFinals = throws.some((t) => t.round === "PRELIM");

  const saveThrow = async (input: ThrowSaveInput) => {
    const { id: throwLogId, ...payload } = input;
    const method = throwLogId ? "PATCH" : "POST";
    const qs = throwLogId ? `?throwLogId=${throwLogId}` : "";

    // Map table shape → discriminated-union body
    const body = payload.isFoul
      ? {
          round: payload.round,
          attemptInRound: payload.attemptInRound,
          resultType: "FOUL" as const,
          foulType: payload.foulType,
          notes: payload.notes,
          videoUrl: payload.videoUrl,
          wireLength: payload.wireLength,
        }
      : payload.isPass
        ? {
            round: payload.round,
            attemptInRound: payload.attemptInRound,
            resultType: "PASS" as const,
            notes: payload.notes,
            videoUrl: payload.videoUrl,
            wireLength: payload.wireLength,
          }
        : {
            round: payload.round,
            attemptInRound: payload.attemptInRound,
            resultType: "MARK" as const,
            distance: payload.distance,
            notes: payload.notes,
            videoUrl: payload.videoUrl,
            wireLength: payload.wireLength,
          };

    const res = await fetch(`/api/throws/competitions/${meetState.id}/throws${qs}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to save throw");
      throw new Error(json.error ?? "save failed");
    }
    const updated = json.data.throwLog as CompThrowRow;

    setThrows((prev) => {
      const without = prev.filter((t) => t.id !== updated.id);
      return [...without, updated].sort((a, b) =>
        a.round === b.round ? a.attemptInRound - b.attemptInRound : a.round === "PRELIM" ? -1 : 1
      );
    });

    // PR celebration
    if (json.data.prCelebration) {
      const { event, newPR } = json.data.prCelebration;
      toast.celebration("New Competition PR!", {
        highlight: `${newPR.toFixed(2)}m`,
        description: event.replace("_", " "),
      });
    }

    // First throw clears legacy result server-side; reflect here too
    if (meetState.result != null && throws.length === 0) {
      setMeetState((m) => ({ ...m, result: null }));
    }
  };

  const deleteThrow = async (id: string) => {
    const res = await fetch(`/api/throws/competitions/${meetState.id}/throws?throwLogId=${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to delete throw");
      return;
    }
    setThrows((prev) => prev.filter((t) => t.id !== id));
  };

  const promoteLegacy = async () => {
    const res = await fetch(`/api/throws/competitions/${meetState.id}/promote-legacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to promote");
      return;
    }
    toast.success(json.data.promoted ? "Promoted to unified PR" : "Already recorded");
  };

  return (
    <div className="relative">
      <ScrollProgressBar />
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <CompetitionMeetHeader
          value={headerValue}
          onChange={saveHeader}
          canMakeFinals={canMakeFinals}
        />
        <CompetitionThrowsTable
          meet={{
            id: meetState.id,
            athleteId: meetState.athleteId,
            event: meetState.event,
            format: meetState.format ?? "THREE_PLUS_THREE",
            madeFinals: meetState.madeFinals,
            result: meetState.result,
            name: meetState.name,
          }}
          throws={throws}
          onSave={saveThrow}
          onDelete={deleteThrow}
          onPromoteLegacy={promoteLegacy}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete the legacy results route**

```bash
rm -rf "src/app/(dashboard)/coach/competitions/results/"
```

- [ ] **Step 4: Update `_competitions-client.tsx` to route to the new URL**

Open `src/app/(dashboard)/coach/competitions/_competitions-client.tsx`. Find any `href="/coach/competitions/results?...` or `router.push("/coach/competitions/results...` references and replace with `/coach/competitions/${competitionId}`.

Search:

```bash
grep -n "competitions/results" "src/app/(dashboard)/coach/competitions/_competitions-client.tsx"
```

Update each match to point at `/coach/competitions/${competition.id}`.

- [ ] **Step 5: Refresh coach list page to use the new CompetitionListCard**

Open `src/app/(dashboard)/coach/competitions/_competitions-client.tsx`. Locate the existing list rendering (likely a `.map` over competitions producing inline JSX). Replace each inline card with:

```tsx
import { CompetitionListCard } from "@/components/competitions/CompetitionListCard";
import { StaggeredList } from "@/components/ui/StaggeredList";

// ...inside the component render...
<StaggeredList className="grid gap-3">
  {competitions.map((c) => (
    <CompetitionListCard
      key={c.id}
      item={{
        id: c.id,
        name: c.name,
        date: c.date,
        event: c.event,
        placeFinish: c.placeFinish ?? null,
        meetStatus: c.meetStatus ?? null,
        venueType: c.venueType ?? null,
        bestMark: c.bestMark ?? null,
        throwCount: c.throwCount ?? 0,
      }}
      href={`/coach/competitions/${c.id}`}
    />
  ))}
</StaggeredList>;
```

If the fetch for `competitions` currently returns rows without `bestMark` / `throwCount`, confirm the GET endpoint (Task 10) now populates them — the client just reads what the server provides.

- [ ] **Step 6: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/coach/competitions/"
git commit -m "feat(competitions): coach meet detail page with per-throw editor"
```

---

## Task 21: Athlete competitions list + detail

**Files:**

- Create: `src/app/(dashboard)/athlete/competitions/page.tsx`
- Create: `src/app/(dashboard)/athlete/competitions/[id]/page.tsx`

- [ ] **Step 1: Athlete list page**

```tsx
// src/app/(dashboard)/athlete/competitions/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CompetitionListCard } from "@/components/competitions/CompetitionListCard";
import { StaggeredList } from "@/components/ui/StaggeredList";

export default async function AthleteCompetitionsPage() {
  const session = await getSession();
  if (!session) return notFound();

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) return notFound();

  const competitions = await prisma.throwsCompetition.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { throws: true } },
      throws: { select: { distance: true, isFoul: true, isPass: true } },
    },
  });

  const items = competitions.map((c) => {
    const valid = c.throws
      .filter((t) => !t.isFoul && !t.isPass && t.distance != null)
      .map((t) => t.distance as number);
    const bestMark = valid.length > 0 ? Math.max(...valid) : (c.result ?? null);
    return {
      id: c.id,
      name: c.name,
      date: c.date,
      event: c.event,
      placeFinish: c.placeFinish,
      meetStatus: c.meetStatus,
      venueType: c.venueType,
      bestMark,
      throwCount: c._count.throws,
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 font-heading text-2xl">Competitions</h1>
      {items.length === 0 ? (
        <div className="card p-6 text-center text-muted">
          No competitions logged yet.
          <Link href="/athlete/competitions/new" className="text-primary-500 hover:underline ml-1">
            Log your first meet
          </Link>
          .
        </div>
      ) : (
        <StaggeredList className="grid gap-3">
          {items.map((item) => (
            <CompetitionListCard
              key={item.id}
              item={item}
              href={`/athlete/competitions/${item.id}`}
            />
          ))}
        </StaggeredList>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Athlete meet detail page (reuses the same client as coach)**

```tsx
// src/app/(dashboard)/athlete/competitions/[id]/page.tsx
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MeetDetailClient } from "@/app/(dashboard)/coach/competitions/[id]/_meet-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function AthleteMeetDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, userId: true } },
      throws: { orderBy: [{ round: "asc" }, { attemptInRound: "asc" }] },
    },
  });
  if (!meet) return notFound();
  // Safety net: server-side access gate (API layer already handles it)
  if (meet.athlete.userId !== session.userId) return notFound();

  return <MeetDetailClient meet={meet} />;
}
```

> **Note:** importing `MeetDetailClient` across the coach/athlete boundary is fine — it is marked `"use client"` and has no coach-specific assumptions. If cross-directory client imports cause a build warning, move the client component into `src/components/competitions/MeetDetailClient.tsx` and update both pages to import from there.

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/competitions/"
git commit -m "feat(competitions): athlete competitions list + detail"
```

---

## Task 22: Sidebar nav entries

**Files:**

- Modify: whichever file defines sidebar nav (likely `src/components/layout/Sidebar.tsx` or similar — `grep` to confirm)

- [ ] **Step 1: Locate the sidebar**

```bash
grep -rn "coach/competitions\|athlete/sessions\|athlete/throws" src/components/ | head -5
```

- [ ] **Step 2: Add entries**

In the coach section of the nav config, confirm there is already a "Competitions" entry pointing to `/coach/competitions` (existing page). If absent, add it with a trophy icon.

In the athlete section, add:

```tsx
{ label: "Competitions", href: "/athlete/competitions", icon: Trophy }
```

Use Lucide `Trophy` with `strokeWidth={1.75}` per project convention.

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/layout/
git commit -m "feat(nav): athlete competitions sidebar entry"
```

---

## Task 23: Manual end-to-end verification pass

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Scenario A — coach logs a full meet**

1. Log in as `coach@example.com` / `coach123`.
2. Visit `/coach/competitions`, click Add Meet, fill: name "Test Meet", date today, event Shot Put, Venue Outdoor, Format 3+3, Wind -1.2.
3. Open the new meet. Enter prelim 1 = `18.00`, prelim 2 = Foul Ring, prelim 3 = `18.42`. Verify each row dot flashes save+checkmark.
4. Toggle "Made finals". Enter finals 1 = `18.50`, finals 2 = Pass, finals 3 = `19.00`.
5. Verify a celebration toast appears on the final (the PR).
6. Verify the meet list at `/coach/competitions` shows `bestMark=19.00` and `throwCount=6`.

- [ ] **Step 3: Scenario B — athlete edits own meet**

1. In a second browser (or incognito), log in as `athlete1@example.com` / `athlete123`.
2. Visit `/athlete/competitions`, open the meet you just created.
3. Edit prelim 2 from Foul to Mark `17.90`. Verify save.
4. Check `/athlete/notifications` — confirm `COMPETITION_PR` notification for the 19.00m throw.

- [ ] **Step 4: Scenario C — legacy promotion**

1. Open Prisma Studio: `POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx prisma studio`.
2. Create a `ThrowsCompetition` row directly: `athleteId = <athlete1.id>`, `result = 19.50`, zero linked throws. Save.
3. As coach, open the meet. Verify legacy banner appears. Click "Promote to Unified PR".
4. Verify `AthleteProfile.competitionPRs` for that athlete now contains `{ "SHOT_PUT": 19.50 }` (or higher of current/19.50).

- [ ] **Step 5: Scenario D — delete cascade**

1. As coach, delete a throw from the meet. Verify row clears.
2. Delete the entire meet. Verify all linked `ThrowLog` rows are gone (check Prisma Studio).

- [ ] **Step 6: Final lint + typecheck**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: zero errors, all tests pass.

- [ ] **Step 7: Final commit + Notion log**

```bash
git add -A
git diff --cached  # review anything small left over
git commit -m "chore(competitions): verified e2e across coach + athlete flows" --allow-empty
```

Log to Notion Activity Log per project convention:

- Task: "Competition Logging v2 — ship"
- Category: Feature
- Status: Completed
- Impact: High
- Description: "Structured per-throw competition logging with rounds, fouls, per-meet context. Unified PR resolver picks up throws automatically. Legacy data preserved behind promotion flow."

---

## Self-Review Checklist

Run through these before handing off:

- [ ] Every task has concrete code, exact file paths, and explicit commands — no TBDs
- [ ] Schema migration runs locally against `podium_throws` Postgres (not prod Supabase)
- [ ] Zod schemas use `.nullable().optional()` for fields that come from React form state (project rule #4)
- [ ] API routes return `{ success, data | error }` (project rule #2)
- [ ] No empty catch blocks; all errors logged AND surfaced to user via toast (project rule #1)
- [ ] Overlay surfaces use `bg-[var(--surface-overlay)]` not translucent (project overlay rule)
- [ ] Navigable cards use `card-interactive` class (project card rule)
- [ ] Animated numbers wrap with `<AnimatedNumber>` or `<NumberFlow>` (project numeric display rule)
- [ ] Tests use vitest (not jest)
- [ ] No commits pushed automatically — batching rule

## Out-of-scope reminders (stop and ask)

If any of these come up during execution, stop:

- Trend analysis / correlation — sub-project B
- Coach-gating athlete insight detail — sub-project C
- Offline queue for live meet mode — deferred polish
- Indoor-vs-outdoor PR distinction — flagged in spec, separate follow-up
- Bondarchuk engine changes — engine overhaul complete
