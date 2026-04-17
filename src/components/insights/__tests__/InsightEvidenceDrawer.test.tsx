import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InsightEvidenceDrawer } from "../InsightEvidenceDrawer";
import type { AthleteInsightWire } from "@/lib/insights/types";

function fixture(overrides: Partial<AthleteInsightWire> = {}): AthleteInsightWire {
  return {
    id: "i1",
    athleteId: "a1",
    category: "LIFT_THROW",
    metric: "back_squat_1rm.hammer",
    event: "HAMMER",
    title: "Back Squat 1RM tracks with hammer distance",
    body: "body",
    detail: "detail",
    confidenceBand: "MEDIUM",
    dataPoints: 11,
    coefficient: 0.72,
    effectSize: 0.04,
    effectUnit: "meters per kg",
    evidence: { pairs: [{ windowStart: "2026-01-01", repMaxKg: 150, bestMarkM: 68 }] },
    readByCoachAt: null,
    readByAthleteAt: null,
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: "m1",
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("InsightEvidenceDrawer", () => {
  it("renders coefficient, effectSize, dataPoints, confidence band", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    expect(screen.getByText(/0\.72/)).toBeInTheDocument();
    expect(screen.getByText(/0\.04/)).toBeInTheDocument();
    expect(screen.getByText(/11/)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
    expect(screen.getByText(/meters per kg/i)).toBeInTheDocument();
  });

  it("renders pretty-printed evidence JSON", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    const pre = screen.getByTestId("evidence-json");
    expect(pre.textContent).toContain("repMaxKg");
    expect(pre.textContent).toContain("150");
  });

  it("onClose fires on close button click", () => {
    const onClose = vi.fn();
    render(<InsightEvidenceDrawer insight={fixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the insight title in the header", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    expect(screen.getByText(/Back Squat 1RM tracks/i)).toBeInTheDocument();
  });
});
