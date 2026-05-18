"use client";

/**
 * FeedbackInboxBadge — small client component that shows a red dot
 * when the athlete has unread coach feedback. Links to /athlete/feedback.
 *
 * Polls /api/athlete/feedback/unread-count on mount and every time the
 * tab regains focus. Not on an interval — that would waste requests when
 * the athlete isn't actively looking at the dashboard.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { logger } from "@/lib/logger";

export function FeedbackInboxBadge() {
  const [unread, setUnread] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/athlete/feedback/unread-count", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as
        | { success: true; data: { unread: number } }
        | { success: false; error: string };
      setUnread(payload.success ? (payload.data.unread ?? 0) : 0);
    } catch (err) {
      // Silent — feature is non-critical
      logger.debug("Silent — feature is non-critical", {
        context: "src/components/feedback/FeedbackInboxBadge.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  return (
    <Link
      href="/athlete/feedback"
      aria-label={unread > 0 ? `Coach feedback — ${unread} unread` : "Coach feedback"}
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
    >
      <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 && (
        <span
          className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--background)]"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
