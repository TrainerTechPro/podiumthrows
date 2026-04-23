import { describe, it, expect } from "vitest";
import { CoachProfileUpdateSchema } from "@/lib/api-schemas";

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
