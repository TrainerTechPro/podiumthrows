"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insight: AthleteInsightWire;
  onClose: () => void;
};

export function InsightEvidenceDrawer({ insight, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const coefficientLabel = "Pearson r";
  const evidenceJson = JSON.stringify(insight.evidence, null, 2);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-evidence-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[var(--surface-overlay)] p-6 shadow-2xl sm:inset-x-auto sm:right-6 sm:top-20 sm:bottom-auto sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <h2 id="insight-evidence-title" className="font-heading text-lg">
            Evidence for {insight.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">{coefficientLabel}</dt>
            <dd className="font-mono tabular-nums">{insight.coefficient?.toFixed(2) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Effect size</dt>
            <dd className="font-mono tabular-nums">
              {insight.effectSize != null ? insight.effectSize.toFixed(4) : "—"}
              {insight.effectUnit ? ` ${insight.effectUnit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Data points</dt>
            <dd className="font-mono tabular-nums">{insight.dataPoints}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Confidence band</dt>
            <dd>{insight.confidenceBand}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Trigger</dt>
            <dd>{insight.triggerKind}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Computed at</dt>
            <dd className="font-mono tabular-nums text-xs">
              {new Date(insight.computedAt).toLocaleString()}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted">Evidence data</div>
          <pre
            data-testid="evidence-json"
            className="mt-2 max-h-80 overflow-auto rounded bg-surface-100 p-3 font-mono text-xs dark:bg-surface-900"
          >
            {evidenceJson}
          </pre>
        </div>
      </div>
    </>
  );
}
