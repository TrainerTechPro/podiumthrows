"use client";

import { useState, useCallback, useTransition } from "react";
import { Badge, Button, EmptyState } from "@/components";
import type { NotificationItem } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
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
} from "lucide-react";

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

const iconProps = { size: 16, strokeWidth: 1.75, "aria-hidden": true as const };

function NotificationIcon({ type }: { type: string }) {
  const base = "w-9 h-9 rounded-full flex items-center justify-center shrink-0";

  switch (type) {
    case "PR_ALERT":
      return (
        <div
          className={`${base} bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400`}
        >
          <Trophy {...iconProps} />
        </div>
      );
    case "LOW_READINESS":
      return (
        <div
          className={`${base} bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400`}
        >
          <AlertTriangle {...iconProps} />
        </div>
      );
    case "QUESTIONNAIRE_ASSIGNED":
    case "QUESTIONNAIRE_COMPLETE":
      return (
        <div className={`${base} bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400`}>
          <ClipboardList {...iconProps} />
        </div>
      );
    case "WORKOUT_ASSIGNED":
    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <Dumbbell {...iconProps} />
        </div>
      );
    case "ATHLETE_JOINED":
      return (
        <div
          className={`${base} bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400`}
        >
          <UserPlus {...iconProps} />
        </div>
      );
    case "PROGRAM_CHECKPOINT":
    case "COMPLEX_ROTATED":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <RefreshCw {...iconProps} />
        </div>
      );
    case "COMMENT_ADDED":
      return (
        <div className={`${base} bg-info-50 dark:bg-info-500/20 text-info-600 dark:text-info-400`}>
          <MessageCircle {...iconProps} />
        </div>
      );
    case "VIDEO_SHARED":
      return (
        <div
          className={`${base} bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400`}
        >
          <Video {...iconProps} />
        </div>
      );
    case "COMPETITION_REMINDER":
      return (
        <div
          className={`${base} bg-warning-50 dark:bg-warning-500/15 text-warning-600 dark:text-warning-400`}
        >
          <CalendarClock {...iconProps} />
        </div>
      );
    case "INVITATION_EXPIRED":
      return (
        <div className={`${base} bg-surface-100 dark:bg-surface-800 text-surface-500`}>
          <Clock {...iconProps} />
        </div>
      );
    case "STREAK_BROKEN":
      return (
        <div
          className={`${base} bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400`}
        >
          <Flame {...iconProps} />
        </div>
      );
    default:
      return (
        <div className={`${base} bg-surface-100 dark:bg-surface-800 text-surface-500`}>
          <Settings2 {...iconProps} />
        </div>
      );
  }
}

/* ─── Type maps ──────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  PR_ALERT: "Personal Best",
  LOW_READINESS: "Low Readiness",
  QUESTIONNAIRE_COMPLETE: "Questionnaire",
  QUESTIONNAIRE_ASSIGNED: "Questionnaire",
  STREAK_BROKEN: "Streak",
  WORKOUT_ASSIGNED: "Workout",
  WORKOUT_COMPLETED: "Workout",
  WORKOUT_SKIPPED: "Workout",
  ATHLETE_JOINED: "Roster",
  PROGRAM_CHECKPOINT: "Program",
  COMPLEX_ROTATED: "Program",
  COMMENT_ADDED: "Comment",
  VIDEO_SHARED: "Video",
  COMPETITION_REMINDER: "Competition",
  INVITATION_EXPIRED: "Invitation",
};

const TYPE_BADGE_VARIANTS: Record<
  string,
  "success" | "danger" | "info" | "neutral" | "warning" | "primary"
> = {
  PR_ALERT: "success",
  LOW_READINESS: "danger",
  QUESTIONNAIRE_COMPLETE: "info",
  QUESTIONNAIRE_ASSIGNED: "info",
  STREAK_BROKEN: "danger",
  WORKOUT_ASSIGNED: "primary",
  WORKOUT_COMPLETED: "success",
  WORKOUT_SKIPPED: "warning",
  ATHLETE_JOINED: "success",
  PROGRAM_CHECKPOINT: "primary",
  COMPLEX_ROTATED: "primary",
  COMMENT_ADDED: "info",
  VIDEO_SHARED: "primary",
  COMPETITION_REMINDER: "warning",
  INVITATION_EXPIRED: "neutral",
};

/* ─── Link helper ────────────────────────────────────────────────────────── */

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
      return n.athleteProfileId && role === "COACH"
        ? `/coach/athletes/${n.athleteProfileId}`
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
      return null;
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
          ? `/coach/athletes/${athleteId}/sessions/${targetId}`
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
      return targetId ? `/athlete/sessions/${targetId}` : "/athlete/sessions";
    default:
      return "/athlete/throws";
  }
}

