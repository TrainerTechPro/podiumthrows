/**
 * Server-side data-fetching for the Athlete Training Hub.
 * Computes state (active | between | cold-start) and returns all data
 * needed for the corresponding UI.
 */

import prisma from "@/lib/prisma";
import { getAthleteTimezone, getLocalDate } from "@/lib/dates";
import { fetchTodayWorkoutData, fetchReadinessData, type TodaySession } from "@/lib/data/dashboard";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type WeekDay = {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue", ...
  dayNum: number; // 25
  isToday: boolean;
  sessionType: "throws" | "lift" | "mixed" | "rest";
  sessionCount: number;
};

export type SessionPreview = {
  id: string;
  name: string;
  sessionType: "throws" | "lift" | "mixed";
  href: string;
};

export type WeekRecap = {
  completed: number;
  total: number;
  totalThrows: number;
  avgRpe: number | null;
  prsHit: number;
};

export type NextSessionInfo = {
  date: string; // YYYY-MM-DD
  name: string;
  daysUntil: number;
};

export type OnboardingItem = {
  key: string;
  label: string;
  href: string;
  completed: boolean;
};

export type StuckSession = {
  /** Discriminator for which end-endpoint the client should hit. */
  kind: "assignment" | "training-session" | "program-session";
  id: string;
  name: string;
  date: string; // YYYY-MM-DD when the session was originally for
  sessionType: "throws" | "lift" | "mixed";
  href: string;
  /** Only set when kind === "program-session" — needed to build the End URL. */
  selfProgramConfigId?: string;
};

