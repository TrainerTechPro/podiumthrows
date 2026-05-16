import { redirect } from "next/navigation";
import { requireAthleteSession, getAthleteAchievements } from "@/lib/data/athlete";
import { ALL_BADGE_DEFINITIONS, STREAK_BADGES, SESSION_BADGES } from "@/lib/achievements";
import prisma from "@/lib/prisma";
import { ThrowsChipNav } from "../throws/_chip-nav";
import { AchievementsGrid, type BadgeWithProgress, type AchievementCategory } from "./_grid";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export const metadata = { title: "Achievements — Podium Throws" };

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const CATEGORY_KEYS: { label: string; keys: readonly string[] }[] = [
  {
    label: "Consistency",
    keys: [
      "checkin_first",
      "streak_3",
      "streak_7",
      "streak_14",
      "streak_30",
      "streak_60",
      "streak_100",
      "streak_365",
    ],
  },
  {
    label: "Training",
    keys: ["sessions_10", "sessions_25", "sessions_50", "sessions_100"],
  },
  {
    label: "Personal Bests",
    keys: ["pr_first", "pr_SHOT_PUT", "pr_DISCUS", "pr_HAMMER", "pr_JAVELIN"],
  },
];

interface ProgressContext {
  currentStreak: number;
  completedSessions: number;
  checkInCount: number;
  thrownEvents: Set<string>;
  hasAnyPR: boolean;
}

function computeProgress(
  badgeKey: string,
  ctx: ProgressContext
): { progress: number; criteria: string; progressLabel: string; tip: string } {
  // Streak badges
  const streak = STREAK_BADGES.find((b) => b.badgeKey === badgeKey);
  if (streak) {
    return {
      progress: ctx.currentStreak / streak.days,
      criteria: `Maintain a ${streak.days}-day training streak. Log a session or check-in every day to keep it alive.`,
      progressLabel: `${ctx.currentStreak} / ${streak.days} days`,
      tip:
        ctx.currentStreak === 0
          ? "Log a session today to start a streak."
          : `Don't miss tomorrow — you're ${streak.days - ctx.currentStreak} day${
              streak.days - ctx.currentStreak === 1 ? "" : "s"
            } away.`,
    };
  }

  // Session count badges
  const session = SESSION_BADGES.find((b) => b.badgeKey === badgeKey);
  if (session) {
    return {
      progress: ctx.completedSessions / session.count,
      criteria: `Complete ${session.count} training sessions logged in the app.`,
      progressLabel: `${ctx.completedSessions} / ${session.count} sessions`,
      tip:
        ctx.completedSessions >= session.count
          ? "Already there — refresh to claim."
          : `${session.count - ctx.completedSessions} session${
              session.count - ctx.completedSessions === 1 ? "" : "s"
            } to go.`,
    };
  }

  // First PR badge
  if (badgeKey === "pr_first") {
    return {
      progress: ctx.hasAnyPR ? 1 : 0,
      criteria:
        "Log your first competition or practice throw — your opening mark counts as your first PR.",
      progressLabel: ctx.hasAnyPR ? "Earned on next sync" : "0 PRs logged",
      tip: ctx.hasAnyPR
        ? "Your first PR is recorded — check back after the next sync."
        : "Log any throw with a distance to register your first personal best.",
    };
  }

  // Event-specific PRs
  const prMatch = badgeKey.match(/^pr_(SHOT_PUT|DISCUS|HAMMER|JAVELIN)$/);
  if (prMatch) {
    const event = prMatch[1];
    const eventLabel = EVENT_LABELS[event] ?? event;
    const thrown = ctx.thrownEvents.has(event);
    return {
      progress: thrown ? 1 : 0,
      criteria: `Set a personal best in ${eventLabel}. Your first logged throw in the event opens this badge.`,
      progressLabel: thrown ? "Earned on next sync" : `Log a ${eventLabel} throw`,
      tip: thrown
        ? `${eventLabel} PR is in the books — refresh to claim.`
        : `Log a ${eventLabel} throw with a distance to start tracking PRs in this event.`,
    };
  }

  // First check-in
  if (badgeKey === "checkin_first") {
    return {
      progress: ctx.checkInCount > 0 ? 1 : 0,
      criteria: "Complete a daily readiness check-in.",
      progressLabel: ctx.checkInCount > 0 ? "Earned on next sync" : "0 check-ins",
      tip:
        ctx.checkInCount > 0
          ? "Check-in recorded — refresh to claim."
          : "Open Daily Readiness from the dashboard and answer the prompts.",
    };
  }

  // Fallback (shouldn't hit unless a new badge is added without a progress mapping)
  return {
    progress: 0,
    criteria: "",
    progressLabel: "—",
    tip: "Keep training — this badge unlocks automatically.",
  };
}

