"use client";

/**
 * FeedbackList — athlete-side chronological view of coach feedback.
 * Each row supports inline audio playback, thumbs up/down reaction,
 * a one-word text reply, and auto-marks-as-read on first mount.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, Play, Pause, MessageSquare, Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import type { AthleteFeedbackItem } from "@/lib/data/athlete-feedback";

import { logger } from "@/lib/logger";
/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function FeedbackList({ initialItems }: { initialItems: AthleteFeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const markedRef = useRef<Set<string>>(new Set());

  // Auto-mark all unread items as read on mount. Depending on `items`
  // re-triggered on every state update — we only want this to run once
  // per set of initially-unread items. Using `initialItems` as the
  // trigger keeps it bound to the original data load; subsequent local
  // state changes (reaction, reply) don't re-PATCH.
  useEffect(() => {
    const unread = initialItems.filter((i) => i.readAt === null);
    if (unread.length === 0) return;

    void Promise.all(
      unread.map(async (item) => {
        if (markedRef.current.has(item.id)) return;
        markedRef.current.add(item.id);
        try {
          const res = await fetch(`/api/throws/comments/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ readAt: "now" }),
          });
          if (!res.ok) {
            throw new Error(`Mark read failed (${res.status})`);
          }
        } catch (err) {
          // Don't interrupt the reading flow — log so we can diagnose.
          // The server will catch up on the next ack action.
          logger.warn("auto-mark-read failed", {
            context: "athlete/feedback/feedback-list",
            error: err,
          });
        }
      })
    ).then(() => {
      setItems((prev) =>
        prev.map((it) => (it.readAt === null ? { ...it, readAt: new Date().toISOString() } : it))
      );
    });
  }, [initialItems]);

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-[var(--foreground)]">No feedback yet</p>
        <p className="text-xs text-muted mt-1">
          Your coach will leave notes on your throws and sessions here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeedbackRow
          key={item.id}
          item={item}
          onUpdate={(patch) =>
            setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...patch } : it)))
          }
        />
      ))}
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────────── */

function FeedbackRow({
  item,
  onUpdate,
}: {
  item: AthleteFeedbackItem;
  onUpdate: (patch: Partial<AthleteFeedbackItem>) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [reactionPending, setReactionPending] = useState(false);
  const [showReply, setShowReply] = useState(!!item.replyText);
  const [replyDraft, setReplyDraft] = useState(item.replyText ?? "");
  const [replyPending, setReplyPending] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toast = useToast();

  async function setReaction(reaction: "THUMBS_UP" | "THUMBS_DOWN") {
    if (reactionPending) return;
    setReactionPending(true);
    // Optimistic — toggle off if tapping the same one already set
    const next = item.reaction === reaction ? null : reaction;
    onUpdate({ reaction: next });
    try {
      const res = await fetch(`/api/throws/comments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ reaction: next }),
      });
      if (!res.ok) {
        throw new Error(`Reaction save failed (${res.status})`);
      }
    } catch (err) {
      logger.error("reaction save failed", {
        context: "athlete/feedback/feedback-list",
        error: err,
      });
      // Rollback on failure and tell the user so the revert isn't silent.
      onUpdate({ reaction: item.reaction });
      toast.error("Couldn't save reaction — try again");
    } finally {
      setReactionPending(false);
    }
  }

  async function submitReply() {
    if (replyPending) return;
    const trimmed = replyDraft.trim();
    if (trimmed === (item.replyText ?? "")) {
      setShowReply(false);
      return;
    }
    setReplyPending(true);
    try {
      const res = await fetch(`/api/throws/comments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ replyText: trimmed.length > 0 ? trimmed : null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Reply save failed (${res.status})`);
      }
      onUpdate({ replyText: trimmed.length > 0 ? trimmed : null });
      setShowReply(trimmed.length > 0);
      toast.success(trimmed.length > 0 ? "Reply sent" : "Reply cleared");
    } catch (err) {
      logger.error("reply save failed", { context: "athlete/feedback/feedback-list", error: err });
      toast.error(err instanceof Error ? err.message : "Couldn't save reply — try again");
    } finally {
      setReplyPending(false);
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }

  const isVoice = item.audioUrl != null;
  const isUnread = item.readAt === null;

  return (
    <div className={`card p-4 ${isUnread ? "border-l-4 border-l-primary-500" : ""}`.trim()}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {item.coachAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coachAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary-500/15 flex items-center justify-center text-xs font-bold text-primary-500">
              {item.coachName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {item.coachName}
            </p>
            <p className="text-micro text-muted">{formatRelative(item.createdAt)}</p>
          </div>
        </div>
        <Link
          href={item.target.href}
          className="text-micro text-primary-500 hover:underline shrink-0"
        >
          {item.target.label} &gt;
        </Link>
      </div>

      {/* Body */}
      <div className="mt-3">
        {isVoice ? (
          <div className="flex items-center gap-3 bg-surface-50 dark:bg-surface-900/50 rounded-lg px-3 py-2">
            <button
              type="button"
              onClick={togglePlay}
              className="h-9 w-9 rounded-full bg-primary-500 flex items-center justify-center text-white shrink-0"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted font-mono tabular-nums">
                Voice note · {item.audioDurationSec}s
              </p>
            </div>
            <audio
              ref={audioRef}
              src={item.audioUrl ?? undefined}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{item.body}</p>
        )}
      </div>

      {/* Ack controls */}
      <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setReaction("THUMBS_UP")}
          disabled={reactionPending}
          aria-pressed={item.reaction === "THUMBS_UP"}
          aria-label="React with thumbs up"
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors ${
            item.reaction === "THUMBS_UP"
              ? "bg-success-500/15 text-success-500"
              : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
          }`}
        >
          <ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setReaction("THUMBS_DOWN")}
          disabled={reactionPending}
          aria-pressed={item.reaction === "THUMBS_DOWN"}
          aria-label="React with thumbs down"
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors ${
            item.reaction === "THUMBS_DOWN"
              ? "bg-danger-500/15 text-danger-500"
              : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
          }`}
        >
          <ThumbsDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setShowReply((v) => !v)}
          className="min-h-[44px] px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {item.replyText ? item.replyText : "Reply"}
        </button>
        <div className="flex-1" />
        {!isUnread && (
          <span className="text-nano text-muted inline-flex items-center gap-1">
            <Check className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Read
          </span>
        )}
      </div>

      {showReply && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            maxLength={40}
            placeholder="One word…"
            className="input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={submitReply}
            disabled={replyPending}
            className="btn btn-primary text-xs"
          >
            {replyPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
