"use client";

import { useEffect, useState, useCallback } from "react";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { EmptyState } from "@/components/ui/EmptyState";

const EVENTS: { key: string; label: string }[] = [
  { key: "SHOT_PUT", label: "Shot Put" },
  { key: "DISCUS", label: "Discus" },
  { key: "HAMMER", label: "Hammer" },
  { key: "JAVELIN", label: "Javelin" },
];

type LeaderboardEntry = {
  rank: number;
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  event: string;
  implement: string;
  distance: number;
  achievedAt: string;
  isViewer: boolean;
};

function rankBadge(rank: number): {
  icon: React.ReactNode;
  bg: string;
  ring: string;
} | null {
  if (rank === 1) {
    return {
      icon: (
        <Trophy
          className="h-3.5 w-3.5 text-amber-500"
          strokeWidth={1.75}
          aria-label="First place"
        />
      ),
      bg: "bg-amber-500/15",
      ring: "ring-amber-500/40",
    };
  }
  if (rank === 2) {
    return {
      icon: (
        <Medal
          className="h-3.5 w-3.5 text-slate-300"
          strokeWidth={1.75}
          aria-label="Second place"
        />
      ),
      bg: "bg-slate-300/15",
      ring: "ring-slate-300/30",
    };
  }
  if (rank === 3) {
    return {
      icon: (
        <Award
          className="h-3.5 w-3.5 text-orange-400"
          strokeWidth={1.75}
          aria-label="Third place"
        />
      ),
      bg: "bg-orange-400/15",
      ring: "ring-orange-400/30",
    };
  }
  return null;
}

function Initial({ first, last }: { first: string; last: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-sm font-bold text-[var(--foreground)] shrink-0">
      {first.charAt(0)}
      {last.charAt(0)}
    </div>
  );
}

function Avatar({ entry }: { entry: LeaderboardEntry }) {
  if (entry.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={entry.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
    );
  }
  return <Initial first={entry.firstName} last={entry.lastName} />;
}

export function TeamLeaderboard() {
  const [event, setEvent] = useState<string>(EVENTS[0].key);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selected: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/athlete/team/leaderboard?event=${encodeURIComponent(selected)}&limit=10`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        setError(payload.error || "Couldn't load leaderboard.");
        setEntries([]);
        return;
      }
      setEntries((payload.data?.entries ?? []) as LeaderboardEntry[]);
    } catch (err) {
      logger.error("leaderboard load failed", {
        context: "athlete/team/leaderboard",
        error: err,
      });
      setError("Network error — try again.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(event);
  }, [event, load]);

  useEffect(() => {
    const onPullRefresh = () => void load(event);
    window.addEventListener("podium:pull-to-refresh", onPullRefresh);
    return () => window.removeEventListener("podium:pull-to-refresh", onPullRefresh);
  }, [event, load]);

  return (
    <div className="space-y-4">
      {/* Event picker */}
      <div
        role="tablist"
        aria-label="Filter leaderboard by event"
        className="flex items-center gap-1.5 flex-wrap"
      >
        {EVENTS.map((e) => {
          const active = event === e.key;
          return (
            <button
              key={e.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setEvent(e.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-primary-500 text-surface-950"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-sm text-muted">
          <Loader2 className="animate-spin mr-2" size={16} aria-hidden="true" />
          Loading leaderboard…
        </div>
      ) : error ? (
        <EmptyState
          tone="error"
          title="Couldn't load the leaderboard"
          description={error}
          onRetry={() => void load(event)}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Trophy size={48} strokeWidth={1.75} aria-hidden="true" />}
          title="No PRs in this event yet"
          description="Be first — log a PR and you'll lead the board."
        />
      ) : (
        <>
          {/* Top 3 — featured cards */}
          <StaggeredList className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {entries.slice(0, 3).map((entry) => {
              const badge = rankBadge(entry.rank);
              return (
                <div
                  key={entry.athleteId}
                  className={`card p-4 text-center ${entry.isViewer ? "ring-1 ring-primary-500/50" : ""}`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    {badge?.icon}
                    <span className="text-xs font-semibold text-muted tabular-nums">
                      #{entry.rank}
                    </span>
                  </div>
                  <div className="flex justify-center mb-2">
                    <Avatar entry={entry} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {entry.firstName} {entry.lastName.charAt(0)}.
                    {entry.isViewer && (
                      <span className="ml-1 text-[10px] text-primary-500 font-bold">YOU</span>
                    )}
                  </p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-amber-500 mt-1">
                    {entry.distance.toFixed(2)}
                    <span className="text-sm">m</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">{entry.implement}</p>
                </div>
              );
            })}
          </StaggeredList>

          {/* Rest — compact list */}
          {entries.length > 3 && (
            <ul className="space-y-1.5">
              {entries.slice(3).map((entry) => (
                <li
                  key={entry.athleteId}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] ${
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
                        <span className="ml-1 text-[10px] text-primary-500 font-bold">YOU</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted">{entry.implement}</p>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-bold text-[var(--foreground)]">
                    {entry.distance.toFixed(2)}
                    <span className="text-xs text-muted">m</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
