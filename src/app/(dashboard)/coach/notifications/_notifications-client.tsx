"use client";

import { useState, useCallback, useTransition } from "react";
import { Badge, Button, EmptyState } from "@/components";
import type { NotificationItem } from "@/lib/data/coach";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";

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

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "PR_ALERT":
      return (
        <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0 text-lg">
          🏆
        </div>
      );
    case "LOW_READINESS":
      return (
        <div className="w-9 h-9 rounded-full bg-danger-50 dark:bg-danger-500/20 flex items-center justify-center shrink-0 text-lg">
          ⚠️
        </div>
      );
    case "QUESTIONNAIRE_COMPLETE":
      return (
        <div className="w-9 h-9 rounded-full bg-info-50 dark:bg-info-500/20 flex items-center justify-center shrink-0 text-lg">
          📋
        </div>
      );
    default:
      return (
        <div className="w-9 h-9 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0 text-lg">
          🔔
        </div>
      );
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "PR_ALERT": return "Personal Best";
    case "LOW_READINESS": return "Low Readiness";
    case "QUESTIONNAIRE_COMPLETE": return "Questionnaire";
    default: return "Notification";
  }
}

function typeBadgeVariant(type: string): "success" | "danger" | "info" | "neutral" {
  switch (type) {
    case "PR_ALERT": return "success";
    case "LOW_READINESS": return "danger";
    case "QUESTIONNAIRE_COMPLETE": return "info";
    default: return "neutral";
  }
}

/* ─── Filter tabs ────────────────────────────────────────────────────────── */

type FilterType = "all" | "unread" | "PR_ALERT" | "LOW_READINESS";

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "PR_ALERT", label: "PR Alerts" },
  { key: "LOW_READINESS", label: "Low Readiness" },
];

/* ─── Notification Row ──────────────────────────────────────────────────────*/

interface NotificationRowProps {
  notification: NotificationItem;
  onMarkRead: (id: string, read: boolean) => void;
}

function NotificationRow({ notification: n, onMarkRead }: NotificationRowProps) {
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
          <p className={`text-sm font-semibold leading-snug ${!n.read ? "text-[var(--foreground)]" : "text-[var(--foreground)]"}`}>
            {n.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {/* Unread dot */}
            {!n.read && (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            )}
            <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">
              {relativeTime(n.createdAt)}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.body}</p>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant={typeBadgeVariant(n.type)}>
            {typeLabel(n.type)}
          </Badge>

          {n.athleteId && (
            <Link
              href={`/coach/athletes/${n.athleteId}`}
              className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
            >
              View athlete →
            </Link>
          )}

          <button
            onClick={() => onMarkRead(n.id, !n.read)}
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
}

export function NotificationsClient({ initialNotifications, unreadCount: _initialUnread }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<FilterType>("all");
  const [, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "PR_ALERT" || filter === "LOW_READINESS") return n.type === filter;
    return true;
  });

  /* ── Mark single read/unread ── */
  const handleMarkRead = useCallback((id: string, read: boolean) => {
    startTransition(async () => {
      try {
        await fetch(`/api/coach/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ read }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read } : n))
        );
      } catch {
        // Silent fail
      }
    });
  }, []);

  /* ── Mark all read ── */
  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      try {
        await fetch("/api/coach/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ markAll: true, read: true }),
        });
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {
        // Silent fail
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Notifications</h1>
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
        {FILTER_TABS.map(({ key, label }) => {
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
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
          title={filter === "unread" ? "No unread notifications" : "No notifications"}
          description={
            filter === "unread"
              ? "You're all caught up! New alerts will appear here."
              : "PR alerts, low readiness warnings, and questionnaire completions will appear here."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
