"use client";
import { InsightCard } from "./InsightCard";
import { InsightEmptyState } from "./InsightEmptyState";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insights: AthleteInsightWire[];
  role: "COACH" | "ATHLETE";
  athleteName?: string;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onShowEvidence?: (id: string) => void;
};

const CATEGORY_ORDER = ["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  TRAINING_PATTERN: "Training Patterns",
  LIFT_THROW: "Strength ↔ Throws",
  READINESS_COMPETITION: "Readiness ↔ Competition",
};

export function InsightList({
  insights,
  role,
  athleteName,
  onMarkRead,
  onDismiss,
  onShowEvidence,
}: Props) {
  if (insights.length === 0) {
    return <InsightEmptyState role={role} athleteName={athleteName} />;
  }

  const groups = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: insights.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            {CATEGORY_LABEL[group.category]}
          </h2>
          <div className="space-y-3">
            {group.items.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                role={role}
                onMarkRead={onMarkRead}
                onDismiss={onDismiss}
                onShowEvidence={onShowEvidence}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
