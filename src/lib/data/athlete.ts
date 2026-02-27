/**
 * Server-side data-fetching functions for athlete pages.
 * All functions return plain serializable objects (dates as ISO strings).
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/* ─── Re-export shared types ─────────────────────────────────────────────── */

export type {
  ThrowLogItem,
  ReadinessTrendPoint,
  GoalItem,
  SessionItem,
} from "@/lib/data/coach";

/* ─── Athlete-specific types ─────────────────────────────────────────────── */

export type AthleteProfileFull = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  events: string[];
  gender: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  currentStreak: number;
  longestStreak: number;
  coachId: string;
  coachName: string;
  coachAvatar: string | null;
  email: string;
  memberSince: string;
};

export type AthleteStats = {
  currentStreak: number;
  longestStreak: number;
  sessionsThisWeek: number;
  totalSessionsAllTime: number;
  latestReadiness: {
    overallScore: number;
    injuryStatus: string;
    date: string;
  } | null;
  activeGoalsCount: number;
  personalBests: {
    event: string;
    distance: number;
    date: string;
  }[];
};

export type SessionDetailItem = {
  id: string;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  rpe: number | null;
  notes: string | null;
  coachNotes: string | null;
  planName: string | null;
  logs: {
    id: string;
    exerciseName: string;
    sets: number;
    reps: number | null;
    weight: number | null;
    rpe: number | null;
    distance: number | null;
    notes: string | null;
    completedAt: string;
  }[];
  throwLogs: {
    id: string;
    event: string;
    implementWeight: number;
    distance: number;
    isPersonalBest: boolean;
    notes: string | null;
  }[];
};

export type ReadinessCheckInItem = {
  id: string;
  date: string;
  overallScore: number;
  sleepQuality: number;
  sleepHours: number;
  soreness: number;
  sorenessArea: string | null;
  stressLevel: number;
  energyMood: number;
  hydration: string;
  injuryStatus: string;
  injuryNotes: string | null;
  notes: string | null;
};

/* ─── Auth Helper ─────────────────────────────────────────────────────────── */

/** Require authenticated athlete session. Redirects to /login or /athlete/onboarding. */
export async function requireAthleteSession() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    include: {
      coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
      user: { select: { email: true } },
    },
  });

  if (!athlete) redirect("/athlete/onboarding");

  // Redirect to onboarding if profile is minimal (no events set)
  // Onboarding is complete when athlete has set their events/gender/DOB
  const isOnboarded =
    athlete.events.length > 0 || athlete.dateOfBirth !== null || athlete.heightCm !== null;

  return { session, athlete, isOnboarded };
}

/* ─── Profile ─────────────────────────────────────────────────────────────── */

export async function getAthleteProfileFull(userId: string): Promise<AthleteProfileFull | null> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    include: {
      coach: { select: { firstName: true, lastName: true, avatarUrl: true } },
      user: { select: { email: true, createdAt: true } },
    },
  });

  if (!athlete) return null;

  return {
    id: athlete.id,
    userId: athlete.userId,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    events: athlete.events as string[],
    gender: athlete.gender as string,
    dateOfBirth: athlete.dateOfBirth?.toISOString() ?? null,
    avatarUrl: athlete.avatarUrl,
    heightCm: athlete.heightCm,
    weightKg: athlete.weightKg,
    currentStreak: athlete.currentStreak,
    longestStreak: athlete.longestStreak,
    coachId: athlete.coachId,
    coachName: `${athlete.coach.firstName} ${athlete.coach.lastName}`,
    coachAvatar: athlete.coach.avatarUrl,
    email: athlete.user.email,
    memberSince: athlete.user.createdAt.toISOString(),
  };
}

/* ─── Dashboard Stats ─────────────────────────────────────────────────────── */

