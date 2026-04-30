"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { TestTypeCard } from "./TestTypeCard";
import { TestCapture } from "./TestCapture";
import { logger } from "@/lib/logger";
import type {
  PerformanceTestSessionDTO,
  PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

export interface TestTypePickerSheetProps {
  open: boolean;
  onClose: () => void;
  athleteId: string;
  /** Refresh the dashboard tile / sessions list after completion. */
  onComplete?: (session: PerformanceTestSessionDTO | null) => void;
}

/**
 * Athlete picker Sheet — one bottom Sheet, two stages.
 *
 * Stage A: 2x2 grid of TestTypeCards.
 * Stage B: <TestCapture> for the picked test, with a "Back" affordance to
 * change test types before any attempts are recorded.
 */
export function TestTypePickerSheet({
  open,
  onClose,
  athleteId,
  onComplete,
}: TestTypePickerSheetProps) {
  const [picked, setPicked] = useState<PerformanceTestTypeDTO | null>(null);
  const [types, setTypes] = useState<PerformanceTestTypeDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPicked(null);
      return;
    }
    setLoading(true);
    fetch("/api/performance-tests/types")
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok || !payload.success) {
          throw new Error(payload.error || `Failed to load test types (${r.status})`);
        }
        setTypes(payload.data as PerformanceTestTypeDTO[]);
      })
      .catch((err) => {
        logger.error("performance-tests: types fetch failed", {
          context: "performance-tests/picker",
          error: err,
        });
      })
      .finally(() => setLoading(false));
  }, [open]);

  const title = picked ? picked.name : "Log a performance test";

  return (
    <Sheet open={open} onClose={onClose} side="bottom" size="lg" title={title}>
      {!picked ? (
        loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading tests…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No tests available.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-1 pb-2">
            {types.map((t) => (
              <TestTypeCard key={t.id} type={t} onSelect={setPicked} />
            ))}
          </div>
        )
      ) : (
        <div className="pb-2">
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="mb-3 text-xs font-semibold text-muted hover:text-[var(--foreground)] transition-colors"
          >
            ← Pick a different test
          </button>
          <TestCapture
            athleteId={athleteId}
            testType={picked}
            surface="athlete"
            onComplete={(session) => {
              onComplete?.(session);
            }}
            onClose={onClose}
          />
        </div>
      )}
    </Sheet>
  );
}
