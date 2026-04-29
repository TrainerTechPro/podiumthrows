import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn };
});

const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma = {
    throwsAssignment: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  };
  return { prisma, default: prisma };
});

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { getAssignmentDetailForCoach } from "../coach";

describe("getAssignmentDetailForCoach — ownership gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the assignment when the requesting coach owns the athlete", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      athleteId: "ath1",
      athlete: { id: "ath1", coachId: "coach1", firstName: "X", lastName: "Y" },
    });

    const result = await getAssignmentDetailForCoach("coach1", "a1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("a1");
  });

  it("returns null when a different coach requests the assignment", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      athleteId: "ath1",
      athlete: { id: "ath1", coachId: "coach1", firstName: "X", lastName: "Y" },
    });

    const result = await getAssignmentDetailForCoach("coach2", "a1");
    expect(result).toBeNull();
  });

  it("returns null when the assignment does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getAssignmentDetailForCoach("coach1", "missing");
    expect(result).toBeNull();
  });
});
