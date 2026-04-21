import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUpcomingActivity = vi.fn();

vi.mock("@/lib/data/athlete-activity", () => ({
  getUpcomingActivity: (...a: unknown[]) => mockGetUpcomingActivity(...a),
}));

import { fetchUpcomingThrowsAssignments } from "../throws-hub";

describe("fetchUpcomingThrowsAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps ActivityItem → UpcomingSessionItem shape", async () => {
    mockGetUpcomingActivity.mockResolvedValue([
      {
        id: "asgn-1",
        source: "assigned-throws",
        kind: "throws",
        event: "SHOT_PUT",
        status: "planned",
        scheduledAt: new Date("2026-04-25T12:00:00.000Z"),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "Heavy Day",
        href: "/athlete/sessions/assignment/asgn-1",
        coachFeedback: null,
      },
      {
        id: "asgn-2",
        source: "assigned-throws",
        kind: "throws",
        event: "DISCUS",
        status: "active",
        scheduledAt: new Date("2026-04-26T12:00:00.000Z"),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "Comp Sim",
        href: "/athlete/throws/live/asgn-2",
        coachFeedback: null,
      },
    ]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "asgn-1",
      scheduledDate: "2026-04-25T12:00:00.000Z",
      status: "ASSIGNED",
      planName: "Heavy Day",
      coachNotes: null,
    });
    expect(result[1]).toEqual({
      id: "asgn-2",
      scheduledDate: "2026-04-26T12:00:00.000Z",
      status: "IN_PROGRESS",
      planName: "Comp Sim",
      coachNotes: null,
    });
  });

  it("filters out non-throws items — strength-only training sessions don't pollute the throws widget", async () => {
    mockGetUpcomingActivity.mockResolvedValue([
      {
        id: "a1",
        source: "assigned-throws",
        kind: "throws",
        event: "SHOT_PUT",
        status: "planned",
        scheduledAt: new Date("2026-04-25T12:00:00.000Z"),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "Throws",
        href: "/x",
        coachFeedback: null,
      },
      {
        id: "t1",
        source: "assigned-training",
        kind: "strength",
        event: null,
        status: "planned",
        scheduledAt: new Date("2026-04-26T12:00:00.000Z"),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "Lift Day",
        href: "/y",
        coachFeedback: null,
      },
    ]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result.map((r) => r.id)).toEqual(["a1"]);
  });

  it("caps at 3 items", async () => {
    mockGetUpcomingActivity.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        source: "assigned-throws",
        kind: "throws",
        event: "SHOT_PUT",
        status: "planned",
        scheduledAt: new Date(`2026-04-${20 + i}T12:00:00.000Z`),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "x",
        href: "/x",
        coachFeedback: null,
      }))
    );

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toHaveLength(3);
  });

  it("returns empty for athletes with no upcoming throws", async () => {
    mockGetUpcomingActivity.mockResolvedValue([]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toEqual([]);
  });

  it("maps partial + skipped status correctly", async () => {
    mockGetUpcomingActivity.mockResolvedValue([
      {
        id: "a-partial",
        source: "assigned-throws",
        kind: "throws",
        event: "HAMMER",
        status: "partial",
        scheduledAt: new Date("2026-04-20T12:00:00.000Z"),
        completedAt: null,
        assignedBy: "coach",
        metrics: {},
        title: "x",
        href: "/x",
        coachFeedback: null,
      },
    ]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");
    expect(result[0].status).toBe("PARTIAL");
  });
});
