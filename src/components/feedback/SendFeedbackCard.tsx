"use client";

import { useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { FeedbackSheet } from "./FeedbackSheet";
import type { SheetSide } from "@/components/ui/Sheet";

export interface SendFeedbackCardProps {
  /**
   * Defaults to "bottom" — the card lives on the athlete settings page,
   * which is mobile-first. Coach-side surfaces should pass "right".
   */
  side?: SheetSide;
}

/**
 * Inline entry-point card for the feedback widget. Routes through the
 * shared <FeedbackSheet> primitive (which is also what the global FAB
 * renders), so the form shape and submission flow stay in one place.
 */
export function SendFeedbackCard({ side = "bottom" }: SendFeedbackCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card card-interactive p-4 flex items-center gap-3 w-full text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
          <MessageSquare
            size={20}
            className="text-primary-500"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--foreground)]">Send feedback</p>
          <p className="text-xs text-muted">Report a bug, suggest an idea, or say hi</p>
        </div>
        <ChevronRight size={20} className="text-muted" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <FeedbackSheet open={open} onClose={() => setOpen(false)} side={side} />
    </>
  );
}
