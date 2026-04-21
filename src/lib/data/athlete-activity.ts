import prisma from "@/lib/prisma";
import type { EventType } from "@prisma/client";

export type ActivitySource = "assigned-throws" | "assigned-training" | "self-logged" | "program";
export type ActivityStatus = "planned" | "active" | "completed" | "partial" | "skipped";
export type ActivityKind = "throws" | "strength" | "mixed";

export type ActivityMetrics = {
  throwCount?: number;
  bestMarkM?: number;
  totalVolumeKg?: number;
  rpe?: number;
  selfFeeling?: string;
};

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  kind: ActivityKind;
  event: EventType | null;
  status: ActivityStatus;
  scheduledAt: Date | null;
  completedAt: Date | null;
  assignedBy: "coach" | "self";
  metrics: ActivityMetrics;
  title: string;
  href: string;
  coachFeedback: { summary: string; hasUnread: boolean } | null;
}

// ── Status mapping ─────────────────────────────────────────────────────────
// One canonical 5-state view over three divergent source enums. See
// tasks/unified-session-layer.md §DD-5.

const STATUS_MAP: Record<Exclude<ActivitySource, "self-logged">, Record<string, ActivityStatus>> = {
  "assigned-training": {
    SCHEDULED: "planned",
    IN_PROGRESS: "active",
    COMPLETED: "completed",
    SKIPPED: "skipped",
  },
  "assigned-throws": {
    ASSIGNED: "planned",
    NOTIFIED: "planned",
    IN_PROGRESS: "active",
    COMPLETED: "completed",
    PARTIAL: "partial",
    SKIPPED: "skipped",
  },
  program: {
    PLANNED: "planned",
    SCHEDULED: "planned",
    IN_PROGRESS: "active",
    COMPLETED: "completed",
    SKIPPED: "skipped",
  },
};

function mapStatus(source: Exclude<ActivitySource, "self-logged">, raw: string): ActivityStatus {
  return STATUS_MAP[source][raw] ?? "planned";
}

