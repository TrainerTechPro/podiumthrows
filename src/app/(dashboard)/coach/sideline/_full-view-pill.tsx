"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Monitor } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { setCoachMobileView } from "./_actions";

export function FullCoachViewPill() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(() => {
      void setCoachMobileView("full");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--card-border)] hover:border-[var(--color-text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      >
        Full coach view
        <ArrowRight size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        size="sm"
        title="Show the full dashboard?"
        description="It's designed for desktop use — dense, multi-column, built for analysis at the keyboard."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Stay on sideline
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-surface-950 bg-primary-500 hover:bg-primary-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Monitor size={14} strokeWidth={1.75} aria-hidden="true" />
              {pending ? "Switching…" : "Show full view"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          You can return to sideline any time using the floating button in the bottom-right.
        </p>
      </Sheet>
    </>
  );
}
