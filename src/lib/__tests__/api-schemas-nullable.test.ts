import { describe, it, expect } from "vitest";
import {
  AthleteBioUpdateSchema,
  CoachProfileUpdateSchema,
  RegisterSchema,
} from "@/lib/api-schemas";

/**
 * Regression tests for CLAUDE.md §4: Zod fields that originate in a React
 * form submitting `field || null` must accept null. `.optional()` alone
 * rejects null and produces opaque validation failures.
 */
describe("CoachProfileUpdateSchema — null-from-form tolerance", () => {
  it("accepts null for bio (coach clears the field)", () => {
    const result = CoachProfileUpdateSchema.safeParse({ bio: null });
    expect(result.success).toBe(true);
  });

  it("accepts null for organization (coach clears the field)", () => {
    const result = CoachProfileUpdateSchema.safeParse({ organization: null });
    expect(result.success).toBe(true);
  });

  it("accepts the exact payload shape the settings form submits", () => {
    const payload = {
      firstName: "Jane",
      lastName: "Doe",
      bio: null,
      organization: null,
    };
    const result = CoachProfileUpdateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("still rejects non-string non-null values", () => {
    const result = CoachProfileUpdateSchema.safeParse({ bio: 42 });
    expect(result.success).toBe(false);
  });
});

describe("AthleteBioUpdateSchema — null-from-form tolerance", () => {
  it("accepts the exact payload shape the coach profile form submits when fields are cleared", () => {
    const payload = {
      athleteId: "clxxxxxxxxxxxxxxxxxxxxxxx",
      gender: null,
      sport: null,
      height: null,
      weight: null,
      dateOfBirth: null,
    };
    const result = AthleteBioUpdateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts a valid gender enum", () => {
    const result = AthleteBioUpdateSchema.safeParse({
      athleteId: "clxxxxxxxxxxxxxxxxxxxxxxx",
      gender: "MALE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown gender value", () => {
    const result = AthleteBioUpdateSchema.safeParse({
      athleteId: "clxxxxxxxxxxxxxxxxxxxxxxx",
      gender: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });
});

describe("RegisterSchema — null tolerance for URL-origin fields", () => {
  const baseValid = {
    email: "new.coach@example.com",
    password: "Str0ngPass",
    firstName: "Jane",
    lastName: "Doe",
    role: "COACH" as const,
  };

  it("accepts null for inviteToken/leadId/plan/interval", () => {
    const result = RegisterSchema.safeParse({
      ...baseValid,
      inviteToken: null,
      leadId: null,
      plan: null,
      interval: null,
    });
    expect(result.success).toBe(true);
  });

  it("still accepts undefined (omitted)", () => {
    const result = RegisterSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });
});
