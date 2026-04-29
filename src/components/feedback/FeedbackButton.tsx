"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCirclePlus } from "lucide-react";
import { FeedbackSheet } from "./FeedbackSheet";
import { isFocusMode } from "@/components/layout/DashboardLayout";

export interface FeedbackButtonProps {
  role: "ATHLETE" | "COACH";
}

/**
 * Persistent feedback FAB. Athlete uses bottom Sheet (thumb-zone), coach
 * uses right Sheet (desk register) — per CLAUDE.md §Dual Product Identity.
 *
 * Hidden on focus-mode routes (log-session, onboarding wizards) and on the
 * coach sideline mobile view, where it would compete with task-specific
 * floating UI. Auth + marketing routes don't render DashboardLayout, so
 * the FAB is naturally absent there.
 */
export function FeedbackButton({ role }: FeedbackButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (isFocusMode(pathname)) return null;
  if (pathname?.startsWith("/coach/sideline")) return null;

  // Athlete needs to clear the BottomTabBar (≈64px + safe-area). Coach has
  // no bottom tabs so it sits at the standard 5/4 anchor.
  const positionClass =
    role === "ATHLETE"
      ? "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4"
      : "bottom-5 right-4 md:bottom-6 md:right-6";

  const sheetSide = role === "ATHLETE" ? "bottom" : "right";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        data-feedback-overlay="true"
        className={[
          "fixed z-40 inline-flex items-center justify-center",
          "h-12 w-12 rounded-full",
          "bg-primary-500 text-surface-950",
          "shadow-lg shadow-primary-500/30",
          "hover:bg-primary-400 active:scale-[0.95]",
          "transition-[transform,background-color] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          positionClass,
        ].join(" ")}
      >
        <MessageCirclePlus size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      <FeedbackSheet open={open} onClose={() => setOpen(false)} side={sheetSide} />
    </>
  );
}
