import "server-only";
import prisma from "@/lib/prisma";
import { getStreakState } from "@/lib/athlete/streak-engine";

/**
 * Athlete home/dashboard DTO. Drives the front-door surface — greeting +
 * readiness ring, today's session hero, week strip, three recent moments.
 *
 * Kept narrow on purpose: this is "the screen the athlete opens 30 times
 * a day." Anything that doesn't earn its place here lives somewhere deeper.
 */
export type AthleteDashboardDTO = {
  athlete: { firstName: string };
  /** 1-5 rounded; null when no readiness data on file. Source attributes the signal. */
  readiness: { score: number; source: "self" | "whoop" | "oura"; checkedAt: string } | null;
  today: TodayCardDTO | null;
  week: WeekStripDTO;
  recent: RecentMomentsDTO;
};

export type TodayCardDTO = {
  sessionId: string;
  status: "PRESCRIBED" | "LOGGED" | "IN_PROGRESS";
  /** "Build the heavy turn." — plan name or fallback. */
  title: string;
  /** Single warm sentence with implement chips inline. */
  prescription: PrescriptionToken[];
  durationLabel: string; // "85 MIN"
  /** Up to 4 block pips — heavy block flagged for gold tint. */
  blocks: TodayBlockPipDTO[];
};

export type TodayBlockPipDTO = {
  label: string; // "B1"
  value: string; // "9kg → 8kg" | "Squat" | "Med ball"
  isHeavy: boolean;
};

export type PrescriptionToken =
  | { kind: "text"; value: string }
  | { kind: "implement"; value: string };

export type WeekStripDTO = {
  /** 7 entries Mon-Sun for the week containing today. */
  days: WeekDayDTO[];
  /** Index 0-6 of "today" in the days array. */
  todayIndex: number;
};

export type WeekDayDTO = {
  date: string; // ISO
  dow: string; // "MON"
  dayNumber: number; // 21
  state: "done" | "today" | "scheduled" | "future" | "rest";
  sessionId: string | null;
};

export type RecentMomentsDTO = {
  lastPR: LastPRDTO | null;
  lastSession: LastSessionDTO | null;
  currentStreak: { count: number; longest: number } | null;
};

export type LastPRDTO = {
  throwId: string;
  event: string;
  distance: number;
  achievedAt: string;
  daysAgoLabel: string; // "12 DAYS AGO" | "TODAY" | "YESTERDAY"
  competitionId: string | null;
  competitionName: string | null;
  previousBest: number | null;
};

export type LastSessionDTO = {
  sessionId: string;
  topDistance: number | null;
  averageRpe: number | null;
  totalThrows: number;
  totalLogged: number;
  scheduledAt: string;
  dowLabel: string; // "THU"
  eventLabel: string;
};

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Loads the dashboard DTO for the named athlete profile. Returns derived,
 * UI-ready shapes — no Prisma types leak past this boundary.
 */
