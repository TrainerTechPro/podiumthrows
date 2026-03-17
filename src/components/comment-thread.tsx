"use client";

import { useState, useEffect, useRef } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

interface Comment {
  id: string;
  authorId: string;
  authorRole: "COACH" | "ATHLETE";
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}

type TargetField =
  | "throwLogId"
  | "practiceAttemptId"
  | "trainingSessionId"
  | "throwsAssignmentId";

interface CommentThreadProps {
  targetField: TargetField;
  targetId: string;
  /** Compact mode for inline use inside cards */
  compact?: boolean;
}

export function CommentThread({ targetField, targetId, compact }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/throws/comments?targetField=${targetField}&targetId=${targetId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setComments(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [targetField, targetId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/throws/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ targetField, targetId, text: text.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [...prev, data.data]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Compact toggle button when collapsed
  if (compact && !expanded && !loading) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-600 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? "s" : ""}` : "Add comment"}
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[var(--card-border)] bg-surface-50 dark:bg-surface-900 ${
        compact ? "mt-2" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)]">
        <span className="text-xs font-medium text-muted flex items-center gap-1.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Collapse
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto px-3 py-2 space-y-2"
      >
        {loading && (
          <div className="shimmer-contextual h-8 rounded" />
        )}

        {!loading && comments.length === 0 && (
          <p className="text-xs text-muted text-center py-2">
            No comments yet. Start the conversation.
          </p>
        )}

        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            {/* Avatar */}
            <div
              className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ${
                c.authorRole === "COACH"
                  ? "bg-primary-500"
                  : "bg-blue-500"
              }`}
            >
              {c.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.authorAvatar}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                c.authorName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {c.authorName}
                </span>
                <span className="text-[10px] text-muted">
                  {formatRelativeTime(c.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words">
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-[var(--card-border)] flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a comment..."
          className="input flex-1 !py-1.5 text-sm"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
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