/* ─── Filter tabs ────────────────────────────────────────────────────────── */

type FilterType = "all" | "unread" | string;

const COACH_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "PR_ALERT", label: "PR Alerts" },
  { key: "LOW_READINESS", label: "Low Readiness" },
  { key: "WORKOUT_COMPLETED", label: "Workouts" },
  { key: "QUESTIONNAIRE_COMPLETE", label: "Questionnaires" },
  { key: "ATHLETE_JOINED", label: "Roster" },
  { key: "INVITATION_EXPIRED", label: "Invites" },
  { key: "PROGRAM_CHECKPOINT", label: "Checkpoints" },
  { key: "COMPLEX_ROTATED", label: "Rotations" },
];

const ATHLETE_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "WORKOUT_ASSIGNED", label: "Workouts" },
  { key: "QUESTIONNAIRE_ASSIGNED", label: "Questionnaires" },
  { key: "VIDEO_SHARED", label: "Videos" },
  { key: "COMPETITION_REMINDER", label: "Competitions" },
  { key: "STREAK_BROKEN", label: "Streaks" },
];

/* ─── Notification Row ──────────────────────────────────────────────────── */

function NotificationRow({
  notification: n,
  onMarkRead,
  role,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string, read: boolean) => void;
  role: "COACH" | "ATHLETE";
}) {
  const router = useRouter();
  const url = getNotificationUrl(n, role);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
        !n.read
          ? "border-amber-400/20 bg-amber-50/50 dark:bg-amber-500/5"
          : "border-surface-200 dark:border-surface-800 bg-[var(--card)]"
      }`}
    >
      <NotificationIcon type={n.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-[var(--foreground)]">{n.title}</p>
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

        <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.body}</p>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant={TYPE_BADGE_VARIANTS[n.type] ?? "neutral"}>
            {TYPE_LABELS[n.type] ?? "Notification"}
          </Badge>

          {url && (
            <button
              type="button"
              onClick={() => router.push(url)}
              className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
            >
              View details →
            </button>
          )}

          <button
            type="button"
            onClick={() => onMarkRead(n.id, !n.read)}
            aria-label={`${n.read ? "Mark unread" : "Mark read"}: ${n.title}`}
            className="text-[10px] text-muted hover:text-[var(--foreground)] ml-auto transition-colors"
          >
            {n.read ? "Mark unread" : "Mark read"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Client Component ──────────────────────────────────────────────── */

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
  unreadCount: number;
  role: "COACH" | "ATHLETE";
}

export function NotificationsClient({
  initialNotifications,
  unreadCount: _initialUnread,
  role,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterType>("all");
  const [, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filterTabs = role === "COACH" ? COACH_FILTERS : ATHLETE_FILTERS;

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter !== "all") return n.type === filter;
    return true;
  });

  const toast = useToast();

  const handleMarkRead = useCallback(
    (id: string, read: boolean) => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/notifications/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ read }),
          });
          if (!res.ok) {
            throw new Error(`Mark read failed (${res.status})`);
          }
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
        } catch (err) {
          console.error("mark notification read failed", err);
          toast.error("Couldn't update — try again");
        }
      });
    },
    [toast]
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
        });
        if (!res.ok) {
          throw new Error(`Mark all read failed (${res.status})`);
        }
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success("All notifications marked read");
      } catch (err) {
        console.error("mark all read failed", err);
        toast.error("Couldn't mark all — try again");
      }
    });
  }, [toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Notifications
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterTabs.map(({ key, label }) => {
          const count =
            key === "unread"
              ? notifications.filter((n) => !n.read).length
              : key !== "all"
                ? notifications.filter((n) => n.type === key).length
                : null;

          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {label}
              {count !== null && count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} strokeWidth={1.5} />}
          title={filter === "unread" ? "No unread notifications" : "No notifications"}
          description={
            filter === "unread"
              ? "You're all caught up! New alerts will appear here."
              : role === "COACH"
                ? "PR alerts, readiness warnings, workout completions, and more will appear here."
                : "Workout assignments, questionnaires, videos, and more will appear here."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              role={role}
            />
          ))}
        </div>
      )}
    </div>
  );
}
