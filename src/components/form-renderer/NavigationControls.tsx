"use client";

import { Button } from "@/components/ui/Button";

interface NavigationControlsProps {
  showPrev: boolean;
  showNext: boolean;
  showSubmit: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  nextLabel?: string;
}

export function NavigationControls({
  showPrev,
  showNext,
  showSubmit,
  canSubmit,
  submitting,
  onPrev,
  onNext,
  onSubmit,
  nextLabel = "Next",
}: NavigationControlsProps) {
  return (
    <div className="flex items-center justify-between pt-4">
      <div>
        {showPrev && (
          <Button variant="ghost" onClick={onPrev}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showNext && (
          <Button onClick={onNext}>
            {nextLabel}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-1"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Button>
        )}

        {showSubmit && (
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
