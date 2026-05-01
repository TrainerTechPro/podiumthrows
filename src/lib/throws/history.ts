import type { EventType } from "@prisma/client";
import type { HistoryDay, HistoryDrill } from "./history-types";
import { formatImplementDisplay } from "@/lib/throws/display";
import { getLocalDate } from "@/lib/dates";

import { logger } from "@/lib/logger";
// Narrow shapes — only the fields we read. Keeps tests lightweight.
export type ThrowLogInput = {
  id: string;
  athleteId: string;
  event: EventType;
  implementId: string | null;
  implementWeight: number;
  distance: number | null;
  date: Date;
  isPersonalBest: boolean;
  isCompetition: boolean;
  isFoul: boolean;
  sessionId: string | null;
  throwNumber: number | null;
  notes: string | null;
};

export type BlockLogInput = {
  id: string;
  throwNumber: number;
  distance: number | null;
  implement: string; // e.g. "7.26kg"
  assignment: {
    id: string;
    assignedDate: string; // ISO date string
    athleteId: string;
    status: string;
    session: { event: EventType; name: string };
  };
  block: { blockType: string; config: string };
};

export type SelfLoggedSessionInput = {
  id: string;
  event: EventType | string; // EventType from ThrowLog, string from AthleteThrowsSession
  date: string; // YYYY-MM-DD
  drillLogs: Array<{
    drillType: string;
    implementWeight: number | null;
    throwCount: number;
    bestMark: number | null;
  }>;
};

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function isoDay(d: Date | string, timezone?: string | null): string {
  if (typeof d === "string") return d.slice(0, 10); // ISO date already
  if (timezone) return getLocalDate(timezone, d);
  return d.toISOString().slice(0, 10); // UTC fallback
}

function labelsFor(isoDate: string): { weekdayShort: string; dateLabel: string } {
  // isoDate is YYYY-MM-DD; parse at local noon to dodge timezone edge cases.
  const d = new Date(`${isoDate}T12:00:00`);
  return {
    weekdayShort: WEEKDAY_SHORT[d.getDay()],
    dateLabel: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
  };
}

