import { describe, it, expect } from "vitest";
import { parseApiError } from "@/lib/form-errors";

function mockResponse(status: number): Response {
  return { status, ok: status < 400 } as Response;
}

describe("parseApiError", () => {
  it("classifies network failure (TypeError) as NETWORK_ERROR + retryable", () => {
    const info = parseApiError({ err: new TypeError("Failed to fetch") });
    expect(info.code).toBe("NETWORK_ERROR");
    expect(info.isNetworkError).toBe(true);
    expect(info.retryable).toBe(true);
  });

  it("classifies any thrown error without a Response as NETWORK_ERROR", () => {
    const info = parseApiError({ err: new Error("aborted") });
    expect(info.code).toBe("NETWORK_ERROR");
    expect(info.retryable).toBe(true);
  });

  it("classifies 401 as AUTH_EXPIRED + not retryable", () => {
    const info = parseApiError({
      res: mockResponse(401),
      payload: { success: false, error: "Unauthorized" },
    });
    expect(info.code).toBe("AUTH_EXPIRED");
    expect(info.retryable).toBe(false);
  });

  it("classifies 403 as FORBIDDEN and uses the server message", () => {
    const info = parseApiError({
      res: mockResponse(403),
      payload: { success: false, error: "Goal belongs to another athlete." },
    });
    expect(info.code).toBe("FORBIDDEN");
    expect(info.message).toContain("another athlete");
  });

  it("classifies 404 as NOT_FOUND", () => {
    const info = parseApiError({
      res: mockResponse(404),
      payload: { success: false, error: "Goal not found." },
    });
    expect(info.code).toBe("NOT_FOUND");
  });

  it("classifies 422 as VALIDATION_ERROR and surfaces fieldErrors", () => {
    const info = parseApiError({
      res: mockResponse(422),
      payload: {
        success: false,
        error: "Validation failed",
        fieldErrors: { title: "Title is required", target: "Must be positive" },
      },
    });
    expect(info.code).toBe("VALIDATION_ERROR");
    expect(info.fieldErrors).toEqual({
      title: "Title is required",
      target: "Must be positive",
    });
  });

  it("classifies 400 with fieldErrors as VALIDATION_ERROR", () => {
    const info = parseApiError({
      res: mockResponse(400),
      payload: {
        success: false,
        error: "Validation failed",
        fieldErrors: { email: "Invalid email" },
      },
    });
    expect(info.code).toBe("VALIDATION_ERROR");
  });

  it("classifies 429 as RATE_LIMIT + retryable", () => {
    const info = parseApiError({ res: mockResponse(429), payload: { success: false } });
    expect(info.code).toBe("RATE_LIMIT");
    expect(info.retryable).toBe(true);
  });

  it("classifies 500/502/503 as SERVER_ERROR + retryable", () => {
    expect(parseApiError({ res: mockResponse(500), payload: {} }).code).toBe("SERVER_ERROR");
    expect(parseApiError({ res: mockResponse(502), payload: {} }).code).toBe("SERVER_ERROR");
    expect(parseApiError({ res: mockResponse(503), payload: {} }).code).toBe("SERVER_ERROR");
    expect(parseApiError({ res: mockResponse(503), payload: {} }).retryable).toBe(true);
  });

  it("uses action-oriented message for SERVER_ERROR (not the raw 'Internal Server Error')", () => {
    const info = parseApiError({
      res: mockResponse(500),
      payload: { success: false, error: "Internal Server Error" },
    });
    expect(info.message).not.toMatch(/internal/i);
    expect(info.message).toMatch(/our end/i);
  });

  it("ignores malformed fieldErrors (non-string values)", () => {
    const info = parseApiError({
      res: mockResponse(422),
      payload: { success: false, fieldErrors: { title: 42 } },
    });
    expect(info.fieldErrors).toBeUndefined();
  });

  it("falls back to UNKNOWN for an unparseable response", () => {
    const info = parseApiError({ res: mockResponse(418), payload: null });
    expect(info.code).toBe("UNKNOWN");
  });

  it("never throws — handles totally empty input", () => {
    const info = parseApiError({});
    expect(info.code).toBe("UNKNOWN");
  });
});
