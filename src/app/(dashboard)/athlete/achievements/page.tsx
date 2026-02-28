import { requireAthleteSession, getAthleteAchievements } from "@/lib/data/athlete";
import { redirect } from "next/navigation";
import { ALL_BADGE_DEFINITIONS } from "@/lib/achievements";
import { Badge } from "@/components";
import { HoloBadge } from "@/components/ui/HoloBadge";

export const metadata = { title: "Achievements — Podium Throws" };

/* ─── Category groupings ─────────────────────────────────────────────────── */

const CATEGORIES: { label: string; keys: readonly string[] }[] = [
  {
    label: "Consistency",
    keys: ["checkin_first", "streak_7", "streak_14", "streak_30", "streak_60"],
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

/* ─── Badge lookup ────────────────────────────────────────────────────────── */

const BADGE_MAP = new Map(ALL_BADGE_DEFINITIONS.map((b) => [b.badgeKey, b]));

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function AthleteAchievementsPage() {
  let athlete;
  try {
    const session = await requireAthleteSession();
    athlete = session.athlete;
  } catch {
    redirect("/login");
  }

  const earned = await getAthleteAchievements(athlete.id);
  const earnedMap = new Map(earned.map((a) => [a.badgeKey, a]));
  const earnedCount = earned.filter((a) => a.badgeKey !== null).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Achievements</h1>
          <p className="text-sm text-muted mt-0.5">
            {earnedCount} of {ALL_BADGE_DEFINITIONS.length} badges earned
          </p>
        </div>
        {earnedCount > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-500 tabular-nums leading-none">
              {earnedCount}
            </div>
            <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Earned</div>
          </div>
        )}
      </div>

      {/* Category sections */}
      {CATEGORIES.map(({ label, keys }) => {
        const badges = keys
          .map((key) => BADGE_MAP.get(key))
          .filter((b): b is (typeof ALL_BADGE_DEFINITIONS)[number] => b !== undefined);

        const sectionEarned = badges.filter((b) => earnedMap.has(b.badgeKey)).length;

        return (
          <section key={label} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
                {label}
              </h2>
              <span className="text-xs text-muted tabular-nums">
                {sectionEarned} / {badges.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {badges.map((badge) => {
                const achievement = earnedMap.get(badge.badgeKey);
                const isEarned = achievement !== undefined;

                return (
                  <HoloBadge key={badge.badgeKey} earned={isEarned}>
                    <div
                      className={`card p-4 flex flex-col items-center text-center gap-2 transition-all ${
                        isEarned
                          ? "ring-1 ring-amber-400/30 dark:ring-amber-500/20"
                          : ""
                      }`}
                    >
                      {/* Badge emoji */}
                      <div
                        className={`text-4xl leading-none select-none ${
                          !isEarned ? "filter blur-[1px]" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {"emoji" in badge ? badge.emoji : "🏅"}
                      </div>

                      {/* Title */}
                      <p className={`text-xs font-semibold leading-snug ${
                        isEarned ? "text-[var(--foreground)]" : "text-muted"
                      }`}>
                        {badge.title.replace(/[\uD800-\uDFFF\u2600-\u27BF]/g, "").trim()}
                      </p>

                      {/* Description */}
                      <p className="text-[10px] text-muted leading-snug line-clamp-2">
                        {badge.description}
                      </p>

                      {/* Earned date or locked */}
                      <div className="mt-auto pt-1">
                        {isEarned ? (
                          <Badge variant="success">
                            {new Date(achievement.earnedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-surface-400 dark:text-surface-600">
                            Not yet earned
                          </span>
                        )}
                      </div>
                    </div>
                  </HoloBadge>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Empty state if no badges at all earned */}
      {earned.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-medium text-[var(--foreground)]">Start training to earn your first badge</p>
          <p className="text-xs text-muted mt-1">
            Log throws, complete check-ins, and build streaks to unlock achievements.
          </p>
        </div>
      )}
    </div>
  );
}
