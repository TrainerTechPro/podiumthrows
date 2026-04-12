/**
 * Server-side data-fetching functions for the athlete dashboard widgets.
 * All functions return plain serializable objects (dates as ISO strings).
 */

import prisma from "@/lib/prisma";
import { getAthleteTimezone, getLocalDate, startOfToday as startOfTodayTz } from "@/lib/dates";
import { getAthletePRs } from "@/lib/data/personal-records";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TYPES                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type TimelineItem = {
  id: string;
  name: string;
  type: "throw" | "lift" | "warmup" | "note" | "cooldown";
  /** e.g. "24 throws" or "4 x 6" or "5 min dynamic stretching" */
  detail: string;
  supersetGroup?: string;
  position: number;
};

export type TodaySession = {
  id: string;
  source: "program" | "assignment" | "self-logged" | "legacy";
  name: string;
  sessionType: "throws" | "lift" | "mixed";
  status: string;
  scheduledTime?: string;
  items: TimelineItem[];
  totalItemCount: number;
  href: string;
};

export type ReadinessData = {
  checkedIn: boolean;
  score?: number;
  label?: string;
  sleepQuality?: number;
  soreness?: number;
  stressLevel?: number;
  energyMood?: number;
  hydration?: string;
};

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  hasCompleted: boolean;
  hasScheduled: boolean;
};

export type PRItem = {
  id: string;
  event: string;
  distance: number;
  date: string; // ISO
};

export type QuickStatsData = {
  sessionsThisWeek: number;
  currentStreak: number;
  totalSessions: number;
};

export type GoalItem = {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
};

export type UpcomingSessionItem = {
  id: string;
  scheduledDate: string; // ISO
  status: string;
  planName: string | null;
  coachNotes: string | null;
};

export type VideoItem = {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  createdAt: string; // ISO
};

