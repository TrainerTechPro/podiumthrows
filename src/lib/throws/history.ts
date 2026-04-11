import type { EventType } from "@prisma/client";
import type { HistoryDay, HistoryDrill } from "./history-types";

// Narrow shapes — only the fields we read. Keeps tests lightweight.
export type ThrowLogInput = {
  id: string;
  athleteId: string;
  event: EventType;
  implementWeight: number;
  distance: number | null;
  date: Date;
  isPersonalBest: boolean;
  isCompetition: boolean;
  sessionId: string | null;
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

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function isoDay(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10); // ISO date already
  return d.toISOString().slice(0, 10);
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
  return Number.isFinite(n) ? n : 0;
}

function parseDrillTypeFromBlockConfig(configJson: string): { drillType: string | null; label: string | null } {
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

type DayBucket = {
  date: string;
  drills: HistoryDrill[];
  events: Set<EventType>;
  assignmentId: string | null;
};

export function aggregateHistoryDays(input: {
  throwLogs: ThrowLogInput[];
  blockLogs: BlockLogInput[];
}): HistoryDay[] {
  const buckets = new Map<string, DayBucket>();

  // Bucket free logs by their own date
  // Group same-event/same-implement throws into one "drill row" for display density.
  type FreeKey = string; // `${event}|${implementKg}|${date}`
  const freeGroups = new Map<FreeKey, HistoryDrill>();

  for (const log of input.throwLogs) {
    const date = isoDay(log.date);
    const key = `${log.event}|${log.implementWeight}|${date}`;
    const existing = freeGroups.get(key);
    if (existing) {
      existing.throwCount += 1;
      if (log.distance != null && (existing.bestMark == null || log.distance > existing.bestMark)) {
        existing.bestMark = log.distance;
      }
      if (log.isPersonalBest) existing.isPersonalBest = true;
    } else {
      freeGroups.set(key, {
        source: "free",
        event: log.event,
        implementKg: log.implementWeight,
        implementLabel: `${log.implementWeight}kg`,
        drillType: null,
        drillTypeLabel: null,
        throwCount: 1,
        bestMark: log.distance ?? null,
        isPersonalBest: log.isPersonalBest,
      });
    }
  }

  for (const [key, drill] of freeGroups.entries()) {
    const date = key.split("|")[2];
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
    };
    bucket.drills.push(drill);
    bucket.events.add(drill.event);
    buckets.set(date, bucket);
  }

  // Bucket block logs by assignment.assignedDate
  // Group by (assignmentId, blockId) → one drill row per block.
  type BlockKey = string; // `${assignmentId}|${drillType}|${implement}`
  const blockGroups = new Map<BlockKey, { drill: HistoryDrill; date: string; assignmentId: string }>();

  for (const bl of input.blockLogs) {
    const date = bl.assignment.assignedDate;
    const event = bl.assignment.session.event;
    const drillInfo = parseDrillTypeFromBlockConfig(bl.block.config);
    const implementKg = parseImplementKg(bl.implement);
    const key = `${bl.assignment.id}|${drillInfo.drillType ?? "unknown"}|${bl.implement}`;

    const existing = blockGroups.get(key);
    if (existing) {
      existing.drill.throwCount += 1;
      if (bl.distance != null && (existing.drill.bestMark == null || bl.distance > existing.drill.bestMark)) {
        existing.drill.bestMark = bl.distance;
      }
    } else {
      blockGroups.set(key, {
        drill: {
          source: "assigned",
          event,
          implementKg,
          implementLabel: bl.implement,
          drillType: drillInfo.drillType,
          drillTypeLabel: drillInfo.label,
          throwCount: 1,
          bestMark: bl.distance ?? null,
          // TODO: assigned-side PR detection comes from Unified PR layer at render time
          isPersonalBest: false,
        },
        date,
        assignmentId: bl.assignment.id,
      });
    }
  }

  for (const { drill, date, assignmentId } of blockGroups.values()) {
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
    };
    bucket.drills.push(drill);
    bucket.events.add(drill.event);
    bucket.assignmentId = bucket.assignmentId ?? assignmentId;
    buckets.set(date, bucket);
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
      };
    });

  return days;
}