export async function loadAthleteDashboard(
  athleteProfileId: string,
  firstName: string,
  now: Date = new Date()
): Promise<AthleteDashboardDTO> {
  const startOfToday = startOfDay(now);
  const endOfToday = addDays(startOfToday, 1);
  const startOfWeek = startOfMonday(now);
  const endOfWeek = addDays(startOfWeek, 7);

  const [latestReadiness, todaySession, weekSessions, lastPR, lastCompletedSession, streakState] =
    await Promise.all([
      prisma.readinessCheckIn.findFirst({
        where: { athleteId: athleteProfileId },
        orderBy: { date: "desc" },
        select: { overallScore: true, date: true, source: true },
      }),
      prisma.trainingSession.findFirst({
        where: {
          athleteId: athleteProfileId,
          scheduledDate: { gte: startOfToday, lt: endOfToday },
        },
        orderBy: { scheduledDate: "asc" },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          plan: {
            select: {
              name: true,
              description: true,
              event: true,
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  order: true,
                  blockType: true,
                  name: true,
                  exercises: {
                    orderBy: { order: "asc" },
                    select: { implementKg: true, sets: true, exercise: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.trainingSession.findMany({
        where: {
          athleteId: athleteProfileId,
          scheduledDate: { gte: startOfWeek, lt: endOfWeek },
        },
        orderBy: { scheduledDate: "asc" },
        select: { id: true, scheduledDate: true, status: true },
      }),
      prisma.throwLog.findFirst({
        where: { athleteId: athleteProfileId, isPersonalBest: true, distance: { not: null } },
        orderBy: { date: "desc" },
        select: {
          id: true,
          event: true,
          distance: true,
          date: true,
          competitionId: true,
          competition: { select: { name: true } },
        },
      }),
      prisma.trainingSession.findFirst({
        where: {
          athleteId: athleteProfileId,
          status: { in: ["COMPLETED", "IN_PROGRESS"] },
          scheduledDate: { lt: startOfToday },
        },
        orderBy: { scheduledDate: "desc" },
        select: {
          id: true,
          scheduledDate: true,
          plan: { select: { event: true } },
          throwLogs: {
            select: { distance: true, rpe: true },
          },
        },
      }),
      getStreakState(athleteProfileId),
    ]);

  // Previous-best lookup runs only if we have a PR — keeps the always-on
  // query count tight (one extra round-trip in the rare PR-on-file path).
  let previousBest: number | null = null;
  if (lastPR && lastPR.distance != null) {
    const prev = await prisma.throwLog.findFirst({
      where: {
        athleteId: athleteProfileId,
        event: lastPR.event,
        distance: { not: null, lt: lastPR.distance },
        id: { not: lastPR.id },
      },
      orderBy: { distance: "desc" },
      select: { distance: true },
    });
    previousBest = prev?.distance ?? null;
  }

  return {
    athlete: { firstName },
    readiness: latestReadiness
      ? {
          score: rescale10To5(latestReadiness.overallScore),
          source: mapReadinessSource(latestReadiness.source),
          checkedAt: latestReadiness.date.toISOString(),
        }
      : null,
    today: todaySession ? buildTodayCard(todaySession) : null,
    week: buildWeekStrip(startOfWeek, weekSessions, startOfToday),
    recent: {
      lastPR: lastPR ? buildLastPR(lastPR, previousBest, now) : null,
      lastSession: lastCompletedSession ? buildLastSession(lastCompletedSession) : null,
      currentStreak: streakState
        ? { count: streakState.currentStreak, longest: streakState.longestStreak }
        : null,
    },
  };
}

// ── Builders ────────────────────────────────────────────────────────────────

type TodaySessionExerciseRow = {
  implementKg: number | null;
  sets: number | null;
  exercise: { name: string };
};

type TodaySessionBlockRow = {
  order: number;
  blockType: string;
  name: string;
  exercises: TodaySessionExerciseRow[];
};

type TodaySessionRow = {
  id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  scheduledDate: Date;
  plan: {
    name: string;
    description: string | null;
    event: string | null;
    blocks: TodaySessionBlockRow[];
  } | null;
};

function buildTodayCard(s: TodaySessionRow): TodayCardDTO {
  const plan = s.plan;
  const blocks = plan?.blocks ?? [];

  // Heavy block = the throwing block whose exercises include the heaviest
  // implement on the day. If multiple throwing blocks exist, the FIRST one
  // (descending order is enforced upstream — first = heaviest).
  let heaviestKg = 0;
  for (const b of blocks) {
    if (b.blockType.toLowerCase() !== "throwing") continue;
    for (const e of b.exercises) {
      if (e.implementKg != null && e.implementKg > heaviestKg) heaviestKg = e.implementKg;
    }
  }
  let heavyBlockOrder = -1;
  for (const b of blocks) {
    if (b.blockType.toLowerCase() !== "throwing") continue;
    if (b.exercises.some((e) => e.implementKg === heaviestKg)) {
      heavyBlockOrder = b.order;
      break;
    }
  }

  const pips: TodayBlockPipDTO[] = blocks.slice(0, 4).map((b) => {
    const isThrowing = b.blockType.toLowerCase() === "throwing";
    let value: string;
    if (isThrowing) {
      const kgs = Array.from(
        new Set(b.exercises.map((e) => e.implementKg).filter((k): k is number => k != null))
      ).sort((a, c) => c - a);
      value = kgs.length > 0 ? kgs.map(formatKg).join(" → ") : b.name;
    } else {
      value = compactBlockSummary(b);
    }
    return {
      label: `B${b.order + 1}`,
      value,
      isHeavy: b.order === heavyBlockOrder,
    };
  });

  const totalSets = blocks.reduce(
    (sum, b) => sum + b.exercises.reduce((s, e) => s + (e.sets ?? 0), 0),
    0
  );
  // Defensible default: 6 min per set, capped at 90.
  const durationMinutes = Math.min(90, Math.max(20, totalSets * 6));

  return {
    sessionId: s.id,
    status:
      s.status === "COMPLETED"
        ? "LOGGED"
        : s.status === "IN_PROGRESS"
          ? "IN_PROGRESS"
          : "PRESCRIBED",
    title: plan?.name ?? "Today's session.",
    prescription: tokenizePrescription(plan?.description ?? null, blocks),
    durationLabel: `${durationMinutes} MIN`,
    blocks: pips,
  };
}

function compactBlockSummary(b: {
  name: string;
  exercises: Array<{ exercise: { name: string } }>;
}): string {
  // Strength/medball blocks summarize to a friendly tag — strip "Block N" prefixes.
  const cleaned = b.name.replace(/^block\s*\d+\s*[·:-]?\s*/i, "").trim();
  return cleaned || b.exercises[0]?.exercise.name || "Strength";
}

function tokenizePrescription(
  description: string | null,
  blocks: TodaySessionBlockRow[]
): PrescriptionToken[] {
  if (description && description.trim().length > 0) {
    const re =
      /(\d+(?:\.\d+)?\s*(?:×|x)\s*\d+(?:\.\d+)?\s*(?:kg|lbs?))|(\d+(?:\.\d+)?\s*(?:kg|lbs?|min|m))/gi;
    const tokens: PrescriptionToken[] = [];
    let last = 0;
    for (const m of description.matchAll(re)) {
      const idx = m.index ?? 0;
      if (idx > last) tokens.push({ kind: "text", value: description.slice(last, idx) });
      tokens.push({ kind: "implement", value: m[0].replace(/\s+/g, " ").trim() });
      last = idx + m[0].length;
    }
    if (last < description.length) tokens.push({ kind: "text", value: description.slice(last) });
    if (tokens.length > 0) return tokens;
  }

  // Fallback: synthesize from blocks. "Heavy hammer day. 5 × 9kg + 25 min squat ladder."
  const tokens: PrescriptionToken[] = [];
  const throwingBlock = blocks.find((b) => b.blockType.toLowerCase() === "throwing");
  if (throwingBlock) {
    const pieces = throwingBlock.exercises
      .filter((e) => e.implementKg != null)
      .map((e) => `${e.sets ?? 0} × ${formatKg(e.implementKg as number)}`);
    if (pieces.length > 0) {
      tokens.push({ kind: "text", value: "Today: " });
      pieces.forEach((p, i) => {
        tokens.push({ kind: "implement", value: p });
        if (i < pieces.length - 1) tokens.push({ kind: "text", value: " → " });
      });
    }
  }
  if (tokens.length === 0) {
    tokens.push({ kind: "text", value: "Open the session for full details." });
  }
  return tokens;
}

function buildWeekStrip(
  startOfWeek: Date,
  sessions: Array<{ id: string; scheduledDate: Date; status: string }>,
  startOfToday: Date
): WeekStripDTO {
  const byDate = new Map<string, { id: string; status: string }>();
  for (const s of sessions) {
    byDate.set(toDateKey(s.scheduledDate), { id: s.id, status: s.status });
  }

  const days: WeekDayDTO[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(startOfWeek, i);
    const key = toDateKey(d);
    const sess = byDate.get(key) ?? null;
    const isToday = d.getTime() === startOfToday.getTime();
    const isPast = d.getTime() < startOfToday.getTime();
    const isFuture = d.getTime() > startOfToday.getTime();

    let state: WeekDayDTO["state"];
    if (isToday) {
      state = "today";
    } else if (sess) {
      if (sess.status === "COMPLETED" || sess.status === "IN_PROGRESS") state = "done";
      else if (isPast)
        state = "rest"; // missed session collapses to rest
      else state = "scheduled";
    } else {
      state = isFuture ? "future" : "rest";
    }

    days.push({
      date: d.toISOString(),
      dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dayNumber: d.getDate(),
      state,
      sessionId: sess?.id ?? null,
    });
  }

  const todayIndex = days.findIndex((d) => d.state === "today");
  return { days, todayIndex: todayIndex < 0 ? 0 : todayIndex };
}

function buildLastPR(
  pr: {
    id: string;
    event: string;
    distance: number | null;
    date: Date;
    competitionId: string | null;
    competition: { name: string } | null;
  },
  previousBest: number | null,
  now: Date
): LastPRDTO {
  return {
    throwId: pr.id,
    event: pr.event,
    distance: pr.distance ?? 0,
    achievedAt: pr.date.toISOString(),
    daysAgoLabel: daysAgoLabel(pr.date, now),
    competitionId: pr.competitionId,
    competitionName: pr.competition?.name ?? null,
    previousBest,
  };
}

function buildLastSession(s: {
  id: string;
  scheduledDate: Date;
  plan: { event: string | null } | null;
  throwLogs: Array<{ distance: number | null; rpe: number | null }>;
}): LastSessionDTO {
  let topDistance: number | null = null;
  let rpeSum = 0;
  let rpeN = 0;
  let logged = 0;
  for (const t of s.throwLogs) {
    if (t.distance != null) {
      if (topDistance == null || t.distance > topDistance) topDistance = t.distance;
      logged += 1;
    }
    if (t.rpe != null) {
      rpeSum += t.rpe;
      rpeN += 1;
    }
  }
  const averageRpe = rpeN > 0 ? Math.round((rpeSum / rpeN) * 10) / 10 : null;
  return {
    sessionId: s.id,
    topDistance,
    averageRpe,
    totalThrows: s.throwLogs.length,
    totalLogged: logged,
    scheduledAt: s.scheduledDate.toISOString(),
    dowLabel: s.scheduledDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    eventLabel: s.plan?.event ?? "Session",
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonday(d: Date): Date {
  const out = startOfDay(d);
  const day = out.getDay(); // Sun=0 ... Sat=6
  const offset = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + offset);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function rescale10To5(x: number): number {
  // ReadinessCheckIn.overallScore is 1-10. The dashboard ring is 1-5.
  // Round-half-up keeps the most-important boundary (3↔4) human-intuitive.
  const v = Math.max(1, Math.min(5, Math.round(x / 2)));
  return v;
}

function mapReadinessSource(source: string): "self" | "whoop" | "oura" {
  const s = source.toUpperCase();
  if (s === "WHOOP") return "whoop";
  if (s === "OURA") return "oura";
  return "self";
}

function daysAgoLabel(date: Date, now: Date): string {
  const ms = startOfDay(now).getTime() - startOfDay(date).getTime();
  const days = Math.round(ms / 86400000);
  if (days <= 0) return "TODAY";
  if (days === 1) return "YESTERDAY";
  return `${days} DAYS AGO`;
}

function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}
