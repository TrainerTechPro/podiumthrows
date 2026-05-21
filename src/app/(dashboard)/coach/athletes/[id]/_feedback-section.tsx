import Link from "next/link";
import { MessageSquare, ThumbsUp, ThumbsDown, Mic, Check } from "lucide-react";
import type { AthleteFeedbackItem } from "@/lib/data/athlete-feedback";

/* Coach feedback the THIS coach has left for THIS athlete. Mirrors the
   shape of the inbox row but scoped to a single athlete and trimmed to
   the last few items — full list lives at /coach/feedback-inbox. */

interface FeedbackSectionProps {
  athleteId: string;
  athleteName: string;
  items: AthleteFeedbackItem[];
  nowMs: number;
}

export function FeedbackSection({ athleteId, athleteName, items, nowMs }: FeedbackSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--card-border)] px-5 py-6">
        <p className="text-sm text-muted">
          No coach feedback for {athleteName} yet. Leave a comment from a session or throw to start
          the loop.
        </p>
      </div>
    );
  }

  const top = items.slice(0, 6);
  const overflow = items.length - top.length;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-[var(--card-border)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        {top.map((item) => (
          <li key={item.id}>
            <Link
              href={item.target.href}
              className="block px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-muted truncate">{item.target.label}</p>
                <span className="text-xs text-muted tabular-nums shrink-0">
                  {relativeShort(item.createdAt, nowMs)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--foreground)] line-clamp-2">
                {item.audioUrl && !item.body ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Mic className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Voice note · {item.audioDurationSec ?? "?"}s
                  </span>
                ) : (
                  item.body
                )}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <ReadState item={item} />
                <Reaction item={item} />
                {item.replyText && (
                  <span className="inline-flex items-center gap-1 text-muted truncate">
                    <MessageSquare
                      className="h-3 w-3 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.replyText}</span>
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <Link
          href={`/coach/feedback-inbox#athlete-${athleteId}`}
          className="inline-block text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--foreground)]"
        >
          {overflow} more in inbox →
        </Link>
      )}
    </div>
  );
}

function ReadState({ item }: { item: AthleteFeedbackItem }) {
  if (item.readAt) {
    return (
      <span className="inline-flex items-center gap-1 text-status-success-fg">
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Read
      </span>
    );
  }
  return <span className="text-muted">Unread</span>;
}

function Reaction({ item }: { item: AthleteFeedbackItem }) {
  if (item.reaction === "THUMBS_UP") {
    return (
      <span className="inline-flex items-center gap-1 text-status-success-fg">
        <ThumbsUp className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Liked
      </span>
    );
  }
  if (item.reaction === "THUMBS_DOWN") {
    return (
      <span className="inline-flex items-center gap-1 text-status-danger-fg">
        <ThumbsDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        Pushback
      </span>
    );
  }
  return null;
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
