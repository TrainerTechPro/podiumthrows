"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Trophy,
  AlertTriangle,
  ClipboardList,
  Dumbbell,
  UserPlus,
  RefreshCw,
  MessageCircle,
  Video,
  CalendarClock,
  Clock,
  Flame,
  Settings2,
  Check,
  Trash2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Badge, EmptyState } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { getNotificationHref, type NotificationCategory } from "@/lib/notifications/deep-links";
import type { NotificationItem } from "@/lib/notifications";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ICON_PROPS = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };

function NotificationIcon({ type }: { type: string }) {
  const base = "w-9 h-9 rounded-full flex items-center justify-center shrink-0";
  switch (type) {
    case "PR_ALERT":
    case "COMPETITION_PR":
      return (
        <div
          className={`${base} bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400`}
        >
          <Trophy {...ICON_PROPS} />
        </div>
      );
    case "LOW_READINESS":
      return (
        <div
          className={`${base} bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400`}
        >
          <AlertTriangle {...ICON_PROPS} />
        </div>
      );
    case "QUESTIONNAIRE_ASSIGNED":
    case "QUESTIONNAIRE_COMPLETE":
      return (
        <div className={`${base} bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400`}>
          <ClipboardList {...ICON_PROPS} />
        </div>
      );
    case "WORKOUT_ASSIGNED":
    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <Dumbbell {...ICON_PROPS} />
        </div>
      );
    case "ATHLETE_JOINED":
    case "PROGRAMMING_REQUESTED":
      return (
        <div
          className={`${base} bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400`}
        >
          <UserPlus {...ICON_PROPS} />
        </div>
      );
    case "PROGRAM_CHECKPOINT":
    case "COMPLEX_ROTATED":
    case "INSIGHT_NEW":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <RefreshCw {...ICON_PROPS} />
        </div>
      );
    case "COMMENT_ADDED":
      return (
        <div className={`${base} bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400`}>
          <MessageCircle {...ICON_PROPS} />
        </div>
      );
    case "VIDEO_SHARED":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <Video {...ICON_PROPS} />
        </div>
      );
    case "COMPETITION_REMINDER":
    case "COMPETITION_LOGGED":
      return (
        <div
          className={`${base} bg-warning-50 dark:bg-warning-500/15 text-warning-600 dark:text-warning-400`}
        >
          <CalendarClock {...ICON_PROPS} />
        </div>
      );
    case "INVITATION_EXPIRED":
      return (
        <div className={`${base} bg-surface-100 dark:bg-surface-800 text-surface-500`}>
          <Clock {...ICON_PROPS} />
        </div>
      );
    case "STREAK_BROKEN":
    case "STREAK_EXTENDED":
      return (
        <div
          className={`${base} bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400`}
        >
          <Flame {...ICON_PROPS} />
        </div>
      );
    default:
      return (
        <div className={`${base} bg-surface-100 dark:bg-surface-800 text-surface-500`}>
          <Settings2 {...ICON_PROPS} />
        </div>
      );
  }
}

const TYPE_BADGE: Record<
  string,
  "success" | "danger" | "info" | "neutral" | "warning" | "primary"
> = {
  PR_ALERT: "success",
  COMPETITION_PR: "success",
  LOW_READINESS: "danger",
  QUESTIONNAIRE_COMPLETE: "info",
  QUESTIONNAIRE_ASSIGNED: "info",
  STREAK_BROKEN: "danger",
  STREAK_EXTENDED: "success",
  WORKOUT_ASSIGNED: "primary",
  WORKOUT_COMPLETED: "success",
  WORKOUT_SKIPPED: "warning",
  ATHLETE_JOINED: "success",
  PROGRAM_CHECKPOINT: "primary",
  COMPLEX_ROTATED: "primary",
  COMMENT_ADDED: "info",
  VIDEO_SHARED: "primary",
  COMPETITION_REMINDER: "warning",
  COMPETITION_LOGGED: "warning",
  INVITATION_EXPIRED: "neutral",
  PROGRAMMING_REQUESTED: "primary",
  INSIGHT_NEW: "primary",
};

function typeBadge(
  type: string
): "success" | "danger" | "info" | "neutral" | "warning" | "primary" {
  return TYPE_BADGE[type] ?? "neutral";
}

