import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-schemas";

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
