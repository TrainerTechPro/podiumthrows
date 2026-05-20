"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { logger } from "@/lib/logger";
import { TestTypePickerSheet } from "./TestTypePickerSheet";
import { TestIcon } from "./test-icon";
import {
  type PerformanceTestSessionDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";
import { useTestValueFormatter } from "@/lib/units/test-format";

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
  const [reloadKey, setReloadKey] = useState(0);
  const formatValue = useTestValueFormatter();
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const res = await fetch(`/api/performance-tests/athletes/${athleteId}/sessions?limit=20`, {
          signal: ctrl.signal,
        });

        // 401 during a brief session gap (sign-out, token refresh, etc.) is
        // expected — render the empty/auth state instead of logging an error.
        // Fixes PODIUM-THROWS-18.
        if (res.status === 401) {
          if (ctrl.signal.aborted) return;
          setState(null);
          return;
        }

        const payload = await res.json();
        if (ctrl.signal.aborted) return;
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "Couldn’t load tests");
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
        if (ctrl.signal.aborted) return;
        // Network-level fetch failure during navigation (user left the page
        // before response arrived). The browser cancels the request before
        // React unmounts the component, so signal.aborted is still false.
        // Not actionable — don't log to Sentry.
        if (err instanceof TypeError) return;
        logger.error("performance-tests: tile load failed", {
          context: "performance-tests/tile",
          error: err,
        });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => ctrl.abort();
  }, [athleteId, reloadKey]);

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
              Start a benchmark
            </h3>
            <p className="text-xs text-muted mt-1">
              Capture one jump, sprint, or throw-adjacent test. Trends unlock after the next check.
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
          onComplete={reload}
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
  const trendLabel =
    delta == null
      ? "Add one more capture to call the trend."
      : improved
        ? "Moving in the right direction."
        : "Watch this marker next session.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card card-interactive w-full p-5 text-left flex items-start justify-between gap-4 rounded-2xl"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <TestIcon iconKey={testType.iconKey} size={12} />
            Latest test signal
          </div>
          <p className="mt-1 truncate text-sm font-medium text-[var(--muted)]">{testType.name}</p>
          <div className="font-mono tabular-nums text-2xl font-semibold text-[var(--foreground)] mt-1">
            {current.peakValue != null ? formatValue(current.peakValue, testType) : "—"}
          </div>
          {delta != null && TrendIcon ? (
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
          ) : (
            <p className="mt-1 text-xs text-muted">{trendLabel}</p>
          )}
          {delta != null && <p className="mt-2 text-xs leading-snug text-muted">{trendLabel}</p>}
        </div>
        <span className="rounded-full bg-primary-500/10 text-primary-500 p-2 shrink-0">
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
      <TestTypePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        athleteId={athleteId}
        onComplete={reload}
      />
    </>
  );
}
