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
    expect(result[0].selfLoggedSessionId).toBeNull();
  });

  it("aggregates self-logged AthleteThrowsSession drills into the day bucket", () => {
    const selfLoggedSessions = [
      {
        id: "sl1",
        event: "HAMMER" as const,
        date: "2026-04-09",
        drillLogs: [
          { drillType: "FULL_THROW", implementWeight: 7.26, throwCount: 12, bestMark: 66.87 },
          { drillType: "STANDING", implementWeight: 7.26, throwCount: 8, bestMark: null },
        ],
      },
    ];

    const result = aggregateHistoryDays({ throwLogs: [], blockLogs: [], selfLoggedSessions });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-09");
    expect(result[0].selfLoggedSessionId).toBe("sl1");
    expect(result[0].totalThrows).toBe(20);
    expect(result[0].bestMarkOverall).toBe(66.87);
    expect(result[0].events).toEqual(["HAMMER"]);
    expect(result[0].drills).toHaveLength(2);
    expect(result[0].drills[0].drillTypeLabel).toBe("Full Throw");
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

  it("supports cursor-based pagination by slicing aggregated days", () => {
    // Simulate 5 days of data. With a page size of 3, the route handler
    // would slice to 3 days and set nextCursor = days[2].date ("2026-04-04").
    // The second page would then filter to dates < "2026-04-04", getting
    // the remaining 2 days.
    const throwLogs = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementWeight: 7.26,
      distance: 16 + i,
      date: new Date(`2026-04-0${i + 1}T12:00:00Z`),
      isPersonalBest: false,
      isCompetition: false,
      sessionId: null,
    }));

    const allDays = aggregateHistoryDays({ throwLogs, blockLogs: [] });
    expect(allDays).toHaveLength(5);
    // Days are reverse-chron: 04-05, 04-04, 04-03, 04-02, 04-01
    expect(allDays[0].date).toBe("2026-04-05");
    expect(allDays[4].date).toBe("2026-04-01");

    // Page 1: first 3 days
    const page1 = allDays.slice(0, 3);
    expect(page1.map((d) => d.date)).toEqual(["2026-04-05", "2026-04-04", "2026-04-03"]);
    const cursor = page1[page1.length - 1].date; // "2026-04-03"

    // Page 2: simulate filtering to dates before cursor
    const page2Logs = throwLogs.filter((t) => t.date < new Date(`${cursor}T00:00:00`));
    const page2Days = aggregateHistoryDays({ throwLogs: page2Logs, blockLogs: [] });
    expect(page2Days.map((d) => d.date)).toEqual(["2026-04-02", "2026-04-01"]);
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
