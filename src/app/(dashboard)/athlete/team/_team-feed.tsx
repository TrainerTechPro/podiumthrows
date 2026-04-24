"use client";

/**
 * TeamFeed — client-side chronological feed view.
 *
 * Fetches /api/athlete/team-activity on mount and on visibility change
 * (so reopening the tab after a while gets fresh data). Paginated via
 * the cursor returned by the API — a "load more" button appears when
 * hasMore is true.
 *
 * Each row renders differently by type: PR, SESSION, STREAK_MILESTONE,
 * GOAL_COMPLETED, COACH_POST. Reactions (🔥 💪 💯) sit at the bottom of
 * every row with optimistic toggle behavior against the PATCH endpoint.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, MessageSquare, Target, Trophy, Dumbbell, Calendar } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

import { logger } from "@/lib/logger";
/* ─── Types ──────────────────────────────────────────────────────────────── */

type ReactionCounts = Record<string, number>;

type AthleteRef = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type TeamActivityItem = {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  athlete: AthleteRef | null;
  reactions: ReactionCounts;
  myReactions: string[];
};

type FeedResponse = {
  items: TeamActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

const REACTION_EMOJIS = [
  { key: "fire", label: "🔥" },
  { key: "lift", label: "💪" },
  { key: "hundred", label: "💯" },
] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function athleteName(a: AthleteRef | null): string {
  return a ? a.firstName : "Your coach";
}

function initialOf(a: AthleteRef | null): string {
  return a ? a.firstName.charAt(0) : "C";
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function TeamFeed() {
  const [items, setItems] = useState<TeamActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fetchInFlightRef = useRef<boolean>(false);

  const loadInitial = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setError(null);
    try {
      const res = await fetch("/api/athlete/team-activity", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success || !payload.data) {
        setError("Couldn't load the feed.");
        return;
      }
      const data = payload.data as FeedResponse;
      setItems(data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      logger.error("team feed load failed", { context: "athlete/team/team-feed", error: err });
      setError("Couldn't load the feed.");
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/athlete/team-activity?cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success || !payload.data) {
        setError("Couldn't load more — try scrolling again.");
        return;
      }
      const data = payload.data as FeedResponse;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      logger.error("team feed loadMore failed", { context: "athlete/team/team-feed", error: err });
      setError("Couldn't load more — try scrolling again.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    void loadInitial();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadInitial();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadInitial]);

  async function toggleReaction(activityId: string, emoji: string) {
    // Optimistic update first
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activityId) return item;
        const had = item.myReactions.includes(emoji);
        const nextMine = had
          ? item.myReactions.filter((e) => e !== emoji)
          : [...item.myReactions, emoji];
        const nextCount = {
          ...item.reactions,
          [emoji]: Math.max(0, (item.reactions[emoji] ?? 0) + (had ? -1 : 1)),
        };
        if (nextCount[emoji] === 0) delete nextCount[emoji];
        return { ...item, myReactions: nextMine, reactions: nextCount };
      })
    );

    try {
      const res = await fetch(`/api/athlete/team-activity/${activityId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) {
        throw new Error(`Reaction save failed (${res.status})`);
      }
    } catch (err) {
      logger.error("team reaction toggle failed", {
        context: "athlete/team/team-feed",
        error: err,
      });
      // Roll back the optimistic update for this one item rather than
      // triggering a full feed reload (previously could loop on a 403).
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== activityId) return item;
          const nowHas = item.myReactions.includes(emoji);
          const rolledMine = nowHas
            ? item.myReactions.filter((e) => e !== emoji)
            : [...item.myReactions, emoji];
          const rolledCount = {
            ...item.reactions,
            [emoji]: Math.max(0, (item.reactions[emoji] ?? 0) + (nowHas ? -1 : 1)),
          };
          if (rolledCount[emoji] === 0) delete rolledCount[emoji];
          return { ...item, myReactions: rolledMine, reactions: rolledCount };
        })
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-4">
            <div className="h-4 w-32 shimmer rounded mb-2" />
            <div className="h-3 w-48 shimmer rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Couldn&apos;t load the feed
        </p>
        <button type="button" onClick={loadInitial} className="btn btn-secondary text-xs mt-3">
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-[var(--foreground)]">No team activity yet</p>
        <p className="text-xs text-muted mt-1">
          Once your teammates start logging throws, their activity will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.2), duration: 0.22 }}
          >
            <FeedRow item={item} onReact={toggleReaction} />
          </motion.div>
        ))}
      </AnimatePresence>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="btn btn-secondary w-full text-xs"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────────── */

function FeedRow({
  item,
  onReact,
}: {
  item: TeamActivityItem;
  onReact: (activityId: string, emoji: string) => void;
}) {
  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar athlete={item.athlete} type={item.type} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted">
            <span className="font-semibold text-[var(--foreground)]">
              {athleteName(item.athlete)}
            </span>
            {" · "}
            {formatRelative(item.createdAt)}
          </p>
        </div>
      </div>

      {/* Body by type */}
      <TypedBody item={item} />

      {/* Reactions */}
      <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex items-center gap-1.5">
        {REACTION_EMOJIS.map((r) => {
          const count = item.reactions[r.key] ?? 0;
          const mine = item.myReactions.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onReact(item.id, r.key)}
              aria-pressed={mine}
              aria-label={`React with ${r.label}`}
              className={`h-8 px-2.5 rounded-full inline-flex items-center gap-1 text-sm transition-colors ${
                mine
                  ? "bg-primary-500/15 text-[var(--foreground)] border border-primary-500/40"
                  : "bg-surface-100 dark:bg-surface-800/60 text-muted hover:text-[var(--foreground)] border border-transparent"
              }`}
            >
              <span aria-hidden="true">{r.label}</span>
              {count > 0 && <span className="text-xs font-mono tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */

function Avatar({ athlete, type }: { athlete: AthleteRef | null; type: string }) {
  if (athlete?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={athlete.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
    );
  }

  // Coach posts get a distinct icon; athlete rows get an initial bubble
  if (type === "COACH_POST") {
    return (
      <div className="h-8 w-8 rounded-full bg-primary-500/15 flex items-center justify-center shrink-0">
        <MessageSquare className="h-4 w-4 text-primary-500" strokeWidth={2} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="h-8 w-8 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-[var(--foreground)] shrink-0">
      {initialOf(athlete)}
    </div>
  );
}

/* ─── Per-type body ──────────────────────────────────────────────────────── */

function TypedBody({ item }: { item: TeamActivityItem }) {
  const m = item.metadata;
  switch (item.type) {
    case "PR": {
      const event = typeof m.event === "string" ? m.event : "Throw";
      const weight = typeof m.implementWeight === "number" ? m.implementWeight : null;
      const distance = typeof m.distance === "number" ? m.distance : null;
      const prev = typeof m.previousDistance === "number" ? m.previousDistance : null;
      const delta = distance != null && prev != null ? distance - prev : null;
      return (
        <div className="flex items-start gap-2.5">
          <Trophy
            className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm text-[var(--foreground)]">
              hit a new PR:{" "}
              <span className="font-bold font-mono tabular-nums">
                {distance?.toFixed(2) ?? "—"}m
              </span>{" "}
              {formatEventName(event)}
              {weight != null && (
                <span className="text-muted">
                  {" "}
                  <span className="font-mono tabular-nums">{weight}kg</span>
                </span>
              )}
              {" 🔥"}
            </p>
            {delta != null && delta > 0 && (
              <p className="text-[11px] text-emerald-500 font-mono tabular-nums mt-0.5">
                +{delta.toFixed(2)}m from previous best
              </p>
            )}
          </div>
        </div>
      );
    }
    case "SESSION": {
      const throwCount = typeof m.throwCount === "number" ? m.throwCount : null;
      return (
        <div className="flex items-start gap-2.5">
          <Dumbbell
            className="h-4 w-4 text-primary-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--foreground)]">
            completed a training session
            {throwCount != null && throwCount > 0 && (
              <>
                {" ("}
                <span className="font-mono tabular-nums">{throwCount}</span>
                {" throws)"}
              </>
            )}
          </p>
        </div>
      );
    }
    case "STREAK_MILESTONE": {
      const days = typeof m.days === "number" ? m.days : null;
      return (
        <div className="flex items-start gap-2.5">
          <Flame
            className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--foreground)]">
            is on a{" "}
            <span className="font-bold">
              <span className="font-mono tabular-nums">{days}</span>-day
            </span>{" "}
            streak 🔥
          </p>
        </div>
      );
    }
    case "GOAL_COMPLETED": {
      const target = typeof m.targetValue === "number" ? m.targetValue : null;
      const unit = typeof m.unit === "string" ? m.unit : "";
      return (
        <div className="flex items-start gap-2.5">
          <Target
            className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--foreground)]">
            hit their weekly goal:{" "}
            <span className="font-bold">
              <span className="font-mono tabular-nums">
                {target}/{target}
              </span>{" "}
              {unit}
            </span>{" "}
            ✅
          </p>
        </div>
      );
    }
    case "COACH_POST": {
      const body = typeof m.body === "string" ? m.body : "";
      return (
        <div className="flex items-start gap-2.5">
          <Calendar
            className="h-4 w-4 text-primary-500 mt-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{body}</p>
        </div>
      );
    }
    default:
      return null;
  }
}