export async function getAthleteStats(athleteId: string): Promise<AthleteStats> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [athlete, sessionsThisWeek, totalSessions, latestCheckIn, activeGoals, prs] =
    await Promise.all([
      prisma.athleteProfile.findUnique({
        where: { id: athleteId },
        select: { currentStreak: true, longestStreak: true },
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

      prisma.readinessCheckIn.findFirst({
        where: { athleteId },
        orderBy: { date: "desc" },
        select: { overallScore: true, injuryStatus: true, date: true },
      }),

      prisma.goal.count({
        where: { athleteId, status: "ACTIVE" },
      }),

      // Best throw per event
      prisma.throwLog.findMany({
        where: { athleteId, isPersonalBest: true },
        orderBy: { date: "desc" },
        select: { event: true, distance: true, date: true },
        distinct: ["event"],
      }),
    ]);

  return {
    currentStreak: athlete?.currentStreak ?? 0,
    longestStreak: athlete?.longestStreak ?? 0,
    sessionsThisWeek,
    totalSessionsAllTime: totalSessions,
    latestReadiness: latestCheckIn
      ? {
          overallScore: latestCheckIn.overallScore,
          injuryStatus: latestCheckIn.injuryStatus as string,
          date: latestCheckIn.date.toISOString(),
        }
      : null,
    activeGoalsCount: activeGoals,
    personalBests: prs.map((p) => ({
      event: p.event as string,
      distance: p.distance,
      date: p.date.toISOString(),
    })),
  };
}

/* ─── Sessions ────────────────────────────────────────────────────────────── */

export async function getAthleteUpcomingSessions(athleteId: string, limit = 5) {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      athleteId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      scheduledDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // include today
    },
    orderBy: { scheduledDate: "asc" },
    take: limit,
    include: { plan: { select: { name: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    scheduledDate: s.scheduledDate.toISOString(),
    completedDate: s.completedDate?.toISOString() ?? null,
    status: s.status as string,
    rpe: s.rpe,
    notes: s.notes,
    coachNotes: s.coachNotes,
    planName: s.plan?.name ?? null,
  }));
}

export async function getAthleteSessionHistory(athleteId: string, limit = 30) {
  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId },
    orderBy: { scheduledDate: "desc" },
    take: limit,
    include: { plan: { select: { name: true } } },
  });

  return sessions.map((s) => ({
    id: s.id,
    scheduledDate: s.scheduledDate.toISOString(),
    completedDate: s.completedDate?.toISOString() ?? null,
    status: s.status as string,
    rpe: s.rpe,
    notes: s.notes,
    coachNotes: s.coachNotes,
    planName: s.plan?.name ?? null,
  }));
}

export async function getAthleteSessionDetail(
  athleteId: string,
  sessionId: string
): Promise<SessionDetailItem | null> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, athleteId },
    include: {
      plan: { select: { name: true } },
      logs: {
        orderBy: { completedAt: "asc" },
        select: {
          id: true,
          exerciseName: true,
          sets: true,
          reps: true,
          weight: true,
          rpe: true,
          distance: true,
          notes: true,
          completedAt: true,
        },
      },
      throwLogs: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          event: true,
          implementWeight: true,
          distance: true,
          isPersonalBest: true,
          notes: true,
        },
      },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    scheduledDate: session.scheduledDate.toISOString(),
    completedDate: session.completedDate?.toISOString() ?? null,
    status: session.status as string,
    rpe: session.rpe,
    notes: session.notes,
    coachNotes: session.coachNotes,
    planName: session.plan?.name ?? null,
    logs: session.logs.map((l) => ({
      id: l.id,
      exerciseName: l.exerciseName,
      sets: l.sets,
      reps: l.reps,
      weight: l.weight,
      rpe: l.rpe,
      distance: l.distance,
      notes: l.notes,
      completedAt: l.completedAt.toISOString(),
    })),
    throwLogs: session.throwLogs.map((t) => ({
      id: t.id,
      event: t.event as string,
      implementWeight: t.implementWeight,
      distance: t.distance,
      isPersonalBest: t.isPersonalBest,
      notes: t.notes,
    })),
  };
}

/* ─── Readiness ───────────────────────────────────────────────────────────── */

export async function getAthleteCheckInHistory(
  athleteId: string,
  limit = 30
): Promise<ReadinessCheckInItem[]> {
  const checkIns = await prisma.readinessCheckIn.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: limit,
  });

  return checkIns.map((c) => ({
    id: c.id,
    date: c.date.toISOString(),
    overallScore: c.overallScore,
    sleepQuality: c.sleepQuality,
    sleepHours: c.sleepHours,
    soreness: c.soreness,
    sorenessArea: c.sorenessArea,
    stressLevel: c.stressLevel,
    energyMood: c.energyMood,
    hydration: c.hydration as string,
    injuryStatus: c.injuryStatus as string,
    injuryNotes: c.injuryNotes,
    notes: c.notes,
  }));
}