const TYPE_LABEL: Record<string, string> = {
  PR_ALERT: "Personal Best",
  COMPETITION_PR: "Competition PR",
  COMPETITION_LOGGED: "Competition",
  COMPETITION_REMINDER: "Upcoming",
  LOW_READINESS: "Low Readiness",
  QUESTIONNAIRE_ASSIGNED: "Questionnaire",
  QUESTIONNAIRE_COMPLETE: "Questionnaire",
  STREAK_BROKEN: "Streak",
  STREAK_EXTENDED: "Streak",
  WORKOUT_ASSIGNED: "Workout",
  WORKOUT_COMPLETED: "Workout",
  WORKOUT_SKIPPED: "Workout",
  ATHLETE_JOINED: "Roster",
  PROGRAMMING_REQUESTED: "Request",
  PROGRAM_CHECKPOINT: "Program",
  COMPLEX_ROTATED: "Program",
  COMMENT_ADDED: "Feedback",
  VIDEO_SHARED: "Video",
  INVITATION_EXPIRED: "Invite",
  INSIGHT_NEW: "Insight",
};

/* ─── Swipe-row primitive ────────────────────────────────────────────────── */

const SWIPE_THRESHOLD_PX = 56; // half of the action drawer
const SWIPE_MAX_PX = 144;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest("a, button, input, textarea, select, [role='button']");
}