function parseImplementKg(label: string): number {
  const n = parseFloat(label);
  // NaN is the parse-failure sentinel; the caller filters these out so a
  // malformed implement string doesn't masquerade as a valid 0kg drill.
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseDrillTypeFromBlockConfig(configJson: string): {
  drillType: string | null;
  label: string | null;
} {
  try {
    const parsed = JSON.parse(configJson) as { drillType?: string };
    const drillType = parsed.drillType ?? null;
    if (!drillType) return { drillType: null, label: null };
    const label = drillType
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { drillType, label };
  } catch {
    return { drillType: null, label: null };
  }
}

/** Canonical PR distances per event, used to detect PRs for assigned/self-logged drills. */
export type PRContext = Record<string, { distance: number; weightKg: number }>;

const WEIGHT_TOLERANCE = 0.05; // kg — matches the canonical PR layer's tolerance

type DayBucket = {
  date: string;
  drills: HistoryDrill[];
  events: Set<EventType>;
  assignmentId: string | null;
  selfLoggedSessionId: string | null;
};

export function aggregateHistoryDays(input: {
  throwLogs: ThrowLogInput[];
  blockLogs: BlockLogInput[];
  selfLoggedSessions?: SelfLoggedSessionInput[];
  prContext?: PRContext;
  gender?: string | null;
  timezone?: string | null;
}): HistoryDay[] {
  const buckets = new Map<string, DayBucket>();

  // Bucket free logs by their own date
  // Group same-event/same-implement throws into one "drill row" for display density.
  type FreeKey = string; // `${event}|${implementKg}|${date}`
  type FreeAccumulator = {
    drill: HistoryDrill;
    rawThrows: ThrowLogInput[]; // collected for per-throw data + bestThrowLogId resolution
  };
  const freeGroups = new Map<FreeKey, FreeAccumulator>();

  for (const log of input.throwLogs) {
    const date = isoDay(log.date, input.timezone);
    const key = `${log.event}|${log.implementWeight}|${date}`;
    const existing = freeGroups.get(key);
    if (existing) {
      existing.drill.throwCount += 1;
      if (
        log.distance != null &&
        (existing.drill.bestMark == null || log.distance > existing.drill.bestMark)
      ) {
        existing.drill.bestMark = log.distance;
      }
      if (log.isPersonalBest) existing.drill.isPersonalBest = true;
      existing.rawThrows.push(log);
    } else {
      freeGroups.set(key, {
        drill: {
          source: "free",
          event: log.event,
          implementKg: log.implementWeight,
          implementLabel: formatImplementDisplay(log.implementWeight, log.event, input.gender, {
            compact: true,
          }),
          drillType: null,
          drillTypeLabel: null,
          throwCount: 1,
          bestMark: log.distance ?? null,
          isPersonalBest: log.isPersonalBest,
          bestThrowLogId: null, // resolved after the loop
          throws: [], // populated after the loop
        },
        rawThrows: [log],
      });
    }
  }

  // Materialize throws[] and bestThrowLogId per free-log drill.
  for (const acc of freeGroups.values()) {
    const sorted = [...acc.rawThrows].sort((a, b) => {
      // Sort by throwNumber ascending. Nulls last.
      if (a.throwNumber == null && b.throwNumber == null) return 0;
      if (a.throwNumber == null) return 1;
      if (b.throwNumber == null) return -1;
      return a.throwNumber - b.throwNumber;
    });
    acc.drill.throws = sorted.map((t) => ({
      id: t.id,
      throwNumber: t.throwNumber,
      distance: t.distance,
      performedAt: t.date.toISOString(),
      isCompetition: t.isCompetition,
      isFoul: t.isFoul,
      notes: t.notes,
      implementId: t.implementId,
      implementDisplayLabel: acc.drill.implementLabel,
    }));

    // bestThrowLogId: highest non-foul distance. Tie-breaker: earliest performedAt.
    const candidates = sorted.filter((t) => !t.isFoul && t.distance != null);
    if (candidates.length > 0) {
      const max = candidates.reduce((a, b) =>
        (b.distance as number) > (a.distance as number)
          ? b
          : (b.distance as number) < (a.distance as number)
            ? a
            : b.date < a.date
              ? b
              : a
      );
      acc.drill.bestThrowLogId = max.id;
    }
  }

  for (const [key, acc] of freeGroups.entries()) {
    const date = key.split("|")[2];
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
      selfLoggedSessionId: null,
    };
    bucket.drills.push(acc.drill);
    bucket.events.add(acc.drill.event);
    buckets.set(date, bucket);
  }

  // Bucket block logs by assignment.assignedDate
  // Group by (assignmentId, blockId) → one drill row per block.
  type BlockKey = string; // `${assignmentId}|${drillType}|${implement}`
  const blockGroups = new Map<
    BlockKey,
    { drill: HistoryDrill; date: string; assignmentId: string }
  >();

  for (const bl of input.blockLogs) {
    const date = bl.assignment.assignedDate;
    const event = bl.assignment.session.event;
    const drillInfo = parseDrillTypeFromBlockConfig(bl.block.config);
    const implementKg = parseImplementKg(bl.implement);

    // Skip malformed implement strings — log so we can chase the data quality issue
    // upstream rather than silently rendering "0kg" or NaN drills in the UI.
    if (Number.isNaN(implementKg)) {
      logger.warn(
        `[history] Skipping ThrowsBlockLog ${bl.id}: unparseable implement "${bl.implement}"`,
        { context: "throws/history" }
      );
      continue;
    }

    const key = `${bl.assignment.id}|${drillInfo.drillType ?? "unknown"}|${bl.implement}`;

    const existing = blockGroups.get(key);
    if (existing) {
      existing.drill.throwCount += 1;
      if (
        bl.distance != null &&
        (existing.drill.bestMark == null || bl.distance > existing.drill.bestMark)
      ) {
        existing.drill.bestMark = bl.distance;
      }
    } else {
      blockGroups.set(key, {
        drill: {
          source: "assigned",
          event,
          implementKg,
          implementLabel: formatImplementDisplay(implementKg, event, input.gender, {
            compact: true,
          }),
          drillType: drillInfo.drillType,
          drillTypeLabel: drillInfo.label,
          throwCount: 1,
          bestMark: bl.distance ?? null,
          isPersonalBest: false,
          bestThrowLogId: null,
          throws: [],
        },
        date,
        assignmentId: bl.assignment.id,
      });
    }
  }

  // PR detection for assigned-session drills via the canonical PR layer.
  // After grouping, each drill's bestMark is the max distance for that
  // drill type + implement combo. Compare it against the canonical PR for
  // the event — but only if the implement is at competition weight.
  if (input.prContext) {
    for (const group of blockGroups.values()) {
      const pr = input.prContext[group.drill.event];
      if (
        pr &&
        group.drill.bestMark != null &&
        Math.abs(group.drill.implementKg - pr.weightKg) < WEIGHT_TOLERANCE &&
        group.drill.bestMark >= pr.distance
      ) {
        group.drill.isPersonalBest = true;
      }
    }
  }

  for (const { drill, date, assignmentId } of blockGroups.values()) {
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
      selfLoggedSessionId: null,
    };
    bucket.drills.push(drill);
    bucket.events.add(drill.event);
    bucket.assignmentId = bucket.assignmentId ?? assignmentId;
    buckets.set(date, bucket);
  }

  // Bucket self-logged AthleteThrowsSession drills by date
  for (const session of input.selfLoggedSessions ?? []) {
    const bucket = buckets.get(session.date) ?? {
      date: session.date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
      selfLoggedSessionId: null,
    };
    bucket.selfLoggedSessionId = bucket.selfLoggedSessionId ?? session.id;
    bucket.events.add(session.event as EventType);

    for (const dl of session.drillLogs) {
      const implKg = dl.implementWeight ?? 0;
      const pr = input.prContext?.[session.event];
      const isPR =
        dl.bestMark != null &&
        pr != null &&
        Math.abs(implKg - pr.weightKg) < WEIGHT_TOLERANCE &&
        dl.bestMark >= pr.distance;
      bucket.drills.push({
        source: "free",
        event: session.event as EventType,
        implementKg: implKg,
        implementLabel:
          implKg > 0
            ? formatImplementDisplay(implKg, session.event, input.gender, { compact: true })
            : "BW",
        drillType: dl.drillType,
        drillTypeLabel: dl.drillType
          .toLowerCase()
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        throwCount: dl.throwCount,
        bestMark: dl.bestMark,
        isPersonalBest: isPR,
        bestThrowLogId: null,
        throws: [],
      });
    }
    buckets.set(session.date, bucket);
  }

  const days: HistoryDay[] = Array.from(buckets.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((bucket) => {
      const totalThrows = bucket.drills.reduce((sum, d) => sum + d.throwCount, 0);
      const bestMarkOverall = bucket.drills.reduce<number | null>((best, d) => {
        if (d.bestMark == null) return best;
        if (best == null) return d.bestMark;
        return d.bestMark > best ? d.bestMark : best;
      }, null);
      const hasPR = bucket.drills.some((d) => d.isPersonalBest);
      const labels = labelsFor(bucket.date);
      return {
        date: bucket.date,
        weekdayShort: labels.weekdayShort,
        dateLabel: labels.dateLabel,
        events: Array.from(bucket.events),
        totalThrows,
        bestMarkOverall,
        hasPR,
        drills: bucket.drills,
        assignmentId: bucket.assignmentId,
        selfLoggedSessionId: bucket.selfLoggedSessionId,
      };
    });

  return days;
}