// Noon UTC avoids tz-edge flips when YMD strings round-trip across client tzs.
function ymdToDate(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  return new Date(`${ymd}T12:00:00.000Z`);
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Self-program linkage: ThrowsSession.tags is a JSON array of strings; when an
// athlete starts a self-program session we tag the executed ThrowsSession with
// "selfProgram:{programSessionId}" so the blueprint can be filtered out.
function extractSelfProgramSessionId(tagsJson: string | null | undefined): string | null {
  if (!tagsJson) return null;
  try {
    const tags = JSON.parse(tagsJson) as unknown;
    if (!Array.isArray(tags)) return null;
    const tag = tags.find(
      (t): t is string => typeof t === "string" && t.startsWith("selfProgram:")
    );
    return tag ? tag.replace("selfProgram:", "") : null;
  } catch {
    return null;
  }
}

function asEventType(s: string | null | undefined): EventType | null {
  if (!s) return null;
  if (s === "SHOT_PUT" || s === "DISCUS" || s === "HAMMER" || s === "JAVELIN") return s;
  return null;
}

// ── Row shapes (what the loader queries & what normalizers accept) ─────────

export type ThrowsAssignmentRow = {
  id: string;
  athleteId: string;
  assignedDate: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  rpe: number | null;
  selfFeeling: string | null;
  feedbackNotes: string | null;
  session: { event: EventType; name: string; tags: string | null };
  throwLogs: { distance: number | null }[];
};

export type TrainingSessionRow = {
  id: string;
  athleteId: string;
  scheduledDate: Date;
  completedDate: Date | null;
  status: string;
  rpe: number | null;
  coachNotes: string | null;
  plan: { name: string } | null;
  logs: {
    id: string;
    distance: number | null;
    weight: number | null;
    sets: number;
    reps: number | null;
  }[];
  throwLogs: { id: string; event: EventType; distance: number | null }[];
};

export type SelfLoggedRow = {
  id: string;
  athleteId: string;
  event: string;
  date: string;
  focus: string | null;
  sessionRpe: number | null;
  sessionFeeling: string | null;
  createdAt: Date;
  drillLogs: {
    id: string;
    throwCount: number;
    bestMark: number | null;
    implementWeight: number | null;
  }[];
};

export type ProgramSessionRow = {
  id: string;
  status: string;
  scheduledDate: string | null;
  weekNumber: number;
  dayOfWeek: number;
  focusLabel: string;
  sessionType: string;
  completedAt: Date | null;
  rpe: number | null;
  selfFeeling: string | null;
  bestMark: number | null;
  actualThrows: number | null;
  program: {
    event: EventType;
    startDate: string | null;
    selfProgramConfig: { id: string } | null;
  };
};

// ── Normalizers — pure, one per source shape ───────────────────────────────

export function normalizeThrowsAssignment(row: ThrowsAssignmentRow): ActivityItem {
  const status = mapStatus("assigned-throws", row.status);
  const distances = row.throwLogs
    .map((t) => t.distance)
    .filter((d): d is number => d != null && d > 0);

  const hrefByStatus: Record<ActivityStatus, string> = {
    planned: `/athlete/sessions/assignment/${row.id}`,
    active: `/athlete/throws/live/${row.id}`,
    completed: `/athlete/throws/session/${row.id}`,
    partial: `/athlete/throws/session/${row.id}`,
    skipped: `/athlete/throws/session/${row.id}`,
  };

  return {
    id: row.id,
    source: "assigned-throws",
    kind: "throws",
    event: row.session.event,
    status,
    scheduledAt: ymdToDate(row.assignedDate),
    completedAt: row.completedAt,
    assignedBy: "coach",
    metrics: {
      throwCount: row.throwLogs.length > 0 ? row.throwLogs.length : undefined,
      bestMarkM: distances.length > 0 ? Math.max(...distances) : undefined,
      rpe: row.rpe ?? undefined,
      selfFeeling: row.selfFeeling ?? undefined,
    },
    title: row.session.name,
    href: hrefByStatus[status],
    coachFeedback: row.feedbackNotes ? { summary: row.feedbackNotes, hasUnread: false } : null,
  };
}

export function normalizeTrainingSession(row: TrainingSessionRow): ActivityItem {
  const status = mapStatus("assigned-training", row.status);
  const hasThrows = row.throwLogs.length > 0;
  const hasLifts = row.logs.some((l) => l.weight != null || l.reps != null);
  const kind: ActivityKind = hasThrows && hasLifts ? "mixed" : hasThrows ? "throws" : "strength";

  const distances = row.throwLogs
    .map((t) => t.distance)
    .filter((d): d is number => d != null && d > 0);

  const totalVolumeKg = row.logs.reduce((sum, l) => {
    if (l.weight == null || l.reps == null) return sum;
    return sum + l.weight * l.sets * l.reps;
  }, 0);

  const event = hasThrows ? row.throwLogs[0].event : null;

  return {
    id: row.id,
    source: "assigned-training",
    kind,
    event,
    status,
    scheduledAt: row.scheduledDate,
    completedAt: row.completedDate,
    assignedBy: "coach",
    metrics: {
      throwCount: hasThrows ? row.throwLogs.length : undefined,
      bestMarkM: distances.length > 0 ? Math.max(...distances) : undefined,
      totalVolumeKg: totalVolumeKg > 0 ? totalVolumeKg : undefined,
      rpe: row.rpe ?? undefined,
    },
    title: row.plan?.name ?? "Training Session",
    href: `/athlete/sessions/${row.id}`,
    coachFeedback: row.coachNotes ? { summary: row.coachNotes, hasUnread: false } : null,
  };
}

export function normalizeSelfLogged(row: SelfLoggedRow): ActivityItem {
  // AthleteThrowsSession has no status field. Match dashboard.ts's rule:
  // sessionRpe present → completed, else active.
  const status: ActivityStatus = row.sessionRpe != null ? "completed" : "active";
  const throwCount = row.drillLogs.reduce((sum, d) => sum + d.throwCount, 0);
  const bestMarks = row.drillLogs
    .map((d) => d.bestMark)
    .filter((m): m is number => m != null && m > 0);

  return {
    id: row.id,
    source: "self-logged",
    kind: "throws",
    event: asEventType(row.event),
    status,
    scheduledAt: ymdToDate(row.date),
    completedAt: status === "completed" ? row.createdAt : null,
    assignedBy: "self",
    metrics: {
      throwCount: throwCount > 0 ? throwCount : undefined,
      bestMarkM: bestMarks.length > 0 ? Math.max(...bestMarks) : undefined,
      rpe: row.sessionRpe ?? undefined,
      selfFeeling: row.sessionFeeling ?? undefined,
    },
    title: `${row.event} — ${row.focus ?? "Practice"}`,
    href: `/athlete/log-session`,
    coachFeedback: null,
  };
}

export function normalizeProgramSession(row: ProgramSessionRow): ActivityItem {
  const status = mapStatus("program", row.status);

  // scheduledDate may be null on older rows; recompute from program.startDate
  // + weekNumber + dayOfWeek (the same fallback dashboard.ts uses).
  let scheduledAt: Date | null = null;
  if (row.scheduledDate) {
    scheduledAt = ymdToDate(row.scheduledDate);
  } else if (row.program.startDate) {
    const start = ymdToDate(row.program.startDate);
    if (start) {
      start.setUTCDate(start.getUTCDate() + (row.weekNumber - 1) * 7 + (row.dayOfWeek - 1));
      scheduledAt = start;
    }
  }

  const kind: ActivityKind =
    row.sessionType === "LIFT_ONLY"
      ? "strength"
      : row.sessionType === "THROWS_LIFT"
        ? "mixed"
        : "throws";

  const configId = row.program.selfProgramConfig?.id;
  const href = configId
    ? `/athlete/self-program/${configId}/session/${row.id}`
    : `/athlete/sessions/${row.id}`;

  return {
    id: row.id,
    source: "program",
    kind,
    event: row.program.event,
    status,
    scheduledAt,
    completedAt: row.completedAt,
    assignedBy: "self",
    metrics: {
      throwCount: row.actualThrows ?? undefined,
      bestMarkM: row.bestMark ?? undefined,
      rpe: row.rpe ?? undefined,
      selfFeeling: row.selfFeeling ?? undefined,
    },
    title: row.focusLabel,
    href,
    coachFeedback: null,
  };
}

// ── Loader — the only place prisma lives for session reads ─────────────────

export interface LoadOptions {
  /** Inclusive. YYYY-MM-DD. */
  dateFromYMD?: string;
  /** Inclusive. YYYY-MM-DD. */
  dateToYMD?: string;
  statuses?: ActivityStatus[];
  kinds?: ActivityKind[];
  limit?: number;
}

export async function loadSourceRows(
  athleteId: string,
  options: LoadOptions = {}
): Promise<ActivityItem[]> {
  const { dateFromYMD, dateToYMD } = options;

  // Build filters per source. Each source uses different field names/types for
  // dates; that divergence is intentional (DB stays as-is per the plan's
  // non-goals) and the loader is the single place that papers over it.
  const assignmentDateFilter =
    dateFromYMD || dateToYMD
      ? {
          assignedDate: {
            ...(dateFromYMD && { gte: dateFromYMD }),
            ...(dateToYMD && { lte: dateToYMD }),
          },
        }
      : {};

  const trainingDateFilter =
    dateFromYMD || dateToYMD
      ? {
          scheduledDate: {
            ...(dateFromYMD && { gte: new Date(`${dateFromYMD}T00:00:00.000Z`) }),
            ...(dateToYMD && { lte: new Date(`${dateToYMD}T23:59:59.999Z`) }),
          },
        }
      : {};

  const selfDateFilter =
    dateFromYMD || dateToYMD
      ? {
          date: {
            ...(dateFromYMD && { gte: dateFromYMD }),
            ...(dateToYMD && { lte: dateToYMD }),
          },
        }
      : {};

  const [assignments, trainingSessions, selfSessions, programSessions] = await Promise.all([
    prisma.throwsAssignment.findMany({
      where: { athleteId, ...assignmentDateFilter },
      select: {
        id: true,
        athleteId: true,
        assignedDate: true,
        status: true,
        startedAt: true,
        completedAt: true,
        rpe: true,
        selfFeeling: true,
        feedbackNotes: true,
        session: { select: { event: true, name: true, tags: true } },
        throwLogs: { select: { distance: true } },
      },
      orderBy: { assignedDate: "desc" },
    }),

    prisma.trainingSession.findMany({
      where: { athleteId, ...trainingDateFilter },
      select: {
        id: true,
        athleteId: true,
        scheduledDate: true,
        completedDate: true,
        status: true,
        rpe: true,
        coachNotes: true,
        plan: { select: { name: true } },
        logs: {
          select: {
            id: true,
            distance: true,
            weight: true,
            sets: true,
            reps: true,
          },
        },
        throwLogs: { select: { id: true, event: true, distance: true } },
      },
      orderBy: { scheduledDate: "desc" },
    }),

    prisma.athleteThrowsSession.findMany({
      where: { athleteId, ...selfDateFilter },
      select: {
        id: true,
        athleteId: true,
        event: true,
        date: true,
        focus: true,
        sessionRpe: true,
        sessionFeeling: true,
        createdAt: true,
        drillLogs: {
          select: {
            id: true,
            throwCount: true,
            bestMark: true,
            implementWeight: true,
          },
        },
      },
      orderBy: { date: "desc" },
    }),

    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        status: { not: "SKIPPED" },
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        weekNumber: true,
        dayOfWeek: true,
        focusLabel: true,
        sessionType: true,
        completedAt: true,
        rpe: true,
        selfFeeling: true,
        bestMark: true,
        actualThrows: true,
        program: {
          select: {
            event: true,
            startDate: true,
            selfProgramConfig: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  const items: ActivityItem[] = [];
  const shadowedProgramIds = new Set<string>();

  for (const row of assignments) {
    const spid = extractSelfProgramSessionId(row.session.tags);
    if (spid) shadowedProgramIds.add(spid);
    items.push(normalizeThrowsAssignment(row));
  }

  for (const row of trainingSessions) {
    items.push(normalizeTrainingSession(row));
  }

  for (const row of selfSessions) {
    items.push(normalizeSelfLogged(row));
  }

  for (const row of programSessions) {
    if (shadowedProgramIds.has(row.id)) continue;
    const normalized = normalizeProgramSession(row);
    // A program session with a null scheduledAt AND no startDate fallback
    // can't appear on any surface that sorts by date — skip it rather than
    // emit an orphan with scheduledAt: null.
    if (!normalized.scheduledAt) continue;
    // Apply the same post-dedupe date filter the query couldn't enforce
    // (because scheduledDate is computed from program.startDate for many rows).
    if (dateFromYMD && dateToYMD) {
      const ymd = toYMD(normalized.scheduledAt);
      if (ymd < dateFromYMD || ymd > dateToYMD) continue;
    }
    items.push(normalized);
  }

  let filtered = items;
  if (options.statuses) {
    const allowed = new Set(options.statuses);
    filtered = filtered.filter((it) => allowed.has(it.status));
  }
  if (options.kinds) {
    const allowed = new Set(options.kinds);
    filtered = filtered.filter((it) => allowed.has(it.kind));
  }

  filtered.sort((a, b) => {
    const aTime = a.scheduledAt?.getTime() ?? 0;
    const bTime = b.scheduledAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

// ── Focused fetchers ───────────────────────────────────────────────────────

export async function getTodayActivity(
  athleteId: string,
  todayYMD: string
): Promise<ActivityItem[]> {
  return loadSourceRows(athleteId, {
    dateFromYMD: todayYMD,
    dateToYMD: todayYMD,
  });
}

export async function getUpcomingActivity(
  athleteId: string,
  fromYMD: string,
  limit = 5
): Promise<ActivityItem[]> {
  const items = await loadSourceRows(athleteId, {
    dateFromYMD: fromYMD,
    statuses: ["planned", "active"],
  });
  // Upcoming sorts ascending (nearest first)
  items.sort((a, b) => {
    const aTime = a.scheduledAt?.getTime() ?? Infinity;
    const bTime = b.scheduledAt?.getTime() ?? Infinity;
    return aTime - bTime;
  });
  return items.slice(0, limit);
}

export async function getWeekActivity(
  athleteId: string,
  weekStartYMD: string,
  weekEndYMD: string
): Promise<ActivityItem[]> {
  return loadSourceRows(athleteId, {
    dateFromYMD: weekStartYMD,
    dateToYMD: weekEndYMD,
  });
}

export async function getActivityHistory(
  athleteId: string,
  options: { cursor?: string; limit?: number; kinds?: ActivityKind[] } = {}
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  const { cursor, limit = 30, kinds } = options;

  const items = await loadSourceRows(athleteId, {
    dateToYMD: cursor,
    statuses: ["completed", "partial"],
    kinds,
  });

  const page = items.slice(0, limit);
  const nextCursor =
    items.length > limit && page[page.length - 1]?.scheduledAt
      ? toYMD(page[page.length - 1].scheduledAt!)
      : null;

  return { items: page, nextCursor };
}

export async function getActivityById(
  athleteId: string,
  source: ActivitySource,
  id: string
): Promise<ActivityItem | null> {
  switch (source) {
    case "assigned-throws": {
      const row = await prisma.throwsAssignment.findFirst({
        where: { id, athleteId },
        select: {
          id: true,
          athleteId: true,
          assignedDate: true,
          status: true,
          startedAt: true,
          completedAt: true,
          rpe: true,
          selfFeeling: true,
          feedbackNotes: true,
          session: { select: { event: true, name: true, tags: true } },
          throwLogs: { select: { distance: true } },
        },
      });
      return row ? normalizeThrowsAssignment(row) : null;
    }
    case "assigned-training": {
      const row = await prisma.trainingSession.findFirst({
        where: { id, athleteId },
        select: {
          id: true,
          athleteId: true,
          scheduledDate: true,
          completedDate: true,
          status: true,
          rpe: true,
          coachNotes: true,
          plan: { select: { name: true } },
          logs: {
            select: {
              id: true,
              distance: true,
              weight: true,
              sets: true,
              reps: true,
            },
          },
          throwLogs: { select: { id: true, event: true, distance: true } },
        },
      });
      return row ? normalizeTrainingSession(row) : null;
    }
    case "self-logged": {
      const row = await prisma.athleteThrowsSession.findFirst({
        where: { id, athleteId },
        select: {
          id: true,
          athleteId: true,
          event: true,
          date: true,
          focus: true,
          sessionRpe: true,
          sessionFeeling: true,
          createdAt: true,
          drillLogs: {
            select: {
              id: true,
              throwCount: true,
              bestMark: true,
              implementWeight: true,
            },
          },
        },
      });
      return row ? normalizeSelfLogged(row) : null;
    }
    case "program": {
      const row = await prisma.programSession.findFirst({
        where: { id, program: { athleteId } },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          weekNumber: true,
          dayOfWeek: true,
          focusLabel: true,
          sessionType: true,
          completedAt: true,
          rpe: true,
          selfFeeling: true,
          bestMark: true,
          actualThrows: true,
          program: {
            select: {
              event: true,
              startDate: true,
              selfProgramConfig: { select: { id: true } },
            },
          },
        },
      });
      return row ? normalizeProgramSession(row) : null;
    }
  }
}
