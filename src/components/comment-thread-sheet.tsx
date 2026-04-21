"use client";

/**
 * CommentThreadSheet — dialog-class overlay containing the full comment
 * thread for a single target (throw, session, drill, video, etc.).
 *
 * Product intent per §Dual Product Identity:
 *   - Athlete pages: `side="bottom"` — thumb-zone, consumer register.
 *   - Coach desktop: `side="right"` — desk register, preserves canvas.
 *
 * Behavior:
 *   - Loads comments on open (GET /api/throws/comments)
 *   - Marks the thread read when it has been visible long enough (debounced)
 *   - Composer: text + voice note (reuses VoiceRecorder)
 *   - Author self-delete within 15 minutes, coach moderator-delete any time
 *   - Renders [comment deleted] placeholder for soft-deleted rows
 *   - Draft text persists in component state so reopening restores it
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Mic, Send, Trash2, ChevronDown } from "lucide-react";
import { Sheet, type SheetSide } from "@/components/ui/Sheet";
import { VoiceRecorder, type VoiceRecorderResult } from "@/components/feedback/VoiceRecorder";
import { CommentAudioPlayer } from "@/components/comment-audio-player";
import { csrfHeaders } from "@/lib/csrf-client";
import { useCommentUnread, type TargetField } from "@/lib/hooks/useCommentUnread";
import { track } from "@/lib/analytics";

/* ─── Types ──────────────────────────────────────────────────────────── */

export type CommentRow = {
  id: string;
  authorId: string;
  authorRole: "COACH" | "ATHLETE";
  authorName: string;
  authorAvatar: string | null;
  body: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  readAt: string | null;
  reaction: string | null;
  replyText: string | null;
  deleted: boolean;
  createdAt: string;
};

export interface CommentThreadSheetProps {
  open: boolean;
  onClose: () => void;
  /** Which surface this thread is anchored to. */
  targetField: TargetField;
  targetId: string;
  /**
   * Required. Per CLAUDE.md §Dual Product Identity, athlete callsites pass
   * "bottom" and coach callsites pass "right".
   */
  side: SheetSide;
  /** Human context under the header — e.g. "Shot put · Tue Apr 21". */
  context?: string;
  /** Current user's userId — used to style self bubbles and gate delete UI. */
  currentUserId: string;
  /** Current user's role — coaches get moderator-delete power. */
  currentUserRole: "COACH" | "ATHLETE";
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const SELF_DELETE_WINDOW_MS = 15 * 60 * 1000;
const MARK_READ_DEBOUNCE_MS = 500;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function CommentThreadSheet({
  open,
  onClose,
  targetField,
  targetId,
  side,
  context,
  currentUserId,
  currentUserRole,
}: CommentThreadSheetProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unread = useCommentUnread();

  /* ─── Load on open, reset on close ─── */
  useEffect(() => {
    if (!open) return;
    let aborted = false;
    setLoading(true);
    fetch(
      `/api/throws/comments?targetField=${encodeURIComponent(
        targetField
      )}&targetId=${encodeURIComponent(targetId)}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((payload) => {
        if (aborted) return;
        if (payload?.success && Array.isArray(payload.data)) {
          setComments(payload.data as CommentRow[]);
        }
      })
      .catch(() => {
        // swallow; keep prior state
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [open, targetField, targetId]);

  /* ─── Mark-thread-read after Sheet has been visible briefly ─── */
  useEffect(() => {
    if (!open) return;
    const hasUnreadFromOther = comments.some(
      (c) => c.authorId !== currentUserId && !c.readAt && !c.deleted
    );
    if (!hasUnreadFromOther) return;

    const t = setTimeout(async () => {
      const unreadCount = comments.filter(
        (c) => c.authorId !== currentUserId && !c.readAt && !c.deleted
      ).length;
      try {
        const res = await fetch("/api/throws/comments/mark-thread-read", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ targetField, targetId }),
        });
        if (res.ok && unreadCount > 0) {
          track("comment_read", { targetField, count: unreadCount });
        }
        setComments((prev) =>
          prev.map((c) =>
            c.authorId !== currentUserId && !c.readAt && !c.deleted
              ? { ...c, readAt: new Date().toISOString() }
              : c
          )
        );
        unread.clear(targetField, targetId);
      } catch {
        // non-fatal
      }
    }, MARK_READ_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [open, comments, currentUserId, targetField, targetId, unread]);

  /* ─── Auto-scroll to bottom on new content ─── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, loading]);

  /* ─── Send ─── */
  const send = useCallback(
    async (payload: { text?: string; audio?: VoiceRecorderResult }) => {
      const bodyText = payload.text?.trim() ?? "";
      const hasAudio = !!payload.audio;
      if (!bodyText && !hasAudio) return;
      if (sending) return;
      setSending(true);
      try {
        const res = await fetch("/api/throws/comments", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            targetField,
            targetId,
            text: bodyText || undefined,
            audioUrl: payload.audio?.publicUrl,
            audioDurationSec: payload.audio?.durationSec,
          }),
        });
        const json = await res.json();
        if (res.ok && json?.success) {
          setComments((prev) => [...prev, json.data as CommentRow]);
          setText("");
          setVoiceOpen(false);
          track("comment_sent", {
            targetField,
            hasAudio: !!payload.audio,
            role: currentUserRole,
          });
        }
      } finally {
        setSending(false);
      }
    },
    [sending, targetField, targetId, currentUserRole]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send({ text });
    }
  };

  /* ─── Delete ─── */
  const deleteComment = useCallback(
    async (comment: CommentRow) => {
      const res = await fetch(`/api/throws/comments/${comment.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrfHeaders(),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id ? { ...c, deleted: true, body: "", audioUrl: null } : c
          )
        );
        track("comment_deleted", {
          targetField,
          moderator: comment.authorId !== currentUserId,
        });
      }
    },
    [targetField, currentUserId]
  );

