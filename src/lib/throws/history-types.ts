import type { EventType } from "@prisma/client";

/** One drill row inside an expanded day — shown to the user one per line. */
export type HistoryDrill = {
  source: "assigned" | "free";
  event: EventType;
  implementKg: number;
  implementLabel: string; // e.g. "7.26kg"
  drillType: string | null; // e.g. "FULL_THROW", "STANDING" — nullable for free logs
  drillTypeLabel: string | null; // e.g. "Full Throw" — display form
  throwCount: number;
  bestMark: number | null; // meters, nullable if no distance recorded
  isPersonalBest: boolean;
};

/** One day in the timeline — groups drills from both assigned and free sources. */
export type HistoryDay = {
  /** ISO date string, YYYY-MM-DD, in the athlete's local calendar */
  date: string;
  /** Pre-computed weekday abbreviation for display (e.g. "TUE") */
  weekdayShort: string;
  /** Pre-computed formatted date for display (e.g. "Apr 8") */
  dateLabel: string;
  /** Unique events that appear on this day (used for badge row) */
  events: EventType[];
  /** Total throws across all drills on this day */
  totalThrows: number;
  /** Best mark across all drills on this day (meters, nullable) */
  bestMarkOverall: number | null;
  /** True if any drill on this day was a PR */
  hasPR: boolean;
  /** All drills for this day, in the order the athlete logged them */
  drills: HistoryDrill[];
  /** Assignment ID if this day had an assigned session (for "View full session" link) */
  assignmentId: string | null;
};

/** Filter state from the client, sent as query params */
export type HistoryFilter = {
  range: "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
  start: string | null; // ISO date, only when range=custom
  end: string | null;   // ISO date, only when range=custom
  events: EventType[];  // empty array = all events
  implementsKg: number[]; // empty array = all implements
  prOnly: boolean;
};

/** API response payload */
export type HistoryResponse = {
  days: HistoryDay[];
  nextCursor: string | null;
  totals: {
    sessions: number;
    throws: number;
  };
};
