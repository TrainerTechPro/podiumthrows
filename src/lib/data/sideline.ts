import prisma from "@/lib/prisma";

export type SidelineSessionItem = {
  kind: "training" | "throws";
  id: string;
  title: string;
  status: string;
  href: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type SidelineAthleteToday = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  sessions: SidelineSessionItem[];
};

export type SidelineRosterAthlete = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  readinessScore: number | null;
  readinessMax: number;
  injuryStatus: string | null;
  lastLogAt: string | null;
};

export type SidelineData = {
  todayLabel: string;
  totalAthletes: number;
  todayByAthlete: SidelineAthleteToday[];
  roster: SidelineRosterAthlete[];
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eventLabel(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getSidelineData(coachId: string): Promise<SidelineData> {
  const now = new Date();
  const startToday = startOfLocalDay(now);
  const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
  const todayString = isoDate(startToday);

  const [trainingSessions, throwsAssignments, rosterAthletes] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        athlete: { coachId },
        scheduledDate: { gte: startToday, lt: endToday },
        status: { not: "SKIPPED" },
      },
      select: {
        id: true,
        status: true,
        completedDate: true,
        athleteId: true,
        plan: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    }),

    prisma.throwsAssignment.findMany({
      where: {
        athlete: { coachId },
        assignedDate: todayString,
        status: { not: "SKIPPED" },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        athleteId: true,
        session: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    prisma.athleteProfile.findMany({
      where: { coachId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        events: true,
        readinessCheckIns: {
          orderBy: { date: "desc" },
          take: 1,
          select: { overallScore: true, injuryStatus: true, date: true },
        },
        trainingSessions: {
          orderBy: { completedDate: "desc" },
          where: { completedDate: { not: null } },
          take: 1,
          select: { completedDate: true },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const athleteMap = new Map<string, SidelineAthleteToday>();
  for (const a of rosterAthletes) {
    athleteMap.set(a.id, {
      athleteId: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: a.avatarUrl,
      events: a.events.map(eventLabel),
      sessions: [],
    });
  }

  for (const s of trainingSessions) {
    const bucket = athleteMap.get(s.athleteId);
    if (!bucket) continue;
    bucket.sessions.push({
      kind: "training",
      id: s.id,
      title: s.plan?.name ?? "Training session",
      status: s.status,
      href: `/coach/session/${s.id}`,
      startedAt: null,
      completedAt: s.completedDate?.toISOString() ?? null,
    });
  }

  for (const t of throwsAssignments) {
    const bucket = athleteMap.get(t.athleteId);
    if (!bucket) continue;
    bucket.sessions.push({
      kind: "throws",
      id: t.id,
      title: t.session?.name ?? "Throws session",
      status: t.status,
      href: `/coach/throws/${t.id}?athlete=${t.athleteId}`,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    });
  }

  const todayByAthlete = Array.from(athleteMap.values())
    .filter((a) => a.sessions.length > 0)
    .sort((a, b) => {
      const aIncomplete = a.sessions.some((s) => s.status !== "COMPLETED");
      const bIncomplete = b.sessions.some((s) => s.status !== "COMPLETED");
      if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;
      return a.firstName.localeCompare(b.firstName);
    });

  const roster: SidelineRosterAthlete[] = rosterAthletes.map((a) => {
    const latest = a.readinessCheckIns[0] ?? null;
    const lastSession = a.trainingSessions[0]?.completedDate ?? null;
    return {
      athleteId: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avatarUrl: a.avatarUrl,
      events: a.events.map(eventLabel),
      readinessScore: latest?.overallScore ?? null,
      readinessMax: 10,
      injuryStatus: latest?.injuryStatus ?? null,
      lastLogAt: lastSession?.toISOString() ?? null,
    };
  });

  const todayLabel = startToday.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return {
    todayLabel,
    totalAthletes: rosterAthletes.length,
    todayByAthlete,
    roster,
  };
}
