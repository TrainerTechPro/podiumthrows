"use client";

/**
 * CoachComposer — textarea + post button for coach team-wide messages.
 *
 * Posts to POST /api/coach/team-activity with { body: string }.
 * Character counter turns amber at 400, red at 500 (the hard limit).
 * On success, clears the textarea and fires an optional onPosted callback
 * so a parent can refresh the feed.
 */

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

const MAX_LENGTH = 500;
const WARN_LENGTH = 400;

interface CoachComposerProps {
  /** Called after a successful post so callers can refresh state */
  onPosted?: () => void;
}

export function CoachComposer({ onPosted }: CoachComposerProps) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const charCount = text.length;
  const overLimit = charCount > MAX_LENGTH;
  const isEmpty = text.trim().length === 0;
  const disabled = isEmpty || overLimit || posting;

  const counterColor =
    charCount >= MAX_LENGTH
      ? "text-danger-500"
      : charCount >= WARN_LENGTH
        ? "text-primary-500"
        : "text-muted";

  async function handlePost() {
    if (disabled) return;
    setPosting(true);
    try {
      const res = await fetch("/api/coach/team-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ body: text.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Couldn't post. Try again.");
        return;
      }

      toast.success("Posted to team");
      setText("");
      textareaRef.current?.focus();
      onPosted?.();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <label
        htmlFor="coach-post-body"
        className="text-sm font-semibold text-muted uppercase tracking-wider"
      >
        Post to team
      </label>

      <textarea
        id="coach-post-body"
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter submits
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void handlePost();
          }
        }}
        placeholder="Say something to your athletes…"
        rows={3}
        maxLength={MAX_LENGTH + 1} // +1 so the counter shows over-limit state
        className="w-full resize-none rounded-xl bg-surface-100 dark:bg-surface-800/60 border border-[var(--card-border)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-primary-500/40 transition-shadow"
        aria-describedby="coach-post-counter"
      />

      <div className="flex items-center justify-between gap-3">
        <p
          id="coach-post-counter"
          className={`text-xs font-mono tabular-nums transition-colors ${counterColor}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {charCount}/{MAX_LENGTH}
        </p>

        <Button
          variant="primary"
          size="sm"
          disabled={disabled}
          loading={posting}
          leftIcon={<Send size={14} strokeWidth={1.75} aria-hidden="true" />}
          onClick={() => void handlePost()}
        >
          Post to Team
        </Button>
      </div>
    </div>
  );
}
