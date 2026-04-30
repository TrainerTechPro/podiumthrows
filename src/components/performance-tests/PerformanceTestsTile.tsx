"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { logger } from "@/lib/logger";
import { TestTypePickerSheet } from "./TestTypePickerSheet";
import { TestIcon } from "./test-icon";
import {
  formatTestValueShort,
  type PerformanceTestSessionDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

export interface PerformanceTestsTileProps {
  athleteId: string;
}

interface TileState {
  testType: PerformanceTestTypeDTO;
  current: PerformanceTestSessionDTO;
  previous: PerformanceTestSessionDTO | null;
}

/**
 * Athlete dashboard tile. Empty state nudges first log; populated state shows
 * the most recent session's peak with a delta vs the prior session for the
 * same test type.
 *
 * Tapping anywhere opens the bottom-Sheet picker.
 */
export function PerformanceTestsTile({ athleteId }: PerformanceTestsTileProps) {
  const [state, setState] = useState<TileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/performance-tests/athletes/${athleteId}/sessions?limit=20`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load tests");
      }
      const items = (payload.data?.items ?? []) as PerformanceTestSessionDTO[];
      if (!items.length) {
        setState(null);
        return;
      }
      const latest = items[0];
      const prior =
        items.find((s) => s.id !== latest.id && s.testTypeId === latest.testTypeId) ?? null;
      if (!latest.testType) {
        setState(null);
        return;
      }
      setState({
        testType: latest.testType,
        current: latest,
        previous: prior,
      });
    } catch (err) {
      logger.error("performance-tests: tile load failed", {
        context: "performance-tests/tile",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // load is stable in this scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  if (loading) {
    return (
      <button
        type="button"
        className="card w-full p-5 text-left opacity-70"
        aria-busy="true"
        disabled
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Performance tests
        </div>
        <div className="mt-2 h-7 w-2/3 rounded bg-surface-200/50 dark:bg-surface-800/50 shimmer" />
      </button>
    );
  }

  if (!state) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="card card-interactive w-full p-5 text-left flex items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Performance tests
            </div>
            <h3 className="font-heading text-base font-semibold text-[var(--foreground)] mt-1">
              Log your first test
            </h3>
            <p className="text-xs text-muted mt-1">
              Vertical jump, broad jump, sprints. Multi-attempt capture with peak + average.
            </p>
          </div>
          <span className="rounded-full bg-primary-500/10 text-primary-500 p-2 shrink-0">
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </button>
        <TestTypePickerSheet
          open={open}
          onClose={() => setOpen(false)}
          athleteId={athleteId}
          onComplete={() => void load()}
        />
      </>
    );
  }

  const { testType, current, previous } = state;
  const delta =
    current.peakValue != null && previous?.peakValue != null
      ? current.peakValue - previous.peakValue
      : null;
  const improved = delta != null ? (testType.lowerIsBetter ? delta < 0 : delta > 0) : null;
  const TrendIcon = improved == null ? null : improved ? TrendingUp : TrendingDown;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card card-interactive w-full p-5 text-left flex items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <TestIcon iconKey={testType.iconKey} size={12} />
            {testType.name}
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[var(--foreground)] mt-1">
            {current.peakValue != null
              ? formatTestValueShort(current.peakValue, testType.unit)
              : "—"}
          </div>
          {delta != null && TrendIcon && (
            <div
              className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${
                improved ? "text-success-500" : "text-warning-600 dark:text-warning-400"
              }`}
            >
              <TrendIcon size={12} strokeWidth={2} aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {delta > 0 ? "+" : ""}
                {delta.toFixed(testType.unit === "sec" ? 2 : 1)} {testType.unit}
              </span>
              <span className="text-muted">vs prior</span>
            </div>
          )}
        </div>
        <span className="rounded-full bg-primary-500/10 text-primary-500 p-2 shrink-0">
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
      <TestTypePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        athleteId={athleteId}
        onComplete={() => void load()}
      />
    </>
  );
}