function NotificationCard({
  notification: n,
  role,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationItem;
  role: "COACH" | "ATHLETE";
  onMarkRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const href = getNotificationHref(n, role);
  const [offsetX, setOffsetX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef<number | null>(null);
  const tracking = useRef(false);
  const touchOnInteractive = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    touchOnInteractive.current = isInteractiveTarget(e.target);
    startX.current = e.touches[0].clientX;
    tracking.current = true;
    setAnimating(false);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!tracking.current || startX.current === null) return;
      const delta = e.touches[0].clientX - startX.current;
      // Only track left swipes (negative delta). Don't fight scrolls
      // started on a button/link inside the row.
      if (touchOnInteractive.current) return;
      if (delta < 0) {
        const clamped = Math.max(delta, -SWIPE_MAX_PX);
        setOffsetX(clamped);
      } else if (offsetX < 0) {
        // Allow swipe-back to close.
        setOffsetX(Math.min(0, offsetX + delta));
      }
    },
    [offsetX]
  );

  const onTouchEnd = useCallback(() => {
    if (!tracking.current) return;
    tracking.current = false;
    setAnimating(true);
    if (offsetX <= -SWIPE_THRESHOLD_PX) {
      setOffsetX(-SWIPE_MAX_PX);
    } else {
      setOffsetX(0);
    }
  }, [offsetX]);

  function closeSwipe() {
    setAnimating(true);
    setOffsetX(0);
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Behind-row action drawer (swipe-left reveals these) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch" aria-hidden={offsetX === 0}>
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            if (!n.read) onMarkRead(n.id, true);
            else onMarkRead(n.id, false);
          }}
          className="w-[72px] flex flex-col items-center justify-center gap-0.5 bg-info-500 text-white text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-info-500/50"
          tabIndex={offsetX < 0 ? 0 : -1}
        >
          <Check size={16} strokeWidth={2.25} aria-hidden="true" />
          {n.read ? "Unread" : "Read"}
        </button>
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            onDelete(n.id);
          }}
          className="w-[72px] flex flex-col items-center justify-center gap-0.5 bg-danger-500 text-white text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-danger-500/50"
          tabIndex={offsetX < 0 ? 0 : -1}
        >
          <Trash2 size={16} strokeWidth={2.25} aria-hidden="true" />
          Delete
        </button>
      </div>

      {/* Foreground row */}
      <div
        className={`group relative flex items-start gap-3 p-4 border ${
          !n.read
            ? "border-amber-400/20 bg-amber-50/50 dark:bg-amber-500/5"
            : "border-surface-200 dark:border-surface-800 bg-[var(--card-bg)]"
        } rounded-xl ${animating ? "transition-transform duration-200 ease-out" : ""}`}
        style={{ transform: `translateX(${offsetX}px)` }}
      >
        <NotificationIcon type={n.type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={href}
              onClick={() => {
                if (!n.read) onMarkRead(n.id, true);
              }}
              className="text-sm font-semibold leading-snug text-[var(--foreground)] hover:underline underline-offset-2 decoration-1 truncate flex-1 min-w-0"
            >
              {n.title}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {!n.read && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                  role="status"
                  aria-label="Unread"
                />
              )}
              <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
                {relativeTime(n.createdAt)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>

          <div className="flex items-center gap-2 mt-2">
            <Badge variant={typeBadge(n.type)}>{TYPE_LABEL[n.type] ?? "Notification"}</Badge>
            <Link
              href={href}
              onClick={() => {
                if (!n.read) onMarkRead(n.id, true);
              }}
              className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
            >
              View details →
            </Link>
            {/* Desktop hover overflow */}
            <DesktopOverflowMenu
              isRead={n.read}
              onToggleRead={() => onMarkRead(n.id, !n.read)}
              onDelete={() => onDelete(n.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopOverflowMenu({
  isRead,
  onToggleRead,
  onDelete,
}: {
  isRead: boolean;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 rounded-md p-1.5 text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-[var(--surface-overlay)] border border-[var(--card-border)] shadow-lg py-1 z-30"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onToggleRead();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <Check size={14} strokeWidth={1.75} aria-hidden="true" />
            Mark {isRead ? "unread" : "read"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Filter chips ───────────────────────────────────────────────────────── */

const CATEGORY_CHIPS: { key: NotificationCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "feedback", label: "Feedback" },
  { key: "prs", label: "PRs" },
  { key: "team", label: "Team" },
  { key: "system", label: "System" },
];

function emptyCopy(
  category: NotificationCategory,
  role: "COACH" | "ATHLETE"
): {
  title: string;
  description: string;
} {
  if (category === "all") {
    return {
      title: "No notifications yet",
      description:
        role === "COACH"
          ? "PR alerts, readiness flags, completed sessions, and program checkpoints will appear here."
          : "Coach feedback, assigned questionnaires, videos, and competition reminders will appear here.",
    };
  }
  if (category === "feedback") {
    return {
      title: "No feedback yet",
      description:
        role === "ATHLETE"
          ? "Your coach will post here when they review a session."
          : "Athlete responses to your feedback will appear here.",
    };
  }
  if (category === "prs") {
    return {
      title: "No PRs yet",
      description:
        role === "ATHLETE"
          ? "Hit a personal best in training or competition and we'll celebrate it here."
          : "When your athletes hit personal bests, you'll see them here.",
    };
  }
  if (category === "team") {
    return {
      title: "Quiet team feed",
      description:
        role === "COACH"
          ? "Roster joins, programming requests, and readiness flags land here."
          : "Workout assignments, streaks, and competition reminders land here.",
    };
  }
  return {
    title: "Nothing in System",
    description: "Questionnaires, videos, and engine updates land here.",
  };
}

/* ─── Main client component ──────────────────────────────────────────────── */

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialNextCursor: string | null;
  initialUnreadCount: number;
  role: "COACH" | "ATHLETE";
}

type FetchPayload = {
  notifications: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export function NotificationsClient({
  initialNotifications,
  initialNextCursor,
  initialUnreadCount,
  role,
}: NotificationsClientProps) {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [category, setCategory] = useState<NotificationCategory>("all");
  const [serverUnread, setServerUnread] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visibleUnread = useMemo(() => {
    // Optimistic local count: server unread + (any locally-flipped reads we
    // haven't reconciled). Simpler/safer to recompute from items when the
    // user is in "all" view; for filtered views fall back to server count.
    if (category !== "all") return serverUnread;
    return items.filter((n) => !n.read).length;
  }, [items, serverUnread, category]);

  const fetchPage = useCallback(
    async (opts: { reset: boolean; cursor: string | null }): Promise<FetchPayload | null> => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("category", category);
      if (opts.cursor) params.set("cursor", opts.cursor);
      try {
        const res = await fetch(`/api/notifications?${params.toString()}`);
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          toast.error(payload.error || `Couldn't load notifications (${res.status})`);
          return null;
        }
        return payload.data as FetchPayload;
      } catch (err) {
        logger.error("notifications fetchPage failed", {
          context: "notifications/client",
          error: err,
        });
        toast.error("Network error — try again");
        return null;
      }
    },
    [category, toast]
  );

  // Reload when category changes (skip the initial mount — server provided the all-list).
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    let cancelled = false;
    setReloading(true);
    fetchPage({ reset: true, cursor: null }).then((data) => {
      if (cancelled) return;
      if (data) {
        setItems(data.notifications);
        setCursor(data.nextCursor);
        setServerUnread(data.unreadCount);
      }
      setReloading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [category, fetchPage]);

  // Listen for the athlete-shell pull-to-refresh signal — resets the
  // cursor and refetches the first page in the current category. Coach
  // pages never dispatch this, so this is effectively athlete-only.
  useEffect(() => {
    function onPullRefresh() {
      setReloading(true);
      fetchPage({ reset: true, cursor: null }).then((data) => {
        if (data) {
          setItems(data.notifications);
          setCursor(data.nextCursor);
          setServerUnread(data.unreadCount);
        }
        setReloading(false);
      });
    }
    window.addEventListener("podium:pull-to-refresh", onPullRefresh);
    return () => window.removeEventListener("podium:pull-to-refresh", onPullRefresh);
  }, [fetchPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && cursor) {
          loadMore();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  async function loadMore() {
    if (loading || !cursor) return;
    setLoading(true);
    const data = await fetchPage({ reset: false, cursor });
    if (data) {
      setItems((prev) => [...prev, ...data.notifications]);
      setCursor(data.nextCursor);
      setServerUnread(data.unreadCount);
    }
    setLoading(false);
  }

  async function markRead(id: string, read: boolean) {
    const prev = items;
    setItems((curr) => curr.map((n) => (n.id === id ? { ...n, read } : n)));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ read }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        setItems(prev);
        toast.error(payload.error || "Couldn't update — try again");
        return;
      }
      // Sync server unread count for filtered views.
      if (category !== "all") {
        setServerUnread((c) => Math.max(0, c + (read ? -1 : 1)));
      }
    } catch (err) {
      logger.error("markRead failed", { context: "notifications/client", error: err });
      setItems(prev);
      toast.error("Network error — try again");
    }
  }

  async function deleteOne(id: string) {
    const prev = items;
    const target = items.find((n) => n.id === id);
    setItems((curr) => curr.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        setItems(prev);
        toast.error(payload.error || "Couldn't delete — try again");
        return;
      }
      toast.success("Notification deleted");
      if (target && !target.read && category !== "all") {
        setServerUnread((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      logger.error("delete notification failed", {
        context: "notifications/client",
        error: err,
      });
      setItems(prev);
      toast.error("Network error — try again");
    }
  }

  async function markAllRead() {
    if (markingAll) return;
    const prev = items;
    const prevUnread = serverUnread;
    setMarkingAll(true);
    setItems((curr) => curr.map((n) => ({ ...n, read: true })));
    setServerUnread(0);
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: csrfHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        setItems(prev);
        setServerUnread(prevUnread);
        toast.error(payload.error || "Couldn't mark all read — try again");
        return;
      }
      toast.success("All caught up");
    } catch (err) {
      logger.error("markAllRead failed", { context: "notifications/client", error: err });
      setItems(prev);
      setServerUnread(prevUnread);
      toast.error("Network error — try again");
    } finally {
      setMarkingAll(false);
    }
  }

  const empty = emptyCopy(category, role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Notifications
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {visibleUnread > 0
              ? `${visibleUnread} unread${category !== "all" ? " in this view" : ""}`
              : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={markingAll || visibleUnread === 0}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-500/15 hover:bg-primary-200 dark:hover:bg-primary-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <Check size={12} strokeWidth={2.25} aria-hidden="true" />
          {markingAll ? "Marking…" : "Mark all read"}
        </button>
      </div>

      {/* Filter chips */}
      <div
        role="tablist"
        aria-label="Filter notifications"
        className="flex items-center gap-1.5 flex-wrap"
      >
        {CATEGORY_CHIPS.map(({ key, label }) => {
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-primary-500 text-surface-950"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {reloading ? (
        <div className="py-16 flex items-center justify-center text-sm text-muted">
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin mr-2" aria-hidden="true" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} strokeWidth={1.5} />}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                role={role}
                onMarkRead={markRead}
                onDelete={deleteOne}
              />
            ))}
          </div>

          {/* Infinite-scroll sentinel + Load more fallback */}
          {cursor && (
            <div ref={sentinelRef} className="flex items-center justify-center pt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={12}
                      strokeWidth={2}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
