"use client";

import { PenLine, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { StepHeader } from "./_step-header";
import type { StepProps } from "./types";

/* ─── Component ──────────────────────────────────────────────────────────── */

export function NotesStep({ data, onChange, onNext, onBack }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader current={5} total={5} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-500/10 flex items-center justify-center shrink-0">
          <PenLine size={20} strokeWidth={1.75} className="text-surface-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] leading-tight">
            Notes
          </h2>
          <p className="text-caption text-muted leading-snug">
            Anything your coach should know? (Optional)
          </p>
        </div>
      </div>

      {/* ── Notes textarea ─────────────────────────────────────────────── */}
      <div>
        <textarea
          rows={4}
          placeholder="e.g., Tweaked my shoulder yesterday, taking it easy on overhead work..."
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={cn(
            "w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-sm",
            "text-[var(--foreground)] placeholder:text-muted/60",
            "focus-visible:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50",
            "resize-none transition-colors duration-150"
          )}
        />
      </div>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="lg"
          className="min-h-[48px] px-4"
          onClick={onBack}
          leftIcon={<ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Back
        </Button>

        {/* Skip — always visible */}
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 min-h-[48px] text-sm font-bold rounded-xl"
          onClick={onNext}
        >
          Skip
        </Button>

        {/* Submit — mobile: SlideToConfirm / desktop: Button */}
        <div className="flex-[2] sm:hidden">
          <SlideToConfirm label="Slide to Submit" onConfirm={onNext} variant="confirm" />
        </div>
        <Button
          variant="primary"
          size="lg"
          className="hidden sm:flex flex-[2] rounded-xl min-h-[48px] text-sm font-bold text-black"
          onClick={onNext}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
