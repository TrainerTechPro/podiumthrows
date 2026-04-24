"use client";
import { Sheet } from "@/components/ui/Sheet";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insight: AthleteInsightWire;
  onClose: () => void;
};

/**
 * Coach-side evidence drawer for athlete insights. Renders via the shared
 * <Sheet> primitive (side="right" per Dual Product Identity — coach desk
 * register). Focus trap, Escape close, click-outside close, body scroll
 * lock, role=dialog, and --surface-overlay background are all provided by
 * Sheet. Caller controls mount/unmount via a truthy `insight`.
 */
export function InsightEvidenceDrawer({ insight, onClose }: Props) {
  const coefficientLabel = "Pearson r";
  const evidenceJson = JSON.stringify(insight.evidence, null, 2);

  return (
    <Sheet open onClose={onClose} side="right" size="lg" title={`Evidence for ${insight.title}`}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
    </Sheet>
  );
}