export async function getAthleteCheckInToday(
  athleteId: string
): Promise<ReadinessCheckInItem | null> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const existing = await prisma.readinessCheckIn.findFirst({
    where: { athleteId, date: { gte: startOfDay, lt: endOfDay } },
  });

  if (!existing) return null;

  return {
    id: existing.id,
    date: existing.date.toISOString(),
    overallScore: existing.overallScore,
    sleepQuality: existing.sleepQuality,
    sleepHours: existing.sleepHours,
    soreness: existing.soreness,
    sorenessArea: existing.sorenessArea,
    stressLevel: existing.stressLevel,
    energyMood: existing.energyMood,
    hydration: existing.hydration as string,
    injuryStatus: existing.injuryStatus as string,
    injuryNotes: existing.injuryNotes,
    notes: existing.notes,
  };
}

/* ─── Implement Comparison (for charts) ──────────────────────────────────── */

export type ImplementComparisonSeries = {
  implementWeight: number;
  label: string;
  data: { date: string; distance: number }[];
};

export async function getAthleteImplementComparison(
  athleteId: string,
  event: string
): Promise<ImplementComparisonSeries[]> {
  const throws = await prisma.throwLog.findMany({
    where: { athleteId, event: event as never },
    orderBy: { date: "asc" },
    select: { date: true, distance: true, implementWeight: true },
  });

  const byWeight: Record<number, { date: string; distance: number }[]> = {};
  for (const t of throws) {
    if (!byWeight[t.implementWeight]) byWeight[t.implementWeight] = [];
    byWeight[t.implementWeight].push({
      date: t.date.toISOString(),
      distance: t.distance,
    });
  }

  return Object.entries(byWeight)
    .map(([weight, data]) => ({
      implementWeight: parseFloat(weight),
      label: `${parseFloat(weight)}kg`,
      data,
    }))
    .sort((a, b) => b.implementWeight - a.implementWeight);
}

/* ─── Session With Prescription ───────────────────────────────────────────── */

export type PrescribedExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  order: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  rpe: number | null;
  distance: string | null;
  restSeconds: number | null;
  notes: string | null;
  implementKg: number | null;
};

export type PrescribedBlock = {
  id: string;
  name: string;
  order: number;
  blockType: string;
  restSeconds: number | null;
  notes: string | null;
  exercises: PrescribedExercise[];
};

export type SessionWithPrescription = SessionDetailItem & {
  planId: string | null;
  blocks: PrescribedBlock[];
};

export async function getSessionWithPrescription(
  athleteId: string,
  sessionId: string
): Promise<SessionWithPrescription | null> {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, athleteId },
    include: {
      plan: {
        include: {
          blocks: {
            orderBy: { order: "asc" },
            include: {
              exercises: {
                orderBy: { order: "asc" },
                include: { exercise: { select: { name: true, category: true } } },
              },
            },
          },
        },
      },
      logs: { orderBy: { completedAt: "asc" } },
      throwLogs: { orderBy: { date: "asc" } },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    planId: session.planId,
    scheduledDate: session.scheduledDate.toISOString(),
    completedDate: session.completedDate?.toISOString() ?? null,
    status: session.status as string,
    rpe: session.rpe,
    notes: session.notes,
    coachNotes: session.coachNotes,
    planName: session.plan?.name ?? null,
    logs: session.logs.map((l) => ({
      id: l.id,
      exerciseName: l.exerciseName,
      sets: l.sets,
      reps: l.reps,
      weight: l.weight,
      rpe: l.rpe,
      distance: l.distance,
      notes: l.notes,
      completedAt: l.completedAt.toISOString(),
    })),
    throwLogs: session.throwLogs.map((t) => ({
      id: t.id,
      event: t.event as string,
      implementWeight: t.implementWeight,
      distance: t.distance,
      isPersonalBest: t.isPersonalBest,
      notes: t.notes,
    })),
    blocks: (session.plan?.blocks ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      order: b.order,
      blockType: b.blockType,
      restSeconds: b.restSeconds,
      notes: b.notes,
      exercises: b.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exercise.name,
        exerciseCategory: e.exercise.category as string,
        order: e.order,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        rpe: e.rpe,
        distance: e.distance,
        restSeconds: e.restSeconds,
        notes: e.notes,
        implementKg: e.implementKg,
      })),
    })),
  };
}

