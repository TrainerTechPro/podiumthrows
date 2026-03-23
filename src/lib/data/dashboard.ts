/**
 * Server-side data-fetching functions for the athlete dashboard widgets.
 * All functions return plain serializable objects (dates as ISO strings).
 */

import prisma from "@/lib/prisma";

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

function todayYMD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
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
  const start = startOfToday();
  const end = endOfToday();

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
  const today = todayYMD();
  const dayStart = startOfToday();
  const dayEnd = endOfToday();

  const sessions: TodaySession[] = [];

  // ── Source 1: ProgramSession ────────────────────────────────────────────
  const programSessions = await prisma.programSession.findMany({
    where: {
      scheduledDate: today,
      program: { athleteId },
    },
    include: {
      program: {
        select: {
          event: true,
          selfProgramConfig: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const ps of programSessions) {
    const allItems = parseProgramSessionItems({
      throwsPrescription: ps.throwsPrescription,
      strengthPrescription: ps.strengthPrescription ?? null,
      warmupPrescription: ps.warmupPrescription ?? null,
    });
    const selfConfigId = ps.program.selfProgramConfig?.id;
    const href = selfConfigId
      ? `/athlete/self-program/${selfConfigId}`
      : `/athlete/sessions`;

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
    where: { athleteId, assignedDate: today },
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
      href: `/athlete/sessions`,
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

  const [programSessions, trainingSessions] = await Promise.all([
    // ProgramSession — scheduledDate is String (YYYY-MM-DD)
    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        scheduledDate: { gte: firstYMD, lte: lastYMD },
      },
      select: { scheduledDate: true, status: true },
    }),

    // TrainingSession — scheduledDate is DateTime
    prisma.trainingSession.findMany({
      where: {
        athleteId,
        scheduledDate: { gte: firstDay, lte: lastDay },
      },
      select: { scheduledDate: true, status: true },
    }),
  ]);

  // Build map: date -> { hasCompleted, hasScheduled }
  const dayMap = new Map<string, { hasCompleted: boolean; hasScheduled: boolean }>();

  const getOrCreate = (date: string) => {
    if (!dayMap.has(date)) dayMap.set(date, { hasCompleted: false, hasScheduled: false });
    return dayMap.get(date)!;
  };

  for (const ps of programSessions) {
    if (!ps.scheduledDate) continue;
    const entry = getOrCreate(ps.scheduledDate);
    if (ps.status === "COMPLETED") entry.hasCompleted = true;
    else entry.hasScheduled = true;
  }

  for (const ts of trainingSessions) {
    const ymd = `${ts.scheduledDate.getFullYear()}-${String(ts.scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(ts.scheduledDate.getDate()).padStart(2, "0")}`;
    const entry = getOrCreate(ymd);
    if (ts.status === "COMPLETED") entry.hasCompleted = true;
    else entry.hasScheduled = true;
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
  const prs = await prisma.throwLog.findMany({
    where: { athleteId, isPersonalBest: true },
    orderBy: { distance: "desc" },
    select: {
      id: true,
      event: true,
      distance: true,
      date: true,
    },
  });

  // Deduplicate by event — keep the best distance per event
  const bestByEvent = new Map<string, (typeof prs)[number]>();
  for (const pr of prs) {
    const event = pr.event as string;
    const existing = bestByEvent.get(event);
    if (!existing || pr.distance > existing.distance) {
      bestByEvent.set(event, pr);
    }
  }

  return Array.from(bestByEvent.values())
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      event: p.event as string,
      distance: p.distance,
      date: p.date.toISOString(),
    }));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  5. QUICK STATS                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export async function fetchQuickStatsData(athleteId: string): Promise<QuickStatsData> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [athlete, sessionsThisWeek, totalSessions] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true },
    }),

    prisma.trainingSession.count({
      where: {
        athleteId,
        status: "COMPLETED",
        completedDate: { gte: startOfWeek },
      },
    }),

    prisma.trainingSession.count({
      where: { athleteId, status: "COMPLETED" },
    }),
  ]);

  return {
    sessionsThisWeek,
    currentStreak: athlete?.currentStreak ?? 0,
    totalSessions,
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
  const sessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      scheduledDate: { gte: new Date() },
    },
    orderBy: { scheduledDate: "asc" },
    take: 5,
    include: { plan: { select: { name: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    scheduledDate: s.scheduledDate.toISOString(),
    status: s.status as string,
    planName: s.plan?.name ?? null,
    coachNotes: s.coachNotes,
  }));
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
