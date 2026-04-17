// src/lib/data/__tests__/personal-records.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// React.cache is a server-side memoization primitive not available in Vitest's
// jsdom/node environment. Stub it as a passthrough so the module can be imported.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn };
});

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