/* ─── Questionnaires ────────────────────────────────────────────────────── */

export type AthleteQuestionnaireItem = {
  assignmentId: string;
  questionnaireId: string;
  title: string;
  description: string | null;
  type: string;
  questionCount: number;
  blockCount: number;
  dueDate: string | null;
  assignedAt: string;
  completedAt: string | null;
  hasDraft: boolean;
};

export async function getAthleteAssignedQuestionnaires(
  athleteId: string
): Promise<AthleteQuestionnaireItem[]> {
  const assignments = await prisma.questionnaireAssignment.findMany({
    where: { athleteId },
    include: {
      questionnaire: {
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          questions: true,
          blocks: true,
          status: true,
          isActive: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const now = new Date();

  return assignments
    .filter((a) => {
      const q = a.questionnaire;
      if (q.status !== "published" || !q.isActive) return false;
      if (q.expiresAt && q.expiresAt < now) return false;
      return true;
    })
    .map((a) => ({
      assignmentId: a.id,
      questionnaireId: a.questionnaire.id,
      title: a.questionnaire.title,
      description: a.questionnaire.description,
      type: a.questionnaire.type as string,
      questionCount: Array.isArray(a.questionnaire.questions)
        ? (a.questionnaire.questions as unknown[]).length
        : 0,
      blockCount: Array.isArray(a.questionnaire.blocks)
        ? (a.questionnaire.blocks as unknown[]).length
        : 0,
      dueDate: a.dueDate?.toISOString() ?? null,
      assignedAt: a.assignedAt.toISOString(),
      completedAt: a.completedAt?.toISOString() ?? null,
      hasDraft: a.draftAnswers != null,
    }));
}

export type QuestionnaireForFill = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>;
  blocks: unknown[] | null;
  displayMode: string;
  welcomeScreen: unknown | null;
  thankYouScreen: unknown | null;
  conditionalLogic: unknown | null;
  scoringEnabled: boolean;
  alreadyCompleted: boolean;
  assignmentId: string | null;
  draftAnswers: Record<string, unknown> | null;
};

export async function getQuestionnaireForFill(
  questionnaireId: string,
  athleteId: string
): Promise<QuestionnaireForFill | null> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      questions: true,
      blocks: true,
      displayMode: true,
      welcomeScreen: true,
      thankYouScreen: true,
      conditionalLogic: true,
      scoringEnabled: true,
      status: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!questionnaire || questionnaire.status !== "published") return null;
  if (!questionnaire.isActive) return null;
  if (questionnaire.expiresAt && questionnaire.expiresAt < new Date()) return null;

  // Check if assigned (find latest uncompleted assignment first, then any)
  const assignment = await prisma.questionnaireAssignment.findFirst({
    where: { questionnaireId, athleteId },
    orderBy: { assignedAt: "desc" },
  });

  if (!assignment) return null;

  return {
    id: questionnaire.id,
    title: questionnaire.title,
    description: questionnaire.description,
    type: questionnaire.type as string,
    questions: (questionnaire.questions as unknown as QuestionnaireForFill["questions"]) ?? [],
    blocks: questionnaire.blocks as unknown[] | null,
    displayMode: questionnaire.displayMode as string,
    welcomeScreen: questionnaire.welcomeScreen,
    thankYouScreen: questionnaire.thankYouScreen,
    conditionalLogic: questionnaire.conditionalLogic,
    scoringEnabled: questionnaire.scoringEnabled,
    alreadyCompleted: !!assignment.completedAt,
    assignmentId: assignment.id,
    draftAnswers: assignment.draftAnswers as Record<string, unknown> | null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  VIDEO                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type AthleteVideoItem = {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  event: string | null;
  category: string | null;
  durationSec: number | null;
  annotationCount: number;
  coachName: string | null;
  createdAt: string;
};

export type AthleteVideoDetail = {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  event: string | null;
  category: string | null;
  annotations: unknown;
  durationSec: number | null;
  coachName: string | null;
  createdAt: string;
};

export async function getAthleteVideos(
  athleteId: string
): Promise<AthleteVideoItem[]> {
  const videos = await prisma.videoUpload.findMany({
    where: {
      status: "ready",
      OR: [
        { athleteId },
        { sharedWithAthletes: { has: athleteId } },
      ],
    },
    include: {
      coach: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return videos.map((v) => {
    const annotations = Array.isArray(v.annotations) ? v.annotations : [];
    return {
      id: v.id,
      title: v.title,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      event: (v.event as string) ?? null,
      category: v.category,
      durationSec: v.durationSec,
      annotationCount: annotations.length,
      coachName: v.coach
        ? `${v.coach.firstName} ${v.coach.lastName}`
        : null,
      createdAt: v.createdAt.toISOString(),
    };
  });
}

export async function getAthleteVideoById(
  videoId: string,
  athleteId: string
): Promise<AthleteVideoDetail | null> {
  const video = await prisma.videoUpload.findFirst({
    where: {
      id: videoId,
      status: "ready",
      OR: [
        { athleteId },
        { sharedWithAthletes: { has: athleteId } },
      ],
    },
    include: {
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  if (!video) return null;

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    url: video.url,
    thumbnailUrl: video.thumbnailUrl,
    event: (video.event as string) ?? null,
    category: video.category,
    annotations: video.annotations,
    durationSec: video.durationSec,
    coachName: video.coach
      ? `${video.coach.firstName} ${video.coach.lastName}`
      : null,
    createdAt: video.createdAt.toISOString(),
  };
}

/* ─── Achievements ────────────────────────────────────────────────────────── */

export type AchievementItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  badgeKey: string | null;
  metadata: Record<string, unknown> | null;
  earnedAt: string;
};

export async function getAthleteAchievements(
  athleteId: string
): Promise<AchievementItem[]> {
  const achievements = await prisma.achievement.findMany({
    where: { athleteId },
    orderBy: { earnedAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      badgeKey: true,
      metadata: true,
      earnedAt: true,
    },
  });

  return achievements.map((a) => ({
    id: a.id,
    type: a.type as string,
    title: a.title,
    description: a.description,
    badgeKey: a.badgeKey,
    metadata: a.metadata as Record<string, unknown> | null,
    earnedAt: a.earnedAt.toISOString(),
  }));
}

/* ─── Athlete Goals with Progress ────────────────────────────────────────── */

export async function getAthleteGoalsWithProgress(
  athleteId: string
): Promise<import("@/lib/data/coach").GoalItem[]> {
  const goals = await prisma.goal.findMany({
    where: { athleteId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      targetValue: true,
      currentValue: true,
      startingValue: true,
      unit: true,
      event: true,
      deadline: true,
      status: true,
      createdAt: true,
    },
  });

  const now = Date.now();

  return goals.map((g) => {
    const baseline = g.startingValue ?? 0;
    const range = g.targetValue - baseline;
    const gained = g.currentValue - baseline;
    const progressPct =
      range > 0 ? Math.min(100, Math.max(0, Math.round((gained / range) * 100))) : 0;

    let projectedCompletionDate: string | null = null;
    const daysElapsed = (now - g.createdAt.getTime()) / 86_400_000;
    const remaining = g.targetValue - g.currentValue;
    if (
      g.startingValue !== null &&
      daysElapsed > 0 &&
      gained > 0 &&
      remaining > 0
    ) {
      const ratePerDay = gained / daysElapsed;
      const daysToCompletion = remaining / ratePerDay;
      projectedCompletionDate = new Date(now + daysToCompletion * 86_400_000).toISOString();
    }

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      startingValue: g.startingValue,
      unit: g.unit,
      event: g.event as string | null,
      deadline: g.deadline?.toISOString() ?? null,
      status: g.status as string,
      progressPct,
      createdAt: g.createdAt.toISOString(),
      projectedCompletionDate,
    };
  });
}
