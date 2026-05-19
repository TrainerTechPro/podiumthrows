"use client";

import { useEffect, useState, useCallback } from "react";
import { Flame, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { EmptyState } from "@/components/ui/EmptyState";

type StreakStanding = {
  rank: number;
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  isViewer: boolean;
};

function intensityColor(streak: number): string {
  if (streak >= 30) return "text-danger-500";
  if (streak >= 14) return "text-primary-500";
  if (streak >= 7) return "text-warning-400";
  return "text-success-400";
}

function Avatar({ entry }: { entry: StreakStanding }) {
  if (entry.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
    );
  }
  return (
    <div className="h-9 w-9 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-sm font-bold text-[var(--foreground)] shrink-0">
      {entry.firstName.charAt(0)}
      {entry.lastName.charAt(0)}
    </div>
  );
}

export function TeamStreaks() {
  const [entries, setEntries] = useState<StreakStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/athlete/team/streaks?limit=10", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        setError(payload.error || "Couldn't load streak standings.");
        setEntries([]);
        return;
      }
      setEntries((payload.data?.entries ?? []) as StreakStanding[]);
    } catch (err) {
      logger.error("streaks load failed", { context: "athlete/team/streaks", error: err });
      setError("Network error — try again.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPullRefresh = () => void load();
    window.addEventListener("podium:pull-to-refresh", onPullRefresh);
    return () => window.removeEventListener("podium:pull-to-refresh", onPullRefresh);
  }, [load]);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-sm text-muted">
        <Loader2 className="animate-spin mr-2" size={16} aria-hidden="true" />
        Loading streaks…
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load streaks"
        description={error}
        onRetry={() => void load()}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Flame size={48} strokeWidth={1.75} aria-hidden="true" />}
        title="No active streaks yet"
        description="Be the spark — log a session today and you'll start one. Your teammates will follow."
      />
    );
  }

  return (
    <StaggeredList className="space-y-1.5">
      {entries.map((entry) => {
        const tone = intensityColor(entry.currentStreak);
        return (
          <div
            key={entry.athleteId}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] ${
              entry.isViewer ? "ring-1 ring-primary-500/40" : ""
            }`}
          >
            <span className="w-6 text-center text-xs font-semibold text-muted tabular-nums">
              {entry.rank}
            </span>
            <Avatar entry={entry} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                {entry.firstName} {entry.lastName.charAt(0)}.
                {entry.isViewer && (
                  <span className="ml-1 text-nano text-primary-500 font-bold">YOU</span>
                )}
              </p>
              <p className="text-micro text-muted tabular-nums">Best: {entry.longestStreak}d</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Flame className={`h-4 w-4 ${tone}`} strokeWidth={1.75} aria-hidden="true" />
              <span className={`font-mono tabular-nums text-base font-bold ${tone}`}>
                {entry.currentStreak}
                <span className="text-xs"> d</span>
              </span>
            </div>
          </div>
        );
      })}
    </StaggeredList>
  );
}
