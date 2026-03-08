"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const HINTS_KEY = "podium-coach-hints-seen";

interface Hint {
  id: string;
  title: string;
  description: string;
  position: "top" | "bottom";
}

const HINTS: Hint[] = [
  {
    id: "activity",
    title: "Activity Feed",
    description:
      "Check-ins, completed sessions, and new PRs from your athletes appear here in real time.",
    position: "bottom",
  },
  {
    id: "flagged",
    title: "Needs Attention",
    description:
      "Athletes with low readiness scores, injuries, or missed sessions get flagged here automatically.",
    position: "bottom",
  },
  {
    id: "readiness",
    title: "Team Readiness",
    description:
      "Track your team's 7-day readiness trends to spot fatigue patterns before they become injuries.",
    position: "top",
  },
];

export function FirstVisitHints() {
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(HINTS_KEY);
    if (!seen) {
      // Small delay so the page renders first
      const timer = setTimeout(() => {
        setCurrentIdx(0);
        setVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleNext() {
    if (currentIdx < HINTS.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    setVisible(false);
    try { localStorage.setItem(HINTS_KEY, "true"); } catch {}
  }

  if (!visible || currentIdx < 0) return null;

  const hint = HINTS[currentIdx];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-auto transition-opacity"
        onClick={handleDismiss}
      />

      {/* Floating hint card */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto w-full max-w-md px-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl p-5 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <span className="text-xs font-medium text-muted">
                {currentIdx + 1} of {HINTS.length}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-xs text-muted hover:text-[var(--foreground)] transition-colors"
            >
              Skip tour
            </button>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-sm font-bold font-heading text-[var(--foreground)]">
              {hint.title}
            </h3>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              {hint.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              {HINTS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === currentIdx
                      ? "bg-primary-500"
                      : i < currentIdx
                      ? "bg-primary-300 dark:bg-primary-600"
                      : "bg-surface-200 dark:bg-surface-700"
                  )}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="text-sm font-semibold text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {currentIdx < HINTS.length - 1 ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
