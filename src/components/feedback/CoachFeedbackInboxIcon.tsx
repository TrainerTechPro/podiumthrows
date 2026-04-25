"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";

/**
 * Coach-side feedback inbox top-bar icon.
 *
 * Distinct from athlete FeedbackInboxBadge: feedback for a coach is async
 * correspondence (athlete → coach messages requiring a reply), not the
 * "thing happened, FYI" mental model of notifications. Different cadence,
 * different unread semantics — earns its own icon next to the bell.
 *
 * No unread-count badge yet — /api/coach/feedback/unread-count doesn't exist.
 * When that endpoint lands, swap in a polling pattern matching
 * FeedbackInboxBadge (visibility-change refresh, no interval).
 */
export function CoachFeedbackInboxIcon() {
  return (
    <Link
      href="/coach/feedback-inbox"
      aria-label="Feedback inbox"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
    >
      <Inbox className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
