"use client";

import { ChevronDown } from "lucide-react";
import type { HistoryFilter } from "@/lib/throws/history-types";
import type { FilterVariant } from "./_history-filter-sheet";

const RANGE_LABELS: Record<HistoryFilter["range"], string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  ytd: "Year to date",
  all: "All time",
  custom: "Custom",
};

const EVENT_SHORT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

interface Props {
  filter: HistoryFilter;
  onOpen: (variant: FilterVariant) => void;
  onClear: () => void;
  hasAnyActive: boolean;
}

export function HistoryFilterChips({ filter, onOpen, onClear, hasAnyActive }: Props) {
  const rangeLabel = RANGE_LABELS[filter.range];
  const eventLabel =
    filter.events.length === 0
      ? "Event"
      : filter.events.length === 1
        ? (EVENT_SHORT_LABELS[filter.events[0]] ?? filter.events[0])
        : `${filter.events.length} events`;
  const implementLabel =
    filter.implementsKg.length === 0
      ? "Implement"
      : filter.implementsKg.length === 1
        ? `${filter.implementsKg[0]}kg`
        : `${filter.implementsKg.length} impl`;

  return (
    <div
      className="relative flex gap-2 overflow-x-auto pb-1"
      style={{
        scrollbarWidth: "none",
        maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent)",
      }}
    >
      <FilterChip active={filter.range !== "30d"} onClick={() => onOpen("range")}>
        {rangeLabel}
      </FilterChip>
      <FilterChip active={filter.events.length > 0} onClick={() => onOpen("event")}>
        {eventLabel}
      </FilterChip>
      <FilterChip active={filter.implementsKg.length > 0} onClick={() => onOpen("implement")}>
        {implementLabel}
      </FilterChip>
      <FilterChip active={filter.prOnly} pr onClick={() => onOpen("pr")}>
        ★ PR
      </FilterChip>
      {hasAnyActive && (
        <button
          type="button"
          onClick={onClear}
          className="flex-shrink-0 px-3 py-2.5 rounded-full text-xs text-muted hover:text-[var(--foreground)] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function FilterChip({
  active,
  pr,
  onClick,
  children,
}: {
  active: boolean;
  pr?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-2.5 rounded-full border text-xs font-medium transition-colors ${
        active
          ? "bg-primary-500/15 border-primary-500/40 text-primary-500"
          : "bg-surface-100 dark:bg-surface-800 border-[var(--card-border)] text-surface-700 dark:text-surface-300 hover:border-[var(--card-border)]"
      }`}
    >
      {children}
      {!pr && <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
