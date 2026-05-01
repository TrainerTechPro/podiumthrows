import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryDrillThrowsSheet } from "../_history-drill-throws-sheet";
import type { HistoryThrow } from "@/lib/throws/history-types";

const sampleThrows: HistoryThrow[] = [
  {
    id: "t1",
    throwNumber: 1,
    distance: 18.42,
    performedAt: "2026-04-08T14:30:00.000Z",
    isCompetition: false,
    isFoul: false,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
  {
    id: "t2",
    throwNumber: 2,
    distance: null,
    performedAt: "2026-04-08T14:35:00.000Z",
    isCompetition: false,
    isFoul: true,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
];

describe("HistoryDrillThrowsSheet", () => {
  it("renders one row per throw, in input order", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows distance for non-foul throws and a foul badge for fouls", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
    expect(screen.getByText(/FOUL/i)).toBeInTheDocument();
  });

  it("shows a PR star on the throw whose id matches bestThrowLogId", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    const stars = screen.getAllByLabelText(/personal best/i);
    expect(stars).toHaveLength(1);
  });

  it("calls onPickThrow with the tapped throw", () => {
    const onPickThrow = vi.fn();
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={onPickThrow}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /#1/i }));
    expect(onPickThrow).toHaveBeenCalledWith(sampleThrows[0]);
  });

  it("renders 'Free log' as the drill label when drillTypeLabel is null", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel={null}
        implementLabel="7.26kg"
        bestThrowLogId={null}
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText(/Free log · 7\.26kg/)).toBeInTheDocument();
  });
});