export type TrainingHubData = {
  state: "active" | "between" | "cold-start";
  todaySessions: TodaySession[];
  weekDays: WeekDay[];
  weekRecap: WeekRecap | null;
  nextSession: NextSessionInfo | null;
  lastProgrammingRequest: string | null; // ISO date or null
  onboardingItems: OnboardingItem[] | null;
  coachName: string;
  coachAvatarUrl: string | null;
  readinessCheckedInToday: boolean;
  pendingQuestionnaires: number;
  /** IN_PROGRESS rows that need an End action. Surfaces the "4 active with no
   *  way to finish" pattern from tester feedback 2026-04-10. */
  stuckSessions: StuckSession[];
  recentCompletions: Array<{
    id: string;
    date: string;
    name: string;
    rpe: number | null;
    throwCount: number | null;
    status: string;
    href: string;
  }>;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function todayYMD(timezone: string): string {
  return getLocalDate(timezone);
}

/** Get the Monday of the week containing a YYYY-MM-DD date string. */
function getMondayOf(ymd: string): Date {
  const d = new Date(ymd + "T12:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Main Fetcher ────────────────────────────────────────────────────────── */

export async function fetchTrainingHubData(athleteId: string): Promise<TrainingHubData> {
  const tz = await getAthleteTimezone(athleteId);
  const today = todayYMD(tz);
  const monday = getMondayOf(today);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  // Generate 7 date strings for the week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toYMD(d);
  });

  // ── Parallel fetches ──────────────────────────────────────────────────
  const [
    todaySessions,
    readiness,
    athlete,
    allProgramSessions,
    throwsAssignments,
    legacySessions,
    selfLoggedSessions,
    lastRequest,
    throwsProfile,
    goalsCount,
    pendingQuestionnaires,
    recentCompleted,
  ] = await Promise.all([
    // Today's sessions (reuse dashboard fetcher)
    fetchTodayWorkoutData(athleteId),

    // Readiness check-in today
    fetchReadinessData(athleteId),

    // Athlete + coach info
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        createdAt: true,
        coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),

    // ProgramSessions for the current week + upcoming (14 days)
    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        status: { notIn: ["SKIPPED"] },
      },
      select: {
        id: true,
        focusLabel: true,
        status: true,
        scheduledDate: true,
        weekNumber: true,
        dayOfWeek: true,
        throwsPrescription: true,
        strengthPrescription: true,
        totalThrowsTarget: true,
        completedAt: true,
        rpe: true,
        bestMark: true,
        program: {
          select: {
            event: true,
            startDate: true,
            selfProgramConfig: { select: { id: true } },
          },
        },
      },
    }),

    // ThrowsAssignments (for week + upcoming)
    prisma.throwsAssignment.findMany({
      where: {
        athleteId,
        status: { notIn: ["SKIPPED"] },
      },
      select: {
        id: true,
        assignedDate: true,
        status: true,
        rpe: true,
        completedAt: true,
        session: { select: { name: true, sessionType: true } },
      },
    }),

    // Legacy TrainingSessions
    prisma.trainingSession.findMany({
      where: { athleteId },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        rpe: true,
        plan: { select: { name: true } },
      },
      orderBy: { scheduledDate: "desc" },
      take: 50,
    }),

    // Self-logged AthleteThrowsSessions — editable via /athlete/throws/log?edit=<id>
    prisma.athleteThrowsSession.findMany({
      where: { athleteId },
      select: {
        id: true,
        event: true,
        date: true,
        focus: true,
        sessionRpe: true,
        drillLogs: { select: { throwCount: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),

    // Last PROGRAMMING_REQUESTED notification from this athlete
    prisma.notification.findFirst({
      where: {
        type: "PROGRAMMING_REQUESTED",
        athleteProfileId: athleteId,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),

    // ThrowsProfile existence (for onboarding checklist)
    prisma.throwsProfile.findFirst({
      where: { athleteId },
      select: { id: true },
    }),

    // Active goals count
    prisma.goal.count({
      where: { athleteId, status: "ACTIVE" },
    }),

    // Pending questionnaires
    prisma.questionnaireAssignment.count({
      where: { athleteId, completedAt: null },
    }),

    // Recent completed sessions (any source) for recap
    prisma.programSession.findMany({
      where: {
        program: { athleteId },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        focusLabel: true,
        scheduledDate: true,
        completedAt: true,
        status: true,
        rpe: true,
        actualThrows: true,
        bestMark: true,
        program: {
          select: {
            event: true,
            selfProgramConfig: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  // ── Resolve dates for all program sessions ────────────────────────────
  type ResolvedSession = {
    id: string;
    date: string;
    name: string;
    sessionType: "throws" | "lift" | "mixed";
    status: string;
    rpe: number | null;
    throwCount: number | null;
    href: string;
    completedAt: Date | null;
  };

  const allResolved: ResolvedSession[] = [];

  for (const ps of allProgramSessions) {
    let dateStr = ps.scheduledDate;
    if (!dateStr && ps.program.startDate) {
      const start = new Date(ps.program.startDate);
      start.setDate(start.getDate() + (ps.weekNumber - 1) * 7 + (ps.dayOfWeek - 1));
      dateStr = toYMD(start);
    }
    if (!dateStr) continue;

    const hasThrows = !!ps.throwsPrescription;
    const hasLifts = !!ps.strengthPrescription;
    const sType: "throws" | "lift" | "mixed" =
      hasThrows && hasLifts ? "mixed" : hasLifts ? "lift" : "throws";
    const selfConfigId = ps.program.selfProgramConfig?.id;

    allResolved.push({
      id: ps.id,
      date: dateStr,
      name: ps.focusLabel || `${ps.program.event} Session`,
      sessionType: sType,
      status: ps.status,
      rpe: ps.rpe as number | null,
      throwCount: ps.totalThrowsTarget,
      href: selfConfigId
        ? `/athlete/self-program/${selfConfigId}/session/${ps.id}`
        : `/athlete/sessions/${ps.id}`,
      completedAt: ps.completedAt,
    });
  }

  for (const ta of throwsAssignments) {
    const sType =
      (ta.session.sessionType?.toLowerCase() as "throws" | "lift" | "mixed") ?? "throws";
    allResolved.push({
      id: ta.id,
      date: ta.assignedDate,
      name: ta.session.name,
      sessionType: sType === "lift" || sType === "mixed" ? sType : "throws",
      status: ta.status,
      rpe: ta.rpe as number | null,
      throwCount: null,
      href: `/athlete/sessions/assignment/${ta.id}`,
      completedAt: ta.completedAt,
    });
  }

  for (const ls of legacySessions) {
    allResolved.push({
      id: ls.id,
      date: toYMD(ls.scheduledDate),
      name: ls.plan?.name ?? "Training Session",
      sessionType: "mixed",
      status: ls.status as string,
      rpe: ls.rpe as number | null,
      throwCount: null,
      href: `/athlete/sessions/${ls.id}`,
      completedAt: null,
    });
  }

  // Self-logged freestyle sessions — always "throws", editable via deep link
  const EVENT_LABELS: Record<string, string> = {
    SHOT_PUT: "Shot Put",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  for (const sl of selfLoggedSessions) {
    const throwCount = sl.drillLogs.reduce(
      (sum: number, d: { throwCount: number }) => sum + (d.throwCount ?? 0),
      0
    );
    const eventLabel = EVENT_LABELS[sl.event] ?? String(sl.event);
    const name = sl.focus ? `${eventLabel} · ${sl.focus}` : `${eventLabel} Session`;
    allResolved.push({
      id: sl.id,
      date: sl.date, // already YYYY-MM-DD string
      name,
      sessionType: "throws",
      status: "COMPLETED", // self-logged sessions are always "done"
      rpe: sl.sessionRpe,
      throwCount,
      href: `/athlete/throws/log?edit=${sl.id}`,
      completedAt: null,
    });
  }

  // ── Build week strip ──────────────────────────────────────────────────
  const weekDays: WeekDay[] = weekDates.map((date, i) => {
    const sessionsOnDay = allResolved.filter(
      (s) => s.date === date && s.status !== "COMPLETED" && s.status !== "SKIPPED"
    );
    const completedOnDay = allResolved.filter((s) => s.date === date && s.status === "COMPLETED");
    const allOnDay = [...sessionsOnDay, ...completedOnDay];

    let sessionType: WeekDay["sessionType"] = "rest";
    if (allOnDay.length > 0) {
      const types = allOnDay.map((s) => s.sessionType);
      if (types.includes("mixed") || (types.includes("throws") && types.includes("lift")))
        sessionType = "mixed";
      else if (types.includes("lift")) sessionType = "lift";
      else if (types.includes("throws")) sessionType = "throws";
    }

    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayNum: new Date(date + "T12:00:00").getDate(),
      isToday: date === today,
      sessionType,
      sessionCount: allOnDay.length,
    };
  });

  // ── Find next upcoming session ────────────────────────────────────────
  const futureUpcoming = allResolved
    .filter(
      (s) => s.date > today && ["SCHEDULED", "PLANNED", "ASSIGNED", "NOTIFIED"].includes(s.status)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextSession: NextSessionInfo | null =
    futureUpcoming.length > 0
      ? {
          date: futureUpcoming[0].date,
          name: futureUpcoming[0].name,
          daysUntil: Math.ceil(
            (new Date(futureUpcoming[0].date + "T12:00:00").getTime() -
              new Date(today + "T12:00:00").getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        }
      : null;

  // ── Week recap (completed this week) ──────────────────────────────────
  const completedThisWeek = allResolved.filter(
    (s) => s.status === "COMPLETED" && s.date >= weekDates[0] && s.date <= weekDates[6]
  );
  const scheduledThisWeek = allResolved.filter(
    (s) => s.date >= weekDates[0] && s.date <= weekDates[6] && s.status !== "SKIPPED"
  );

  const weekRecap: WeekRecap | null =
    completedThisWeek.length > 0
      ? {
          completed: completedThisWeek.length,
          total: scheduledThisWeek.length,
          totalThrows: completedThisWeek.reduce((sum, s) => sum + (s.throwCount ?? 0), 0),
          avgRpe:
            completedThisWeek.filter((s) => s.rpe != null).length > 0
              ? completedThisWeek.filter((s) => s.rpe != null).reduce((sum, s) => sum + s.rpe!, 0) /
                completedThisWeek.filter((s) => s.rpe != null).length
              : null,
          prsHit: recentCompleted.filter(
            (s) =>
              s.bestMark != null &&
              s.bestMark > 0 &&
              s.completedAt &&
              toYMD(s.completedAt) >= weekDates[0] &&
              toYMD(s.completedAt) <= weekDates[6]
          ).length,
        }
      : null;

  // ── Recent completions (last 5) ───────────────────────────────────────
  const recentCompletions = allResolved
    .filter((s) => s.status === "COMPLETED")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      date: s.date,
      name: s.name,
      rpe: s.rpe,
      throwCount: s.throwCount,
      status: s.status,
      href: s.href,
    }));

  // ── Stuck sessions (IN_PROGRESS, any date) ────────────────────────────
  // Pull from the three source queries directly so we preserve the
  // discriminator the client needs to hit the correct End endpoint.
  const stuckSessions: StuckSession[] = [];

  for (const ta of throwsAssignments) {
    if (ta.status !== "IN_PROGRESS") continue;
    const sType = (ta.session.sessionType?.toLowerCase() ??
      "throws") as StuckSession["sessionType"];
    stuckSessions.push({
      kind: "assignment",
      id: ta.id,
      name: ta.session.name,
      date: ta.assignedDate,
      sessionType: sType === "lift" || sType === "mixed" ? sType : "throws",
      href: `/athlete/sessions/assignment/${ta.id}`,
    });
  }

  for (const ls of legacySessions) {
    if (ls.status !== "IN_PROGRESS") continue;
    stuckSessions.push({
      kind: "training-session",
      id: ls.id,
      name: ls.plan?.name ?? "Training Session",
      date: toYMD(ls.scheduledDate),
      sessionType: "mixed",
      href: `/athlete/sessions/${ls.id}`,
    });
  }

  for (const ps of allProgramSessions) {
    if (ps.status !== "IN_PROGRESS") continue;
    const selfConfigId = ps.program.selfProgramConfig?.id;
    if (!selfConfigId) continue; // coach-programmed ProgramSessions aren't athlete-endable
    // Reuse the resolved-date path from above.
    let dateStr = ps.scheduledDate;
    if (!dateStr && ps.program.startDate) {
      const start = new Date(ps.program.startDate);
      start.setDate(start.getDate() + (ps.weekNumber - 1) * 7 + (ps.dayOfWeek - 1));
      dateStr = toYMD(start);
    }
    if (!dateStr) continue;
    const hasThrows = !!ps.throwsPrescription;
    const hasLifts = !!ps.strengthPrescription;
    const sType: "throws" | "lift" | "mixed" =
      hasThrows && hasLifts ? "mixed" : hasLifts ? "lift" : "throws";
    stuckSessions.push({
      kind: "program-session",
      id: ps.id,
      name: ps.focusLabel || `${ps.program.event} Session`,
      date: dateStr,
      sessionType: sType,
      href: `/athlete/self-program/${selfConfigId}/session/${ps.id}`,
      selfProgramConfigId: selfConfigId,
    });
  }

  // Sort: oldest first — the 3-day-stale session should be the first thing
  // you see, not the one from earlier this morning.
  stuckSessions.sort((a, b) => a.date.localeCompare(b.date));

  // ── Determine state ───────────────────────────────────────────────────
  const hasUpcomingWithin7Days =
    todaySessions.length > 0 ||
    futureUpcoming.some((s) => {
      const days = Math.ceil(
        (new Date(s.date + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return days <= 7;
    });

  const hasAnyCompletedSessions = allResolved.some((s) => s.status === "COMPLETED");

  let state: TrainingHubData["state"];
  if (hasUpcomingWithin7Days) {
    state = "active";
  } else if (hasAnyCompletedSessions) {
    state = "between";
  } else {
    state = "cold-start";
  }

  // ── Onboarding checklist (cold-start only) ────────────────────────────
  const readinessExists = readiness.checkedIn;
  const typingExists = throwsProfile !== null;
  const goalsExist = goalsCount > 0;

  const onboardingItems: OnboardingItem[] | null =
    state === "cold-start"
      ? [
          {
            key: "readiness",
            label: "Complete your Readiness Check-in",
            href: "/athlete/wellness",
            completed: readinessExists,
          },
          {
            key: "typing",
            label: "Take the Bondarchuk Typing Quiz",
            href: "/athlete/throws/quiz",
            completed: typingExists,
          },
          { key: "goals", label: "Set your Goals", href: "/athlete/goals", completed: goalsExist },
          {
            key: "questionnaires",
            label: "Fill out Questionnaires",
            href: "/athlete/questionnaires",
            completed: pendingQuestionnaires === 0 && goalsExist,
          },
          {
            key: "log-session",
            label: "Log a Session",
            href: "/athlete/log-session",
            completed: false,
          },
          {
            key: "drill-videos",
            label: "Browse Drill Videos",
            href: "/athlete/drill-videos",
            completed: false,
          },
        ]
      : null;

  // ── Cooldown check ────────────────────────────────────────────────────
  const lastRequestDate = lastRequest ? lastRequest.createdAt.toISOString() : null;

  return {
    state,
    todaySessions,
    weekDays,
    weekRecap,
    nextSession,
    lastProgrammingRequest: lastRequestDate,
    onboardingItems,
    coachName: athlete ? `${athlete.coach.firstName} ${athlete.coach.lastName}` : "Your Coach",
    coachAvatarUrl: athlete?.coach.avatarUrl ?? null,
    readinessCheckedInToday: readiness.checkedIn,
    pendingQuestionnaires,
    stuckSessions,
    recentCompletions,
  };
}
