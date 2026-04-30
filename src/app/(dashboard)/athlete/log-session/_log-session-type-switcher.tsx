"use client";

import { useState } from "react";
import { Dumbbell, Gauge } from "lucide-react";
import { TestTypePickerSheet } from "@/components/performance-tests/TestTypePickerSheet";

export interface LogSessionTypeSwitcherProps {
  athleteId: string;
}

/**
 * Sits above the log-session wizard. Two pills, one of which is the active
 * Training surface (the wizard underneath); the other launches the
 * performance-test picker Sheet without leaving the page.
 *
 * Lightweight by design — the page should still feel like the training-log
 * page, with the test option as a clear lateral move.
 */
export function LogSessionTypeSwitcher({ athleteId }: LogSessionTypeSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="tablist"
        aria-label="What would you like to log?"
        className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--color-bg-surface-sunken)] w-fit mx-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-[var(--color-brand)] text-[var(--color-text-on-brand)] shadow-sm"
        >
          <Dumbbell size={14} strokeWidth={1.75} aria-hidden="true" />
          Training
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <Gauge size={14} strokeWidth={1.75} aria-hidden="true" />
          Performance test
        </button>
      </div>

      <TestTypePickerSheet open={open} onClose={() => setOpen(false)} athleteId={athleteId} />
    </>
  );
}
