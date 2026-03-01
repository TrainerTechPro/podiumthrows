"use client";

import { useState, useEffect } from "react";

const STEPS = [
  { label: "Validating athlete profile...", delayMs: 200 },
  { label: "Planning training phases...", delayMs: 600 },
  { label: "Building exercise complexes...", delayMs: 1200 },
  { label: "Scaling volumes to athlete profile...", delayMs: 1800 },
  { label: "Assembling macrocycle...", delayMs: 2400 },
] as const;

export function GeneratingOverlay({ isGenerating }: { isGenerating: boolean }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setActiveStep(0);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < STEPS.length; i++) {
      timers.push(
        setTimeout(() => setActiveStep(i + 1), STEPS[i].delayMs),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [isGenerating]);

  if (!isGenerating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl bg-surface-900/95 border border-surface-700 shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-500"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Generating Program
            </h3>
            <p className="text-xs text-surface-400">
              Building your Bondarchuk training plan
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isComplete = activeStep > stepNum;
            const isActive = activeStep === stepNum;
            const isPending = activeStep < stepNum;
            const isLast = i === STEPS.length - 1;

            return (
              <div key={i} className="flex items-center gap-3">
                {/* Status indicator */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isComplete ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary-500"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isActive ? (
                    isLast ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-primary-500 animate-spin"
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse" />
                    )
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-surface-600" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    isComplete
                      ? "text-surface-400"
                      : isActive
                        ? "text-[var(--foreground)] font-medium"
                        : "text-surface-600"
                  }`}
                >
                  {step.label}
                </span>

                {/* Progress line for active non-last steps */}
                {isActive && !isLast && !isPending && (
                  <div className="flex-1 h-0.5 rounded-full bg-surface-700 overflow-hidden ml-1">
                    <div className="h-full bg-primary-500/60 rounded-full animate-pulse w-3/4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom progress bar */}
        <div className="mt-5 h-1 rounded-full bg-surface-700 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, (activeStep / STEPS.length) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
