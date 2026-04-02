"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trophy, AlertTriangle, ClipboardList, Dumbbell, UserPlus, RefreshCw, MessageCircle, Video, CalendarClock, Clock, Flame, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import type { NotificationItem } from "@/lib/notifications";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const POLL_INTERVAL = 30_000; // 30 seconds
const DROPDOWN_LIMIT = 8;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

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

function notificationIcon(type: string) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center shrink-0";
  const iconProps = { size: 15, strokeWidth: 1.75, "aria-hidden": true as const };

  switch (type) {
    case "PR_ALERT":
      return <span className={cn(base, "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400")}><Trophy {...iconProps} /></span>;
    case "LOW_READINESS":
      return <span className={cn(base, "bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400")}><AlertTriangle {...iconProps} /></span>;
    case "QUESTIONNAIRE_ASSIGNED":
    case "QUESTIONNAIRE_COMPLETE":
      return <span className={cn(base, "bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400")}><ClipboardList {...iconProps} /></span>;
    case "WORKOUT_ASSIGNED":
    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED":
      return <span className={cn(base, "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400")}><Dumbbell {...iconProps} /></span>;
    case "ATHLETE_JOINED":
      return <span className={cn(base, "bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400")}><UserPlus {...iconProps} /></span>;
    case "PROGRAM_CHECKPOINT":
    case "COMPLEX_ROTATED":
      return <span className={cn(base, "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400")}><RefreshCw {...iconProps} /></span>;
    case "COMMENT_ADDED":
      return <span className={cn(base, "bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400")}><MessageCircle {...iconProps} /></span>;
    case "VIDEO_SHARED":
      return <span className={cn(base, "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400")}><Video {...iconProps} /></span>;
    case "COMPETITION_REMINDER":
      return <span className={cn(base, "bg-warning-50 dark:bg-warning-500/15 text-warning-600 dark:text-warning-400")}><CalendarClock {...iconProps} /></span>;
    case "INVITATION_EXPIRED":
      return <span className={cn(base, "bg-surface-100 dark:bg-surface-800 text-surface-500")}><Clock {...iconProps} /></span>;
    case "STREAK_BROKEN":
      return <span className={cn(base, "bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400")}><Flame {...iconProps} /></span>;
    default:
      return <span className={cn(base, "bg-surface-100 dark:bg-surface-800 text-surface-500")}><Settings2 {...iconProps} /></span>;
  }
}

function getNotificationUrl(n: NotificationItem, role: "COACH" | "ATHLETE"): string | null {
  const meta = n.metadata as Record<string, unknown> | null;
  if (meta?.url && typeof meta.url === "string") return meta.url;

  const prefix = role === "COACH" ? "/coach" : "/athlete";

  switch (n.type) {
    case "PR_ALERT":
    case "LOW_READINESS":
    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED":
    case "STREAK_BROKEN":
      return n.athleteId ? `${prefix === "/coach" ? "/coach" : "/athlete"}/athletes/${n.athleteId}` : null;
    case "WORKOUT_ASSIGNED":
      return `${prefix}/sessions`;
    case "QUESTIONNAIRE_ASSIGNED":
    case "QUESTIONNAIRE_COMPLETE":
      return `${prefix}/questionnaires`;
    case "ATHLETE_JOINED":
      return "/coach/athletes";
    case "VIDEO_SHARED":
      return `${prefix}/videos`;
    case "COMPETITION_REMINDER":
      return `${prefix}/dashboard`;
    case "INVITATION_EXPIRED":
      return "/coach/invitations";
    case "COMMENT_ADDED":
      return resolveCommentUrl(n, meta, role);
    default:
      return `${prefix}/notifications`;
  }
}

function resolveCommentUrl(
  n: NotificationItem,
  meta: Record<string, unknown> | null,
  role: "COACH" | "ATHLETE"
): string | null {
  const targetField = meta?.targetField as string | undefined;
  const targetId = meta?.targetId as string | undefined;
  const athleteId = n.athleteId || (meta?.athleteId as string | undefined);

  if (role === "COACH") {
    switch (targetField) {
      case "throwsAssignmentId":
        return athleteId && targetId
          ? `/coach/athletes/${athleteId}/sessions/${targetId}`
          : "/coach/athletes";
      case "practiceAttemptId": {
        const sessionId = meta?.practiceSessionId as string | undefined;
        return sessionId
          ? `/coach/throws/practice/${sessionId}`
          : "/coach/throws/practice";
      }
      case "trainingSessionId":
        return "/coach/sessions";
      case "throwLogId":
        return athleteId ? `/coach/athletes/${athleteId}` : "/coach/athletes";
      default:
        return "/coach/notifications";
    }
  }

  // Athlete
  switch (targetField) {
    case "trainingSessionId":
      return targetId ? `/athlete/sessions/${targetId}` : "/athlete/sessions";
    default:
      return "/athlete/throws";
  }
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface NotificationBellProps {
  initialCount?: number;
  role: "COACH" | "ATHLETE";
}

export function NotificationBell({ initialCount = 0, role }: NotificationBellProps) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Poll unread count
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch("/api/notifications/count");
        if (res.ok && mounted) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // Silent
      }
    }
    const id = setInterval(poll, POLL_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${DROPDOWN_LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) fetchNotifications();
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setCount((c) => Math.max(0, c - 1));
    } catch {
      // Silent
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setCount(0);
    } catch {
      // Silent
    }
  }

  function handleClickNotification(n: NotificationItem) {
    if (!n.read) handleMarkRead(n.id);
    const url = getNotificationUrl(n, role);
    if (url) {
      setOpen(false);
      router.push(url);
    }
  }

  const notificationsUrl = role === "COACH" ? "/coach/notifications" : "/athlete/notifications";

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger-500 text-white text-[10px] font-bold tabular-nums px-1 animate-spring-up">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] sm:w-[400px] max-h-[480px] rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl z-50 flex flex-col overflow-hidden max-sm:fixed max-sm:inset-x-3 max-sm:right-3 max-sm:w-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Notifications</h3>
            {count > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <CheckCheck size={13} strokeWidth={1.75} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-3/4" />
                      <div className="h-2.5 bg-surface-200 dark:bg-surface-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell size={28} strokeWidth={1.5} className="mx-auto text-surface-400 dark:text-surface-600 mb-2" aria-hidden="true" />
                <p className="text-sm text-muted">All caught up</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickNotification(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50",
                      !n.read && "bg-amber-50/40 dark:bg-amber-500/5"
                    )}
                  >
                    {notificationIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-[13px] leading-snug truncate",
                          !n.read ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--foreground)]/80"
                        )}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--card-border)] px-4 py-2.5">
            <button
              type="button"
              onClick={() => { setOpen(false); router.push(notificationsUrl); }}
              className="w-full text-center text-xs font-medium text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
