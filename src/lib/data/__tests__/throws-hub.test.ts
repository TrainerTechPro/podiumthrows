import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing the fetcher.
const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    throwsAssignment: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { fetchUpcomingThrowsAssignments } from "../throws-hub";

describe("fetchUpcomingThrowsAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the right shape (array of UpcomingSessionItem)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "asgn-1",
        assignedDate: "2026-04-15",
        status: "ASSIGNED",
        session: { event: "SHOT_PUT", name: "Heavy Day" },
      },
      {
        id: "asgn-2",
        assignedDate: "2026-04-16",
        status: "NOTIFIED",
        session: { event: "DISCUS", name: "Comp Sim" },
      },
    ]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "asgn-1",
      scheduledDate: "2026-04-15",
      status: "ASSIGNED",
      planName: "Heavy Day",
      coachNotes: null,
    });
    expect(result[1].planName).toBe("Comp Sim");
  });

  it("filters to ASSIGNED / NOTIFIED / IN_PROGRESS only — excludes COMPLETED, SKIPPED, PARTIAL", async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchUpcomingThrowsAssignments("athlete-1");

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual(["ASSIGNED", "NOTIFIED", "IN_PROGRESS"]);
    expect(call.where.athleteId).toBe("athlete-1");
    expect(call.orderBy).toEqual({ assignedDate: "asc" });
    expect(call.take).toBe(3);
  });

  it("returns empty array for athletes with no upcoming assignments", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toEqual([]);
  });
});
