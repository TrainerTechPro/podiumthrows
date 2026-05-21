import Link from "next/link";
import { ChevronRight, ThumbsDown, Inbox } from "lucide-react";
import { Avatar } from "@/components";
import type { CoachFeedbackInboxRow } from "@/lib/data/coach-feedback-inbox";

/* The dashboard cut of the feedback inbox: the rows a coach should look
   at today. Filter + sort happens in page.tsx so this stays a pure view.
   Empty state hides on the page side — a feedback queue with nothing in
   it is noise, not signal. */

interface FeedbackQueueProps {
  rows: CoachFeedbackInboxRow[];
  nowMs: number;
}

export function FeedbackQueue({ rows, nowMs }: FeedbackQueueProps) {
  return (
    <ul className="divide-y divide-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-xl overflow-hidden">
      {rows.map((row) => (
        <li key={row.athleteId}>
          <Link
            href={`/coach/athletes/${row.athleteId}?tab=feedback`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
          >
            <Avatar name={row.athleteName} src={row.athleteAvatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {row.athleteName}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <Status row={row} />
                {row.lastFeedbackAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      sent {relativeShort(row.lastFeedbackAt, nowMs)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Status({ row }: { row: CoachFeedbackInboxRow }) {
  if (row.thumbsDown > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-status-danger-fg">
        <ThumbsDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        {row.thumbsDown} pushback{row.thumbsDown === 1 ? "" : "s"}
      </span>
    );
  }
  if (row.unread > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
        <Inbox className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        {row.unread} unread
      </span>
    );
  }
  return <span>Caught up</span>;
}

function relativeShort(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const diff = nowMs - then;
  if (Number.isNaN(then) || diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