export type QuestionnairesData = {
  pendingCount: number;
  items: { id: string; title: string }[];
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HELPERS                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function todayYMD(tz: string): string {
  return getLocalDate(tz);
}

function startOfTodayInTz(tz: string): Date {
  return startOfTodayTz(tz);
}

function endOfTodayInTz(tz: string): Date {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return startOfTodayTz(tz, tomorrow);
}

function readinessLabel(score: number): string {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Moderate";
  if (score >= 2) return "Low";
  return "Very Low";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  1. READINESS                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchReadinessData(athleteId: string): Promise<ReadinessData> {
  const tz = await getAthleteTimezone(athleteId);
  const start = startOfTodayInTz(tz);
  const end = endOfTodayInTz(tz);

  const checkIn = await prisma.readinessCheckIn.findFirst({
    where: { athleteId, date: { gte: start, lt: end } },
    select: {
      overallScore: true,
      sleepQuality: true,
      soreness: true,
      stressLevel: true,
      energyMood: true,
      hydration: true,
    },
  });

  if (!checkIn) {
    return { checkedIn: false };
  }

  return {
    checkedIn: true,
    score: checkIn.overallScore,
    label: readinessLabel(checkIn.overallScore),
    sleepQuality: checkIn.sleepQuality,
    soreness: checkIn.soreness,
    stressLevel: checkIn.stressLevel,
    energyMood: checkIn.energyMood,
    hydration: checkIn.hydration as string,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  2. TODAY'S WORKOUT                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const MAX_PREVIEW_ITEMS = 4;

/** Parse ProgramSession JSON prescriptions into TimelineItems. */
function parseProgramSessionItems(ps: {
  throwsPrescription: string;
  strengthPrescription: string | null;
  warmupPrescription: string | null;
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  let pos = 0;

  // Warmup
  if (ps.warmupPrescription) {
    try {
      const warmups = JSON.parse(ps.warmupPrescription) as Array<{
        name?: string;
        duration?: string | number;
        notes?: string;
      }>;
      for (const w of warmups) {
        items.push({
          id: `warmup-${pos}`,
          name: w.name ?? "Warmup",
          type: "warmup",
          detail: w.duration ? `${w.duration} min` : (w.notes ?? ""),
          position: pos++,
        });
      }
    } catch { /* ignore parse errors */ }
  }

  // Throws
  try {
    const throws = JSON.parse(ps.throwsPrescription) as Array<{
      implement?: string;
      category?: string;
      drillType?: string;
      sets?: number;
      repsPerSet?: number;
      notes?: string;
    }>;
    for (const t of throws) {
      const totalThrows =
        t.sets && t.repsPerSet ? t.sets * t.repsPerSet : undefined;
      items.push({
        id: `throw-${pos}`,
        name: t.drillType
          ? `${t.drillType}${t.implement ? ` (${t.implement})` : ""}`
          : t.implement ?? "Throws",
        type: "throw",
        detail: totalThrows ? `${totalThrows} throws` : (t.notes ?? ""),
        position: pos++,
      });
    }
  } catch { /* ignore parse errors */ }

  // Strength
  if (ps.strengthPrescription) {
    try {
      const lifts = JSON.parse(ps.strengthPrescription) as Array<{
        exerciseName?: string;
        sets?: number;
        reps?: number;
        notes?: string;
      }>;
      for (const l of lifts) {
        items.push({
          id: `lift-${pos}`,
          name: l.exerciseName ?? "Lift",
          type: "lift",
          detail:
            l.sets && l.reps
              ? `${l.sets} x ${l.reps}`
              : (l.notes ?? ""),
          position: pos++,
        });
      }
    } catch { /* ignore parse errors */ }
  }

  return items;
}

/** Determine session type label from content. */
function inferSessionType(items: TimelineItem[]): "throws" | "lift" | "mixed" {
  const hasThrows = items.some((i) => i.type === "throw");
  const hasLifts = items.some((i) => i.type === "lift");
  if (hasThrows && hasLifts) return "mixed";
  if (hasLifts) return "lift";
  return "throws";
}

export async function fetchTodayWorkoutData(
  athleteId: string
): Promise<TodaySession[]> {
  const tz = await getAthleteTimezone(athleteId);
  const today = todayYMD(tz);
  const dayStart = startOfTodayInTz(tz);
  const dayEnd = endOfTodayInTz(tz);

  const sessions: TodaySession[] = [];

  // ── Source 1: ProgramSession ────────────────────────────────────────────
  // scheduledDate is nullable — many sessions derive their date from
  // program.startDate + weekNumber + dayOfWeek. We must fetch all
  // non-skipped sessions for this athlete and compute the actual date.
  const allProgramSessions = await prisma.programSession.findMany({
    where: {
      program: { athleteId },
      status: { not: "SKIPPED" },
    },
    include: {
      program: {
        select: {
          event: true,
          startDate: true,
          selfProgramConfig: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter to today: either scheduledDate matches, or computed date matches
  const programSessions = allProgramSessions.filter((ps) => {
    if (ps.scheduledDate === today) return true;
    if (!ps.scheduledDate && ps.program.startDate) {
      const start = new Date(ps.program.startDate);
      start.setDate(start.getDate() + (ps.weekNumber - 1) * 7 + (ps.dayOfWeek - 1));
      const computed = start.getFullYear() + "-" +
        String(start.getMonth() + 1).padStart(2, "0") + "-" +
        String(start.getDate()).padStart(2, "0");
      return computed === today;
    }
    return false;
  });

  for (const ps of programSessions) {
    const allItems = parseProgramSessionItems({
      throwsPrescription: ps.throwsPrescription,
      strengthPrescription: ps.strengthPrescription ?? null,
      warmupPrescription: ps.warmupPrescription ?? null,
    });
    const selfConfigId = ps.program.selfProgramConfig?.id;
    const href = selfConfigId
      ? `/athlete/self-program/${selfConfigId}/session/${ps.id}`
      : `/athlete/sessions/${ps.id}`;

    sessions.push({
      id: ps.id,
      source: "program",
      name: ps.focusLabel || `${ps.program.event} Session`,
      sessionType: inferSessionType(allItems),
      status: ps.status,
      items: allItems.slice(0, MAX_PREVIEW_ITEMS),
      totalItemCount: allItems.length,
      href,
    });
  }

  // ── Source 2: ThrowsAssignment ──────────────────────────────────────────
  const throwsAssignments = await prisma.throwsAssignment.findMany({
    where: { athleteId, assignedDate: today, status: { notIn: ["SKIPPED"] } },
    include: {
      session: {
        select: {
          name: true,
          sessionType: true,
          blocks: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              blockType: true,
              config: true,
              position: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const ta of throwsAssignments) {
    const items: TimelineItem[] = [];
    let pos = 0;

    for (const block of ta.session.blocks) {
      const blockTypeLower = block.blockType.toLowerCase();
      let type: TimelineItem["type"] = "throw";
      if (blockTypeLower === "warmup") type = "warmup";
      else if (blockTypeLower === "cooldown") type = "cooldown";
      else if (blockTypeLower === "strength") type = "lift";
      else if (blockTypeLower === "notes") type = "note";

      let detail = "";
      try {
        const cfg = JSON.parse(block.config) as Record<string, unknown>;
        if (type === "throw") {
          const implement = (cfg.implement as string) ?? "";
          const throwCount =
            typeof cfg.sets === "number" && typeof cfg.repsPerSet === "number"
              ? cfg.sets * cfg.repsPerSet
              : (cfg.throwCount as number | undefined);
          detail = throwCount
            ? `${throwCount} throws${implement ? ` (${implement})` : ""}`
            : implement;
        } else if (type === "lift") {
          const name = (cfg.exerciseName as string) ?? "";
          const s = cfg.sets as number | undefined;
          const r = cfg.reps as number | undefined;
          detail = s && r ? `${name} ${s} x ${r}` : name;
        } else {
          detail = (cfg.name as string) ?? (cfg.notes as string) ?? "";
        }
      } catch { /* config parse error */ }

      items.push({
        id: block.id,
        name: block.blockType,
        type,
        detail,
        position: pos++,
      });
    }

    sessions.push({
      id: ta.id,
      source: "assignment",
      name: ta.session.name,
      sessionType: inferSessionType(items),
      status: ta.status,
      items: items.slice(0, MAX_PREVIEW_ITEMS),
      totalItemCount: items.length,
      href: `/athlete/sessions/assignment/${ta.id}`,
    });
  }

  // ── Source 3: AthleteThrowsSession (self-logged) ────────────────────────
  const selfSessions = await prisma.athleteThrowsSession.findMany({
    where: { athleteId, date: today },
    include: {
      drillLogs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          drillType: true,
          implementWeight: true,
          throwCount: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const ss of selfSessions) {
    const items: TimelineItem[] = ss.drillLogs.map((dl, idx) => ({
      id: dl.id,
      name: dl.drillType ?? "Throws",
      type: "throw" as const,
      detail: dl.throwCount
        ? `${dl.throwCount} throws${dl.implementWeight ? ` (${dl.implementWeight}kg)` : ""}`
        : dl.implementWeight
          ? `${dl.implementWeight}kg`
          : "",
      position: idx,
    }));

    sessions.push({
      id: ss.id,
      source: "self-logged",
      name: `${ss.event} — ${ss.focus ?? "Practice"}`,
      sessionType: "throws",
      status: ss.sessionRpe ? "COMPLETED" : "IN_PROGRESS",
      items: items.slice(0, MAX_PREVIEW_ITEMS),
      totalItemCount: items.length,
      href: `/athlete/log-session`,
    });
  }

  // ── Source 4: TrainingSession (legacy) ──────────────────────────────────
  const legacySessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      scheduledDate: { gte: dayStart, lt: dayEnd },
    },
    include: {
      plan: { select: { name: true } },
      logs: {
        orderBy: { completedAt: "asc" },
        take: MAX_PREVIEW_ITEMS,
        select: {
          id: true,
          exerciseName: true,
          sets: true,
          reps: true,
          distance: true,
        },
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  for (const ls of legacySessions) {
    const items: TimelineItem[] = ls.logs.map((log, idx) => {
      const isThrow = log.distance !== null && log.distance > 0;
      return {
        id: log.id,
        name: log.exerciseName,
        type: isThrow ? ("throw" as const) : ("lift" as const),
        detail: isThrow
          ? `${log.sets} throws`
          : `${log.sets} x ${log.reps ?? "?"}`,
        position: idx,
      };
    });

    sessions.push({
      id: ls.id,
      source: "legacy",
      name: ls.plan?.name ?? "Training Session",
      sessionType: inferSessionType(items),
      status: ls.status as string,
      items,
      totalItemCount: items.length,
      href: `/athlete/sessions/${ls.id}`,
    });
  }

  return sessions;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  3. CALENDAR                                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchCalendarData(athleteId: string): Promise<CalendarDay[]> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // YYYY-MM-DD range for string-based dates
  const firstYMD = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}-01`;
  const lastYMD = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const [allProgramSessions, trainingSessions, throwsAssignments, selfSessions, standaloneThrows] = await Promise.all([
    // ProgramSession — scheduledDate is nullable String; must also compute from startDate
    prisma.programSession.findMany({
      where: { program: { athleteId } },
      select: {
        scheduledDate: true,
        status: true,
        weekNumber: true,
        dayOfWeek: true,
        program: { select: { startDate: true } },
      },
    }),

    // TrainingSession — scheduledDate is DateTime
    prisma.trainingSession.findMany({
      where: {
        athleteId,
        scheduledDate: { gte: firstDay, lte: lastDay },
      },
      select: { scheduledDate: true, status: true },
    }),

    // ThrowsAssignment — assignedDate is String (YYYY-MM-DD)
    prisma.throwsAssignment.findMany({
      where: {
        athleteId,
        assignedDate: { gte: firstYMD, lte: lastYMD },
      },
      select: { assignedDate: true, status: true },
    }),

    // AthleteThrowsSession (self-logged) — date is String (YYYY-MM-DD)
    prisma.athleteThrowsSession.findMany({
      where: {
        athleteId,
        date: { gte: firstYMD, lte: lastYMD },
      },
      select: { date: true, sessionRpe: true },
    }),

    // Standalone ThrowLog entries (Quick Log + coach-logged, no parent session)
    prisma.throwLog.findMany({
      where: {
        athleteId,
        sessionId: null,
        date: { gte: firstDay, lte: lastDay },
      },
      select: { date: true },
    }),
  ]);

  // Build map: date -> { hasCompleted, hasScheduled }
  const dayMap = new Map<string, { hasCompleted: boolean; hasScheduled: boolean }>();

  const getOrCreate = (date: string) => {
    if (!dayMap.has(date)) dayMap.set(date, { hasCompleted: false, hasScheduled: false });
    return dayMap.get(date)!;
  };

  for (const ps of allProgramSessions) {
    // Resolve actual date: explicit scheduledDate or computed from startDate
    let dateStr = ps.scheduledDate;
    if (!dateStr && ps.program.startDate) {
      const start = new Date(ps.program.startDate);
      start.setDate(start.getDate() + (ps.weekNumber - 1) * 7 + (ps.dayOfWeek - 1));
      dateStr = start.getFullYear() + "-" +
        String(start.getMonth() + 1).padStart(2, "0") + "-" +
        String(start.getDate()).padStart(2, "0");
    }
    if (!dateStr) continue;
    // Filter to current month
    if (dateStr < firstYMD || dateStr > lastYMD) continue;
    const entry = getOrCreate(dateStr);
    if (ps.status === "COMPLETED") entry.hasCompleted = true;
    else entry.hasScheduled = true;
  }

  for (const ts of trainingSessions) {
    const ymd = `${ts.scheduledDate.getFullYear()}-${String(ts.scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(ts.scheduledDate.getDate()).padStart(2, "0")}`;
    const entry = getOrCreate(ymd);
    if (ts.status === "COMPLETED") entry.hasCompleted = true;
    else entry.hasScheduled = true;
  }

  for (const ta of throwsAssignments) {
    const entry = getOrCreate(ta.assignedDate);
    if (ta.status === "COMPLETED" || ta.status === "PARTIAL") entry.hasCompleted = true;
    else if (ta.status !== "SKIPPED") entry.hasScheduled = true;
  }

  for (const ss of selfSessions) {
    const entry = getOrCreate(ss.date);
    // Self-logged sessions are always "completed" activity
    entry.hasCompleted = true;
  }

  // Standalone throws (Quick Log / coach-logged): mark the date as completed
  for (const t of standaloneThrows) {
    const d = t.date;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (ymd >= firstYMD && ymd <= lastYMD) {
      getOrCreate(ymd).hasCompleted = true;
    }
  }

  return Array.from(dayMap.entries()).map(([date, flags]) => ({
    date,
    hasCompleted: flags.hasCompleted,
    hasScheduled: flags.hasScheduled,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  4. PERSONAL BESTS                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchPRsData(athleteId: string): Promise<PRItem[]> {
  const canonical = await getAthletePRs(athleteId);

  const items: PRItem[] = canonical.events
    .map((e) => {
      // Prefer competition PR; fall back to practice best if no competition throws yet.
      const primary = e.competitionPR ?? e.practiceBest;
      if (!primary) return null;
      return {
        id: primary.throwLogId ?? `manual-${e.event}`,
        event: e.event as string,
        distance: primary.distance,
        date: primary.date,
      };
    })
    .filter((x): x is PRItem => x !== null)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 4);

  return items;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  5. QUICK STATS                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchQuickStatsData(athleteId: string): Promise<QuickStatsData> {
  const now = new Date();
  // Monday-anchored week (consistent with the rest of the app)
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday...
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(now.getDate() + daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const weekYMD = startOfWeek.getFullYear() + "-" +
    String(startOfWeek.getMonth() + 1).padStart(2, "0") + "-" +
    String(startOfWeek.getDate()).padStart(2, "0");

  // Count across ALL session types — not just TrainingSession.
  // Also count distinct dates with standalone ThrowLog entries (Quick Log +
  // coach-logged throws that don't belong to a formal session).
  const [athlete, legacyTotal, legacyWeek, programTotal, programWeek, selfLoggedTotal, selfLoggedWeek, standaloneThrowDates, standaloneThrowDatesWeek] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true },
    }),

    // Legacy TrainingSession
    prisma.trainingSession.count({
      where: { athleteId, status: "COMPLETED" },
    }),
    prisma.trainingSession.count({
      where: { athleteId, status: "COMPLETED", completedDate: { gte: startOfWeek } },
    }),

    // ProgramSession (Bondarchuk programs)
    prisma.programSession.count({
      where: { program: { athleteId }, status: "COMPLETED" },
    }),
    prisma.programSession.count({
      where: { program: { athleteId }, status: "COMPLETED", completedAt: { gte: startOfWeek } },
    }),

    // AthleteThrowsSession (self-logged)
    prisma.athleteThrowsSession.count({
      where: { athleteId },
    }),
    prisma.athleteThrowsSession.count({
      where: { athleteId, date: { gte: weekYMD } },
    }),

    // Standalone ThrowLog entries (Quick Log / coach-logged, sessionId is null).
    // Count distinct dates as "training days" so Quick Log activity counts.
    prisma.throwLog.findMany({
      where: { athleteId, sessionId: null },
      select: { date: true },
      distinct: ["date"],
    }),
    prisma.throwLog.findMany({
      where: { athleteId, sessionId: null, date: { gte: startOfWeek } },
      select: { date: true },
      distinct: ["date"],
    }),
  ]);

  // Distinct dates → count unique days (the "distinct" on DateTime may return
  // multiple rows for the same calendar day, so normalise to YYYY-MM-DD).
  function countUniqueDays(rows: { date: Date }[]): number {
    const s = new Set<string>();
    for (const r of rows) {
      const d = r.date;
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return s.size;
  }

  const standaloneTotal = countUniqueDays(standaloneThrowDates);
  const standaloneWeek = countUniqueDays(standaloneThrowDatesWeek);

  return {
    sessionsThisWeek: legacyWeek + programWeek + selfLoggedWeek + standaloneWeek,
    currentStreak: athlete?.currentStreak ?? 0,
    totalSessions: legacyTotal + programTotal + selfLoggedTotal + standaloneTotal,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  6. GOALS                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchGoalsData(athleteId: string): Promise<GoalItem[]> {
  const goals = await prisma.goal.findMany({
    where: { athleteId, status: "ACTIVE" },
    orderBy: { deadline: "asc" },
    select: {
      id: true,
      title: true,
      targetValue: true,
      currentValue: true,
      unit: true,
    },
  });

  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    unit: g.unit,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  7. VOLUME (stub — VolumeWidget fetches client-side)                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchVolumeData(
  athleteId: string
): Promise<{ athleteId: string }> {
  return { athleteId };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  8. UPCOMING SESSIONS                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchUpcomingSessionsData(
  athleteId: string
): Promise<UpcomingSessionItem[]> {
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [legacySessions, throwsAssignments] = await Promise.all([
    // Legacy TrainingSession
    prisma.trainingSession.findMany({
      where: {
        athleteId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gte: now },
      },
      orderBy: { scheduledDate: "asc" },
      take: 5,
      include: { plan: { select: { name: true } } },
    }),

    // ThrowsAssignment (coach-assigned sessions)
    prisma.throwsAssignment.findMany({
      where: {
        athleteId,
        assignedDate: { gte: todayYMD },
        status: { in: ["ASSIGNED", "NOTIFIED", "IN_PROGRESS"] },
      },
      orderBy: { assignedDate: "asc" },
      take: 5,
      include: {
        session: { select: { name: true } },
      },
    }),
  ]);

  const items: UpcomingSessionItem[] = [];

  for (const s of legacySessions) {
    items.push({
      id: s.id,
      scheduledDate: s.scheduledDate.toISOString(),
      status: s.status as string,
      planName: s.plan?.name ?? null,
      coachNotes: s.coachNotes,
    });
  }

  for (const ta of throwsAssignments) {
    items.push({
      id: ta.id,
      scheduledDate: new Date(ta.assignedDate).toISOString(),
      status: ta.status,
      planName: ta.session.name,
      coachNotes: null,
    });
  }

  // Sort by date, take top 5
  items.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return items.slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  9. VIDEOS                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchVideosData(athleteId: string): Promise<VideoItem[]> {
  const videos = await prisma.videoUpload.findMany({
    where: {
      status: "ready",
      OR: [{ athleteId }, { sharedWithAthletes: { has: athleteId } }],
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      createdAt: true,
    },
  });

  return videos.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    createdAt: v.createdAt.toISOString(),
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  10. QUESTIONNAIRES                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchQuestionnairesData(
  athleteId: string
): Promise<QuestionnairesData> {
  const pending = await prisma.questionnaireAssignment.findMany({
    where: { athleteId, completedAt: null },
    include: {
      questionnaire: {
        select: { id: true, title: true, status: true, isActive: true, expiresAt: true },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const now = new Date();
  const valid = pending.filter((a) => {
    const q = a.questionnaire;
    if (q.status !== "published" || !q.isActive) return false;
    if (q.expiresAt && q.expiresAt < now) return false;
    return true;
  });

  return {
    pendingCount: valid.length,
    items: valid.map((a) => ({
      id: a.questionnaire.id,
      title: a.questionnaire.title,
    })),
  };
}