  const canDelete = useCallback(
    (c: CommentRow) => {
      if (c.deleted) return false;
      const isAuthor = c.authorId === currentUserId;
      const withinWindow = Date.now() - new Date(c.createdAt).getTime() < SELF_DELETE_WINDOW_MS;
      if (isAuthor && withinWindow) return true;
      if (currentUserRole === "COACH" && !isAuthor) return true; // moderator
      return false;
    },
    [currentUserId, currentUserRole]
  );

  /* ─── Render ─── */
  const title = "Comments";
  const subtitle = context;

  const hasComments = comments.length > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      size={side === "bottom" ? "lg" : "md"}
      title={
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-[var(--foreground)]">{title}</span>
          {subtitle && <span className="text-xs text-muted font-normal">{subtitle}</span>}
        </div>
      }
      ariaLabel="Comments thread"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar"
          role="log"
          aria-live="polite"
        >
          {loading && <SkeletonBubbles />}
          {!loading && !hasComments && <EmptyState role={currentUserRole} />}
          {!loading &&
            hasComments &&
            comments.map((c) => (
              <Bubble
                key={c.id}
                comment={c}
                self={c.authorId === currentUserId}
                onDelete={canDelete(c) ? () => void deleteComment(c) : undefined}
              />
            ))}
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-[var(--card-border)] bg-[var(--surface-overlay)] px-3 py-3">
          {voiceOpen ? (
            <VoiceRecorder
              onUploaded={(result) => void send({ audio: result })}
              onCancel={() => setVoiceOpen(false)}
            />
          ) : (
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setVoiceOpen(true)}
                aria-label="Record voice note"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)] transition-colors"
              >
                <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a reply..."
                rows={1}
                className="input flex-1 resize-none !py-2.5 text-sm min-h-[40px] max-h-[120px]"
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => void send({ text })}
                disabled={sending || text.trim().length === 0}
                aria-label="Send comment"
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary-500 text-black hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────────── */

