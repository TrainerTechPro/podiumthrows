"use client";

import { MessageSquare, Mic } from "lucide-react";

/* ─── Coach notes for this meet ───────────────────────────────────────────
   Aggregates ThrowComment rows from this meet's throws (authorRole=COACH)
   plus the meet-level athlete-authored note (meet.notes). Sits between the
   hero and the editor table — close enough to read alongside the result,
   far enough that it doesn't compete with the hero's distance read.
   ─────────────────────────────────────────────────────────────────────── */

export interface CoachComment {
  id: string;
  body: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  attemptLabel: string; // e.g. "Prelim 2"
  /** ISO. */
  createdAt: string;
}

interface MeetCoachNotesProps {
  comments: CoachComment[];
  athleteNote: string | null;
}

function relativeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function MeetCoachNotes({ comments, athleteNote }: MeetCoachNotesProps) {
  const hasContent = comments.length > 0 || (athleteNote && athleteNote.trim().length > 0);
  if (!hasContent) return null;

  return (
    <section className="card p-5 space-y-4" data-testid="meet-coach-notes" aria-label="Notes">
      <header className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Notes</p>
        {comments.length > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-muted">
            {comments.length} from coach
          </span>
        )}
      </header>

      {athleteNote && athleteNote.trim().length > 0 && (
        <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap border-l-2 border-primary-500/40 pl-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">
            Your meet note
          </p>
          {athleteNote}
        </div>
      )}

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 text-sm text-[var(--foreground)] leading-relaxed"
            >
              <span
                className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-primary-500/15 text-primary-500 flex items-center justify-center"
                aria-hidden="true"
              >
                {c.audioUrl ? (
                  <Mic size={13} strokeWidth={1.75} />
                ) : (
                  <MessageSquare size={13} strokeWidth={1.75} />
                )}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
                  <span className="font-medium">{c.attemptLabel}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={c.createdAt}>{relativeShort(c.createdAt)}</time>
                </div>
                {c.audioUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={c.audioUrl}
                    className="w-full max-w-sm h-9"
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{c.body}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {comments.length === 0 && (
        <p className="text-xs text-muted">
          Your coach hasn&apos;t commented on these throws yet. They show up here when they do.
        </p>
      )}
    </section>
  );
}
