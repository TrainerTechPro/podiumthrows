"use client";

import { TestIcon } from "./test-icon";
import type { PerformanceTestTypeDTO } from "@/lib/performance-tests-display";

export interface TestTypeCardProps {
  type: PerformanceTestTypeDTO;
  onSelect: (type: PerformanceTestTypeDTO) => void;
}

/**
 * Stage A grid card. Tapping picks the test type and advances the picker
 * Sheet to Stage B. Built for thumb-zone capture, generous tap target.
 */
export function TestTypeCard({ type, onSelect }: TestTypeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className="card card-interactive p-4 flex flex-col items-start gap-3 min-h-[112px] text-left w-full"
    >
      <span className="rounded-lg bg-primary-500/10 text-primary-500 p-2">
        <TestIcon iconKey={type.iconKey} size={22} />
      </span>
      <div className="min-w-0">
        <h3 className="font-heading text-base font-semibold text-[var(--foreground)] truncate">
          {type.name}
        </h3>
        <p className="text-xs text-muted mt-0.5 tabular-nums">
          {type.unit === "cm" ? "Higher is better, cm" : "Lower is better, sec"}
        </p>
      </div>
    </button>
  );
}
