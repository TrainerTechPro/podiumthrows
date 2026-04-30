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

export interface CoachTestCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName?: string;
  /** Pre-pick a specific test type (skip Stage A) — used when launched from a
   *  trend view that's already scoped. */
  initialTestTypeKey?: string;
  onComplete?: (session: PerformanceTestSessionDTO | null) => void;
}

/**
 * Coach right-side Sheet wrapping <TestCapture>. Coach surface, so the inner
 * component renders identically to the athlete version modulo toast variant
 * (quiet success, no celebration theatrics).
 */
export function CoachTestCaptureSheet({
  open,
  onClose,
  athleteId,
  athleteName,
  initialTestTypeKey,
  onComplete,
}: CoachTestCaptureSheetProps) {
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
        const list = payload.data as PerformanceTestTypeDTO[];
        setTypes(list);
        if (initialTestTypeKey) {
          const match = list.find((t) => t.key === initialTestTypeKey);
          if (match) setPicked(match);
        }
      })
      .catch((err) => {
        logger.error("performance-tests: types fetch failed", {
          context: "performance-tests/coach-sheet",
          error: err,
        });
      })
      .finally(() => setLoading(false));
  }, [open, initialTestTypeKey]);

  const title = picked
    ? `${picked.name}${athleteName ? ` · ${athleteName}` : ""}`
    : athleteName
      ? `Log a test · ${athleteName}`
      : "Log a performance test";

  return (
    <Sheet open={open} onClose={onClose} side="right" size="md" title={title}>
      {!picked ? (
        loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading tests…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No tests available.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {types.map((t) => (
              <TestTypeCard key={t.id} type={t} onSelect={setPicked} />
            ))}
          </div>
        )
      ) : (
        <div>
          {!initialTestTypeKey && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="mb-3 text-xs font-semibold text-muted hover:text-[var(--foreground)] transition-colors"
            >
              ← Pick a different test
            </button>
          )}
          <TestCapture
            athleteId={athleteId}
            testType={picked}
            surface="coach"
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
