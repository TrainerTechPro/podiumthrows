"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProgressBar, Button } from "@/components";
import type { OnboardingGuide } from "@/lib/data/athlete";

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface WelcomeCardProps {
  firstName: string;
  guide: OnboardingGuide;
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function CheckCircle({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-6 h-6 rounded-full border-2 border-primary-400 dark:border-primary-500 shrink-0 relative">
      <div className="absolute inset-0 rounded-full border-2 border-primary-400 dark:border-primary-500 animate-ping opacity-20" />
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function WelcomeCard({ firstName, guide }: WelcomeCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !guide.showGuide) return null;

  function handleDismiss() {
    setDismissed(true);
  }

  const pct = (guide.completedCount / guide.totalSteps) * 100;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-amber-500 px-6 py-5 sm:px-8">
        <h2 className="text-lg sm:text-xl font-bold font-heading text-white">
          Great start, {firstName}! Here&apos;s what to do next.
        </h2>
        <p className="text-sm text-white/80 mt-0.5">
          Complete these to get the most from Podium Throws.
        </p>
      </div>

      {/* Progress */}
      <div className="px-6 sm:px-8 pt-5">
        <ProgressBar
          value={pct}
          variant="primary"
          size="sm"
          showLabel
          label={`${guide.completedCount} of ${guide.totalSteps} complete`}
          animate
        />
      </div>

      {/* Steps */}
      <div className="px-6 sm:px-8 py-4 space-y-1">
        {guide.steps.map((step) => {
          const isCurrent = !step.completed;
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                isCurrent && "bg-primary-50 dark:bg-primary-500/5 border border-primary-200 dark:border-primary-500/20",
                step.completed && "opacity-70"
              )}
            >
              <CheckCircle done={step.completed} />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.completed
                      ? "text-surface-500 dark:text-surface-400 line-through"
                      : "text-[var(--foreground)]"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{step.description}</p>
              </div>
              <div className="shrink-0">
                {step.completed ? (
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    Done
                  </span>
                ) : (
                  <Link href={step.href}>
                    <Button variant="primary" size="sm">
                      Go
                      <ArrowRightIcon />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 sm:px-8 pb-5 flex items-center justify-between border-t border-[var(--card-border)] pt-3">
        <button
          onClick={handleDismiss}
          className="text-sm text-muted hover:text-[var(--foreground)] transition-colors"
        >
          Dismiss — I&apos;ll explore on my own
        </button>
        <button
          onClick={() => router.push("/athlete/throws")}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          Explore Throws &rarr;
        </button>
      </div>
    </div>
  );
}