export default async function AthleteAchievementsPage() {
  let athleteId: string;
  try {
    const session = await requireAthleteSession();
    athleteId = session.athlete.id;
  } catch {
    redirect("/login");
  }

  const [earned, athleteRow, completedSessions, checkInCount, thrownEventRows] = await Promise.all([
    getAthleteAchievements(athleteId),
    prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { currentStreak: true },
    }),
    prisma.trainingSession.count({
      where: { athleteId, status: "COMPLETED" },
    }),
    prisma.readinessCheckIn.count({ where: { athleteId } }),
    prisma.throwLog.findMany({
      where: { athleteId },
      distinct: ["event"],
      select: { event: true },
    }),
  ]);

  const ctx: ProgressContext = {
    currentStreak: athleteRow?.currentStreak ?? 0,
    completedSessions,
    checkInCount,
    thrownEvents: new Set(thrownEventRows.map((r) => r.event as string)),
    hasAnyPR: thrownEventRows.length > 0,
  };

  const earnedMap = new Map(earned.map((a) => [a.badgeKey, a]));
  const badgeDefMap = new Map(ALL_BADGE_DEFINITIONS.map((b) => [b.badgeKey, b]));
  const earnedCount = earned.filter((a) => a.badgeKey !== null).length;

  const categories: AchievementCategory[] = CATEGORY_KEYS.map(({ label, keys }) => {
    const badges: BadgeWithProgress[] = keys
      .map((key) => {
        const def = badgeDefMap.get(key);
        if (!def) return null;
        const earnedRecord = earnedMap.get(def.badgeKey);
        const isEarned = earnedRecord !== undefined;
        const progressInfo = computeProgress(def.badgeKey, ctx);
        return {
          id: def.badgeKey,
          title: def.title,
          description: def.description,
          emoji: "emoji" in def ? def.emoji : "🏅",
          isEarned,
          earnedAt: earnedRecord?.earnedAt ?? null,
          progress: isEarned ? 1 : Math.min(1, Math.max(0, progressInfo.progress)),
          criteria: progressInfo.criteria,
          progressLabel: progressInfo.progressLabel,
          tip: progressInfo.tip,
        };
      })
      .filter((b): b is BadgeWithProgress => b !== null);

    return { label, badges };
  });

  const allBadgesEmpty = categories.every((c) => c.badges.length === 0);

  return (
    <div className="space-y-6">
      <ThrowsChipNav />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Achievements</h1>
          <p className="text-sm text-muted mt-0.5">
            {earnedCount} of {ALL_BADGE_DEFINITIONS.length} badges earned · tap any badge for
            criteria
          </p>
        </div>
        {earnedCount > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-500 tabular-nums leading-none">
              <AnimatedNumber value={earnedCount} />
            </div>
            <div className="text-nano text-muted uppercase tracking-wider mt-0.5">Earned</div>
          </div>
        )}
      </div>

      {/* Grid */}
      {!allBadgesEmpty && <AchievementsGrid categories={categories} />}

      {/* Empty state if no badges at all earned */}
      {earned.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Start training to earn your first badge
          </p>
          <p className="text-xs text-muted mt-1">
            Log throws, complete check-ins, and build streaks to unlock achievements.
          </p>
        </div>
      )}
    </div>
  );
}
