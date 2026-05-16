"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Minus,
  Check,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { StepHeader } from "./_step-header";
import type { StepProps, CheckinData } from "./types";

/* ─── Option types ───────────────────────────────────────────────────────── */

type HydrationValue = CheckinData["hydration"];
type InjuryValue = CheckinData["injuryStatus"];

interface CardOption<T extends string> {
  value: T;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}

/* ─── Option data ────────────────────────────────────────────────────────── */

const hydrationOptions: CardOption<HydrationValue>[] = [
  {
    value: "POOR",
    label: "Poor",
    icon: <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-red-500",
    borderClass: "border-red-500/60",
    bgClass: "bg-red-500/10",
  },
  {
    value: "ADEQUATE",
    label: "Adequate",
    icon: <Minus size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-yellow-500",
    borderClass: "border-yellow-500/60",
    bgClass: "bg-yellow-500/10",
  },
  {
    value: "GOOD",
    label: "Good",
    icon: <Check size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/60",
    bgClass: "bg-emerald-500/10",
  },
];

const injuryOptions: CardOption<InjuryValue>[] = [
  {
    value: "NONE",
    label: "None",
    icon: <CheckCircle size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-emerald-500",
    borderClass: "border-emerald-500/60",
    bgClass: "bg-emerald-500/10",
  },
  {
    value: "MONITORING",
    label: "Monitoring",
    icon: <Eye size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-amber-500",
    borderClass: "border-amber-500/60",
    bgClass: "bg-amber-500/10",
  },
  {
    value: "ACTIVE",
    label: "Active",
    icon: <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />,
    colorClass: "text-red-500",
    borderClass: "border-red-500/60",
    bgClass: "bg-red-500/10",
  },
];

/* ─── Tappable Card ──────────────────────────────────────────────────────── */

function TappableCard<T extends string>({
  option,
  selected,
  onSelect,
}: {
  option: CardOption<T>;
  selected: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={cn(
        "flex-1 flex flex-col items-center gap-2 rounded-xl border p-3 min-h-[56px]",
        "transition-all duration-150",
        selected
          ? cn(option.borderClass, option.bgClass)
          : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50"
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center",
          selected ? option.bgClass : "bg-surface-100 dark:bg-surface-800"
        )}
      >
        <span className={selected ? option.colorClass : "text-muted"}>{option.icon}</span>
      </div>
      <span className={cn("text-xs font-semibold", selected ? option.colorClass : "text-muted")}>
        {option.label}
      </span>
    </button>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function QuickChecksStep({ data, onChange, onNext, onBack }: StepProps) {
  const showInjuryNotes = data.injuryStatus === "MONITORING" || data.injuryStatus === "ACTIVE";
  const [mounted, setMounted] = useState(showInjuryNotes);
  const notesRef = useRef<HTMLDivElement>(null);

  /* Animate injury notes in/out */
  useEffect(() => {
    if (showInjuryNotes) {
      setMounted(true);
    } else {
      // Let the exit animation play, then unmount
      const timeout = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [showInjuryNotes]);

  return (
    <div className="flex flex-col gap-6">
      <StepHeader current={4} total={5} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <CheckCircle
            size={20}
            strokeWidth={1.75}
            className="text-emerald-500"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] leading-tight">
            Quick Checks
          </h2>
          <p className="text-caption text-muted leading-snug">Tap to select</p>
        </div>
      </div>

      {/* ── Hydration ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">Hydration</p>
        <div className="flex gap-3">
          {hydrationOptions.map((opt) => (
            <TappableCard
              key={opt.value}
              option={opt}
              selected={data.hydration === opt.value}
              onSelect={(v) => onChange({ hydration: v })}
            />
          ))}
        </div>
      </div>

      {/* ── Injury Status ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">Injury Status</p>
        <div className="flex gap-3">
          {injuryOptions.map((opt) => (
            <TappableCard
              key={opt.value}
              option={opt}
              selected={data.injuryStatus === opt.value}
              onSelect={(v) => onChange({ injuryStatus: v })}
            />
          ))}
        </div>
      </div>

      {/* ── Injury Notes (progressive disclosure) ────────────────────── */}
      {mounted && (
        <div
          ref={notesRef}
          className={cn(
            "transition-all duration-200 overflow-hidden",
            showInjuryNotes ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <div className="space-y-2">
            <label
              htmlFor="injury-notes"
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              Injury Notes
            </label>
            <textarea
              id="injury-notes"
              rows={3}
              placeholder="Describe the injury..."
              value={data.injuryNotes}
              onChange={(e) => onChange({ injuryNotes: e.target.value })}
              className={cn(
                "w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 text-sm",
                "text-[var(--foreground)] placeholder:text-muted/60",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50",
                "resize-none transition-all duration-150"
              )}
            />
          </div>
        </div>
      )}

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

        <Button
          variant="primary"
          size="lg"
          className="flex-1 rounded-xl min-h-[48px] text-sm font-bold text-black"
          onClick={onNext}
          rightIcon={<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
