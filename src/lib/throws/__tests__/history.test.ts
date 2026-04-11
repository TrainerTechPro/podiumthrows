import { describe, it, expect, vi } from "vitest";
import { aggregateHistoryDays } from "../history";
import type { HistoryDay } from "../history-types";

describe("aggregateHistoryDays", () => {
  it("groups ThrowLog rows by date", () => {
    const throwLogs = [
      {
        id: "t1",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 7.26,
        distance: 18.42,
        date: new Date("2026-04-08T14:30:00Z"),
        isPersonalBest: true,
        isCompetition: false,
        sessionId: null,
      },
      {
        id: "t2",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 7.26,
        distance: 18.10,
        date: new Date("2026-04-08T14:35:00Z"),
        isPersonalBest: false,
        isCompetition: false,
        sessionId: null,
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-08");
    expect(result[0].totalThrows).toBe(2);
    expect(result[0].bestMarkOverall).toBe(18.42);
    expect(result[0].hasPR).toBe(true);
    expect(result[0].events).toEqual(["SHOT_PUT"]);
    expect(result[0].assignmentId).toBeNull();
  });

  it("aggregates assigned-session throws via their ThrowsAssignment.assignedDate", () => {
    const blockLogs = [
      {
        id: "bl1",
        throwNumber: 1,
        distance: 17.5,
        implement: "7.26kg",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-07",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT" as const, name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
    ];

    const result = aggregateHistoryDays({ throwLogs: [], blockLogs });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-07");
    expect(result[0].assignmentId).toBe("asgn1");
    expect(result[0].totalThrows).toBe(1);
    expect(result[0].drills[0].source).toBe("assigned");
  });

  it("merges same-day assigned and free logs into one HistoryDay", () => {
    const throwLogs = [
      {
        id: "t1",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 8,
        distance: 16.2,
        date: new Date("2026-04-08T09:00:00Z"),
        isPersonalBest: false,
        isCompetition: false,
        sessionId: null,
      },
    ];
    const blockLogs = [
      {
        id: "bl1",
        throwNumber: 1,
        distance: 17.5,
        implement: "7.26kg",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-08",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT" as const, name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs });

    expect(result).toHaveLength(1);
    expect(result[0].totalThrows).toBe(2);
    expect(result[0].drills).toHaveLength(2);
  });

  it("sorts days in reverse chronological order", () => {
    const throwLogs = [
      {
        id: "t1", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 16, date: new Date("2026-04-01T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
      {
        id: "t2", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 17, date: new Date("2026-04-08T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
      {
        id: "t3", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 15, date: new Date("2026-04-05T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });

    expect(result.map((d) => d.date)).toEqual(["2026-04-08", "2026-04-05", "2026-04-01"]);
  });

  it("returns empty array when no logs exist", () => {
    const result = aggregateHistoryDays({ throwLogs: [], blockLogs: [] });
    expect(result).toEqual<HistoryDay[]>([]);
  });

  it("skips ThrowsBlockLog rows with unparseable implement strings", () => {
    const blockLogs = [
      {
        id: "bl-bad",
        throwNumber: 1,
        distance: 17.5,
        implement: "garbage",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-08",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT" as const, name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
      {
        id: "bl-good",
        throwNumber: 2,
        distance: 18.0,
        implement: "7.26kg",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-08",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT" as const, name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
    ];

    // Mute the warning for this test only.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = aggregateHistoryDays({ throwLogs: [], blockLogs });

    expect(result).toHaveLength(1);
    expect(result[0].drills).toHaveLength(1);
    expect(result[0].drills[0].implementKg).toBe(7.26);
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});
