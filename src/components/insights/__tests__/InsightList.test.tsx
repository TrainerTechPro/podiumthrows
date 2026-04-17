import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightList } from "../InsightList";
import type { AthleteInsightWire } from "@/lib/insights/types";

function row(
  overrides: Partial<AthleteInsightWire> & Pick<AthleteInsightWire, "id" | "category">
): AthleteInsightWire {
  return {
    athleteId: "a1",
    metric: "m",
    event: null,
    title: `Title ${overrides.id}`,
    body: "body",
    detail: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    readByCoachAt: null,
    readByAthleteAt: "2026-04-01T00:00:00.000Z",
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: null,
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("InsightList", () => {
  it("renders EmptyState when insights is empty", () => {
    render(<InsightList insights={[]} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/No insights yet/i)).toBeInTheDocument();
  });

  it("renders section headers only for non-empty categories", () => {
    render(
      <InsightList
        insights={[
          row({ id: "t1", category: "TRAINING_PATTERN" }),
          row({ id: "l1", category: "LIFT_THROW" }),
        ]}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/Training Patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength ↔ Throws/i)).toBeInTheDocument();
    expect(screen.queryByText(/Readiness ↔ Competition/i)).toBeNull();
  });

  it("groups cards under their category headers", () => {
    render(
      <InsightList
        insights={[
          row({ id: "t1", category: "TRAINING_PATTERN" }),
          row({ id: "t2", category: "TRAINING_PATTERN" }),
          row({ id: "l1", category: "LIFT_THROW" }),
          row({ id: "r1", category: "READINESS_COMPETITION" }),
        ]}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/insight-card-/)).toHaveLength(4);
    expect(screen.getByText(/Training Patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength ↔ Throws/i)).toBeInTheDocument();
    expect(screen.getByText(/Readiness ↔ Competition/i)).toBeInTheDocument();
  });
});