function Bubble({
  comment,
  self,
  onDelete,
}: {
  comment: CommentRow;
  self: boolean;
  onDelete?: () => void;
}) {
  const bubbleClass = self
    ? "bg-primary-500/15 border-primary-500/30"
    : "bg-surface-100 dark:bg-surface-800 border-[var(--card-border)]";
  const alignClass = self ? "items-end" : "items-start";

  // Unread dot on other-party bubbles while unread
  const showUnreadDot = !self && !comment.readAt && !comment.deleted;

  return (
    <div className={`flex flex-col ${alignClass}`}>
      <div className={`flex items-end gap-2 max-w-[85%] ${self ? "flex-row-reverse" : ""}`}>
        {!self && (
          <Avatar name={comment.authorName} url={comment.authorAvatar} role={comment.authorRole} />
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className={`rounded-2xl border px-3.5 py-2.5 ${bubbleClass} ${
              self ? "rounded-br-md" : "rounded-bl-md"
            }`}
          >
            <div className={`flex items-baseline gap-2 ${self ? "justify-end" : ""}`}>
              <span className="text-xs font-medium text-[var(--foreground)]">
                {self ? "You" : comment.authorName}
              </span>
              <span className="text-[10px] text-muted tabular-nums">
                {formatRelative(comment.createdAt)}
              </span>
              {showUnreadDot && (
                <span
                  aria-label="Unread"
                  className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500"
                />
              )}
            </div>
            {comment.deleted ? (
              <p className="text-sm italic text-muted mt-1">[comment deleted]</p>
            ) : (
              <>
                {comment.body && comment.body !== "[voice note]" && (
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words mt-1">
                    {comment.body}
                  </p>
                )}
                {comment.audioUrl && (
                  <div className="mt-2">
                    <CommentAudioPlayer
                      src={comment.audioUrl}
                      durationSec={comment.audioDurationSec ?? undefined}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={`text-[10px] text-muted hover:text-danger-500 transition-colors flex items-center gap-1 ${
                self ? "self-end" : "self-start"
              }`}
              aria-label="Delete comment"
            >
              <Trash2 size={10} strokeWidth={1.75} aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  name,
  url,
  role,
}: {
  name: string;
  url: string | null;
  role: "COACH" | "ATHLETE";
}) {
  const bg = role === "COACH" ? "bg-primary-500" : "bg-blue-500";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${bg} overflow-hidden`}
      aria-hidden="true"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

function SkeletonBubbles() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full shimmer-contextual" />
        <div className="shimmer-contextual h-12 w-2/3 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <div className="shimmer-contextual h-10 w-1/2 rounded-2xl" />
      </div>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full shimmer-contextual" />
        <div className="shimmer-contextual h-8 w-1/3 rounded-2xl" />
      </div>
    </div>
  );
}

function EmptyState({ role }: { role: "COACH" | "ATHLETE" }): ReactNode {
  const message =
    role === "COACH"
      ? "No comments yet. Leave the first note below."
      : "No comments yet. Your coach will leave feedback here.";
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-muted text-sm">{message}</div>
    </div>
  );
}

/* ─── Trigger helper ──────────────────────────────────────────────────── */

/**
 * Comment-icon button + unread badge — drop in next to any surface card to
 * open a thread. Accepts side from the caller so athlete/coach callsites
 * encode product intent at the callsite rather than inside the Sheet.
 */
export function CommentThreadTrigger({
  targetField,
  targetId,
  side,
  context,
  currentUserId,
  currentUserRole,
  label,
  className,
}: {
  targetField: TargetField;
  targetId: string;
  side: SheetSide;
  context?: string;
  currentUserId: string;
  currentUserRole: "COACH" | "ATHLETE";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { byTarget } = useCommentUnread();
  const unreadCount = byTarget[targetField][targetId] ?? 0;

  const badge = useMemo(() => {
    if (unreadCount <= 0) return null;
    return (
      <span
        aria-label={`${unreadCount} unread`}
        className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-black text-[10px] font-bold flex items-center justify-center tabular-nums"
      >
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    );
  }, [unreadCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "relative inline-flex items-center gap-1.5 text-xs text-muted hover:text-[var(--foreground)] transition-colors"
        }
        aria-label={label ?? "Open comments"}
      >
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className="rotate-0" />
        {label ?? "Comments"}
        {badge}
      </button>
      <CommentThreadSheet
        open={open}
        onClose={() => setOpen(false)}
        targetField={targetField}
        targetId={targetId}
        side={side}
        context={context}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    </>
  );
}
