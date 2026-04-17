import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import { parseQuery, LogSessionSchema, ThrowsSessionCreateSchema } from "@/lib/api-schemas";
import * as S from "@/lib/api-schemas";

describe("parseQuery", () => {
  const Schema = z.object({
    range: z.enum(["7d", "30d", "all"]).default("30d"),
    prOnly: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),
  });

  it("parses valid query params into the schema", () => {
    const req = new Request("http://localhost/api/x?range=7d&prOnly=true");
    const result = parseQuery(req, Schema);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.range).toBe("7d");
      expect(result.prOnly).toBe(true);
    }
  });

  it("returns NextResponse(400) with fieldErrors for invalid enum", async () => {
    const req = new Request("http://localhost/api/x?range=bogus");
    const result = parseQuery(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Invalid query parameters");
      expect(Array.isArray(body.fieldErrors)).toBe(true);
      expect(body.fieldErrors.length).toBeGreaterThan(0);
      expect(body.fieldErrors[0]).toHaveProperty("field");
      expect(body.fieldErrors[0]).toHaveProperty("message");
    }
  });

  it("applies defaults for missing params", () => {
    const req = new Request("http://localhost/api/x");
    const result = parseQuery(req, Schema);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.range).toBe("30d");
      expect(result.prOnly).toBe(false);
    }
  });
});

describe("LogSessionSchema (Bondarchuk sequencing)", () => {
  const baseSession = {
    event: "SHOT_PUT",
    date: "2026-04-14",
  };

  it("accepts a descending drill sequence", () => {
    const parsed = LogSessionSchema.safeParse({
      ...baseSession,
      drills: [
        { drillType: "FULL_THROW", implementWeight: 9, throwCount: 5 },
        { drillType: "FULL_THROW", implementWeight: 8, throwCount: 5 },
        { drillType: "FULL_THROW", implementWeight: 7.26, throwCount: 5 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an ascending drill sequence", () => {
    const parsed = LogSessionSchema.safeParse({
      ...baseSession,
      drills: [
        { drillType: "FULL_THROW", implementWeight: 6, throwCount: 5 },
        { drillType: "FULL_THROW", implementWeight: 8, throwCount: 5 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      expect(message.toLowerCase()).toContain("bondarchuk");
      expect(message).toContain("8");
      expect(message).toContain("6");
    }
  });

  it("allows drills with null/missing implement weights interspersed", () => {
    const parsed = LogSessionSchema.safeParse({
      ...baseSession,
      drills: [
        { drillType: "WARMUP", throwCount: 0 },
        { drillType: "FULL_THROW", implementWeight: 9, throwCount: 5 },
        { drillType: "COOLDOWN", throwCount: 0 },
        { drillType: "FULL_THROW", implementWeight: 7.26, throwCount: 5 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("points the error at the offending drill's implementWeight", () => {
    const parsed = LogSessionSchema.safeParse({
      ...baseSession,
      drills: [
        { drillType: "FULL_THROW", implementWeight: 9, throwCount: 5 },
        { drillType: "SPIN", implementWeight: 7.26, throwCount: 5 },
        { drillType: "STANDING", implementWeight: 8, throwCount: 5 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].path).toEqual(["drills", 2, "implementWeight"]);
    }
  });
});

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
      meetStatus: null,
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

describe("ThrowsSessionCreateSchema (block ordering)", () => {
  const baseSession = {
    name: "Test session",
    sessionType: "THROWS",
    event: "SHOT_PUT",
  };

  it("accepts the canonical THROWING → STRENGTH → THROWING → STRENGTH structure", () => {
    const parsed = ThrowsSessionCreateSchema.safeParse({
      ...baseSession,
      blocks: [
        { blockType: "THROWING", position: 0, config: {} },
        { blockType: "STRENGTH", position: 1, config: {} },
        { blockType: "THROWING", position: 2, config: {} },
        { blockType: "STRENGTH", position: 3, config: {} },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects two adjacent THROWING blocks with a path pointing at the offender", () => {
    const parsed = ThrowsSessionCreateSchema.safeParse({
      ...baseSession,
      blocks: [
        { blockType: "THROWING", position: 0, config: {} },
        { blockType: "THROWING", position: 1, config: {} },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      expect(issue.message.toLowerCase()).toContain("bondarchuk");
      expect(issue.path).toEqual(["blocks", 1, "blockType"]);
    }
  });

  it("rejects an unknown blockType string (enum enforcement)", () => {
    const parsed = ThrowsSessionCreateSchema.safeParse({
      ...baseSession,
      blocks: [{ blockType: "BOGUS", position: 0, config: {} }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts sessions with no blocks", () => {
    const parsed = ThrowsSessionCreateSchema.safeParse(baseSession);
    expect(parsed.success).toBe(true);
  });

  it("accepts new semantic types (MOBILITY, RECOVERY, CONDITIONING)", () => {
    const parsed = ThrowsSessionCreateSchema.safeParse({
      ...baseSession,
      blocks: [
        { blockType: "MOBILITY", position: 0, config: {} },
        { blockType: "THROWING", position: 1, config: {} },
        { blockType: "CONDITIONING", position: 2, config: {} },
        { blockType: "RECOVERY", position: 3, config: {} },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

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

describe("CompetitionThrowUpdateSchema", () => {
  it("accepts a notes-only body", () => {
    const r = S.CompetitionThrowUpdateSchema.parse({ notes: "great technique" });
    expect(r).toMatchObject({ notes: "great technique" });
  });

  it("accepts a full MARK update", () => {
    const r = S.CompetitionThrowUpdateSchema.parse({
      round: "PRELIM",
      attemptInRound: 2,
      resultType: "MARK",
      distance: 18.5,
    });
    expect(r).toMatchObject({ resultType: "MARK", distance: 18.5 });
  });

  it("still rejects MARK without distance when resultType IS provided", () => {
    expect(() => S.CompetitionThrowUpdateSchema.parse({ resultType: "MARK" })).toThrow();
  });
});
