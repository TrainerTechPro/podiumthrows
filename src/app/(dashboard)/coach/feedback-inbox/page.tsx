import Link from "next/link";
import { Inbox, Check, AlertCircle, ThumbsDown } from "lucide-react";
import { Avatar } from "@/components";
import { requireCoachSession } from "@/lib/data/coach";
import { fetchCoachFeedbackInbox } from "@/lib/data/coach-feedback-inbox";

export const dynamic = "force-dynamic";

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

export default async function CoachFeedbackInboxPage() {
  const { coach } = await requireCoachSession();
  const rows = await fetchCoachFeedbackInbox(coach.id);

  const totalUnread = rows.reduce((sum, r) => sum + r.unread, 0);
  const totalReacted = rows.reduce((sum, r) => sum + r.reacted, 0);
  const totalThumbsDown = rows.reduce((sum, r) => sum + r.thumbsDown, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)] flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
            Feedback Inbox
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Who&apos;s reading your feedback — and how they&apos;re reacting.
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted">Unread</p>
            <p className="mt-1 text-2xl font-bold font-heading tabular-nums text-[var(--foreground)]">
              {totalUnread}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted">
              Acknowledged
            </p>
            <p className="mt-1 text-2xl font-bold font-heading tabular-nums text-success-500">
              {totalReacted}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted">
              Thumbs Down
            </p>
            <p className="mt-1 text-2xl font-bold font-heading tabular-nums text-danger-500">
              {totalThumbsDown}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">No feedback sent yet</p>
          <p className="text-xs text-muted mt-1">
            Leave a note on any throw or session — it&apos;ll appear here along with the
            athlete&apos;s acknowledgments.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[var(--card-border)]">
          {rows.map((row) => (
            <Link
              key={row.athleteId}
              href={`/coach/athletes/${row.athleteId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <Avatar name={row.athleteName} src={row.athleteAvatar} size="md" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {row.athleteName}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  <span className="tabular-nums">{row.totalFeedback}</span> note
                  {row.totalFeedback === 1 ? "" : "s"}
                  {row.lastFeedbackAt && <> · last sent {formatRelative(row.lastFeedbackAt)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.unread > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-500 tabular-nums">
                    <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {row.unread} unread
                  </span>
                )}
                {row.unread === 0 && row.reacted > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success-500">
                    <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    All seen
                  </span>
                )}
                {row.thumbsDown > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-danger-500"
                    aria-label={`${row.thumbsDown} thumbs down`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {row.thumbsDown}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
