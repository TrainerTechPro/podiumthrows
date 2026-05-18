"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import type { NotificationItem } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCircle, SkeletonLine } from "@/components/ui/Skeleton";

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
  const base = "w-11 h-11 rounded-full flex items-center justify-center shrink-0";
  const iconProps = { size: 15, strokeWidth: 1.75, "aria-hidden": true as const };

  switch (type) {
    case "PR_ALERT":
      return (
        <span
          className={cn(
            base,
            "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
          )}
        >
          <Trophy {...iconProps} />
        </span>
      );
    case "LOW_READINESS":
      return (
        <span
          className={cn(
            base,
            "bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400"
          )}
        >
          <AlertTriangle {...iconProps} />
        </span>
      );
    case "QUESTIONNAIRE_ASSIGNED":
    case "QUESTIONNAIRE_COMPLETE":
      return (
        <span
          className={cn(base, "bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400")}
        >
          <ClipboardList {...iconProps} />
        </span>
      );
    case "WORKOUT_ASSIGNED":
    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED":
      return (
        <span
          className={cn(
            base,
            "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
          )}
        >
          <Dumbbell {...iconProps} />
        </span>
      );
    case "ATHLETE_JOINED":
      return (
        <span
          className={cn(
            base,
            "bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400"
          )}
        >
          <UserPlus {...iconProps} />
        </span>
      );
    case "PROGRAM_CHECKPOINT":
    case "COMPLEX_ROTATED":
      return (
        <span
          className={cn(
            base,
            "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
          )}
        >
          <RefreshCw {...iconProps} />
        </span>
      );
    case "COMMENT_ADDED":
      return (
        <span
          className={cn(base, "bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400")}
        >
          <MessageCircle {...iconProps} />
        </span>
      );
    case "VIDEO_SHARED":
      return (
        <span
          className={cn(
            base,
            "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
          )}
        >
          <Video {...iconProps} />
        </span>
      );
    case "COMPETITION_REMINDER":
      return (
        <span
          className={cn(
            base,
            "bg-warning-50 dark:bg-warning-500/15 text-warning-600 dark:text-warning-400"
          )}
        >
          <CalendarClock {...iconProps} />
        </span>
      );
    case "INVITATION_EXPIRED":
      return (
        <span className={cn(base, "bg-surface-100 dark:bg-surface-800 text-surface-500")}>
          <Clock {...iconProps} />
        </span>
      );
    case "STREAK_BROKEN":
      return (
        <span
          className={cn(
            base,
            "bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400"
          )}
        >
          <Flame {...iconProps} />
        </span>
      );
    default:
      return (
        <span className={cn(base, "bg-surface-100 dark:bg-surface-800 text-surface-500")}>
          <Settings2 {...iconProps} />
        </span>
      );
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
      return n.athleteProfileId
        ? `${prefix === "/coach" ? "/coach" : "/athlete"}/athletes/${n.athleteProfileId}`
        : null;
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
  const athleteId = n.athleteProfileId || (meta?.athleteId as string | undefined);

  if (role === "COACH") {
    switch (targetField) {
      case "throwsAssignmentId":
        return athleteId && targetId
          ? `/coach/throws/${targetId}?athlete=${athleteId}`
          : "/coach/athletes";
      case "practiceAttemptId": {
        const sessionId = meta?.practiceSessionId as string | undefined;
        return sessionId ? `/coach/throws/practice/${sessionId}` : "/coach/throws/practice";
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
      return targetId ? `/athlete/session/${targetId}` : "/athlete/sessions";
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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Drive mount/visible phases for slide-in animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reducedMotion.current) {
        setVisible(true);
        return;
      }
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    if (reducedMotion.current) {
      setMounted(false);
      return;
    }
    const t = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(t);
  }, [open]);

  // Poll unread count
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch("/api/notifications/count");
        if (res.ok && mounted) {
          const data = await res.json();
          setCount(data.data?.count ?? 0);
        }
      } catch (err) {
        // Silent
        logger.debug("Silent", {
          context: "src/components/ui/NotificationBell.tsx",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
      }
    }
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Close on outside tap/click.
  //
  // Uses pointerdown (unified mouse + touch + pen) and delays listener
  // registration by one animation frame. Without the delay, iOS Safari's
  // synthesized pointer events from the tap that OPENED the panel can
  // fire after the useEffect registers the listener, which then sees a
  // "rogue" pointerdown with an ambiguous target and closes the panel
  // before the user can see it. The tell was: red dot disappears
  // (fetchNotifications did run) but nothing visibly opens.
  useEffect(() => {
    if (!open) return;
    function onDown(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    const rafId = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onDown);
    });
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Fetch notifications when dropdown opens.
  //
  // Response envelope is `{ success: true, data: { notifications, unreadCount, nextCursor } }`
  // — read from `payload.data`, not the top level. Earlier code read
  // `data.notifications` (undefined), which silently emptied the dropdown
  // and clobbered the badge to 0. Surfacing failures via `loadError` keeps
  // the dropdown honest instead of falsely claiming "All caught up".
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/notifications?limit=${DROPDOWN_LIMIT}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        const message = payload?.error || `Couldn't load notifications (${res.status})`;
        setLoadError(message);
        return;
      }
      const list: NotificationItem[] = payload.data?.notifications ?? [];
      const unread: number = payload.data?.unreadCount ?? 0;
      setNotifications(list);
      setCount(unread);
    } catch (err) {
      logger.error("notification dropdown fetch failed", {
        context: "src/components/ui/NotificationBell.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
      setLoadError("Network error — try again");
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
    // Optimistic flip + rollback on failure. Surfacing the error keeps the
    // badge honest — silent failures used to leave the count one short of
    // reality until the next 30s poll reconciled.
    const prevNotifications = notifications;
    const prevCount = count;
    setNotifications(prevNotifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setCount(Math.max(0, prevCount - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ read: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        setNotifications(prevNotifications);
        setCount(prevCount);
        toast.error(payload?.error || "Couldn't mark read — try again");
      }
    } catch (err) {
      setNotifications(prevNotifications);
      setCount(prevCount);
      logger.error("notification mark-read failed", {
        context: "src/components/ui/NotificationBell.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
      toast.error("Network error — try again");
    }
  }

  async function handleMarkAllRead() {
    // The dedicated endpoint is POST /api/notifications/mark-all-read.
    // The previous PATCH /api/notifications hit a route with no PATCH
    // handler — Next.js returned 405, the catch was empty, and the badge
    // visibly reset (optimistic) but the DB never changed; the next poll
    // restored the count and the user thought the button was broken.
    const prevNotifications = notifications;
    const prevCount = count;
    setNotifications(prevNotifications.map((n) => ({ ...n, read: true })));
    setCount(0);
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: csrfHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        setNotifications(prevNotifications);
        setCount(prevCount);
        toast.error(payload?.error || "Couldn't mark all read — try again");
      }
    } catch (err) {
      setNotifications(prevNotifications);
      setCount(prevCount);
      logger.error("notification mark-all-read failed", {
        context: "src/components/ui/NotificationBell.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
      toast.error("Network error — try again");
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
        className="relative p-3 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger-500 text-white text-nano font-bold tabular-nums px-1 animate-spring-up">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel.
          Desktop: absolute, anchored under the bell button (top-full + mt-1.5).
          Mobile (max-sm): fixed to the viewport, docked just below the topbar.
          The mobile branch must override `top-full` — when position flips from
          absolute to fixed, `top: 100%` resolves against the VIEWPORT (= 100vh),
          which puts the panel below the visible screen. The bell click fired,
          fetch ran, panel mounted — but invisibly off-screen. Calc with
          env(safe-area-inset-top) to clear the notch on iPhones. */}
      {mounted && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1.5 w-[360px] sm:w-[400px] max-h-[480px] rounded-xl bg-[var(--surface-overlay)] border border-[var(--card-border)] shadow-xl z-50 flex flex-col overflow-hidden",
            "max-sm:fixed max-sm:inset-x-3 max-sm:right-3 max-sm:w-auto",
            "max-sm:top-[calc(env(safe-area-inset-top)+3.5rem)] max-sm:mt-0",
            "max-sm:max-h-[calc(100vh-env(safe-area-inset-top)-4.5rem)]",
            "origin-top transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            visible
              ? "opacity-100 translate-y-0 max-sm:translate-x-0"
              : "opacity-0 -translate-y-2 max-sm:translate-y-2"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Notifications</h3>
            {count > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-micro text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
                  <div key={i} className="flex gap-3">
                    <SkeletonCircle className="w-11 h-11" />
                    <div className="flex-1 space-y-2">
                      <SkeletonLine className="h-3 w-3/4" />
                      <SkeletonLine className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="py-10 px-4 text-center">
                <p className="text-sm text-[var(--foreground)]">{loadError}</p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="mt-2 text-xs font-semibold text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell
                  size={28}
                  strokeWidth={1.75}
                  className="mx-auto text-surface-400 dark:text-surface-600 mb-2"
                  aria-hidden="true"
                />
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
                      !n.read && "bg-primary-50 dark:bg-primary-500/5"
                    )}
                  >
                    {notificationIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-caption leading-snug truncate",
                            !n.read
                              ? "font-semibold text-[var(--foreground)]"
                              : "font-medium text-[var(--foreground)]/80"
                          )}
                        >
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          <span className="text-nano text-muted tabular-nums whitespace-nowrap">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-micro text-muted mt-0.5 line-clamp-2 leading-relaxed">
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
              onClick={() => {
                setOpen(false);
                router.push(notificationsUrl);
              }}
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
