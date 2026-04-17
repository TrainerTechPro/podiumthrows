import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionThrowsTable } from "../CompetitionThrowsTable";

const baseMeet = {
  id: "m1",
  athleteId: "a1",
  event: "SHOT_PUT",
  format: "THREE_PLUS_THREE" as const,
  madeFinals: false,
  result: null,
  name: "Test",
};

describe("CompetitionThrowsTable — base rendering", () => {
  it("renders 3 prelim rows for THREE_PLUS_THREE", () => {
    render(
      <CompetitionThrowsTable meet={baseMeet} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(3);
    expect(screen.queryAllByTestId(/^throw-row-FINALS-/)).toHaveLength(0);
  });

  it("shows finals section when madeFinals=true", () => {
    render(
      <CompetitionThrowsTable meet={{ ...baseMeet, madeFinals: true }} throws={[]} onSave={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getAllByTestId(/^throw-row-FINALS-/)).toHaveLength(3);
  });

  it("renders 4 rows for FOUR_STRAIGHT", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, format: "FOUR_STRAIGHT" }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^throw-row-PRELIM-/)).toHaveLength(4);
  });

  it("shows legacy banner when result != null and no throws", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId("legacy-banner")).toBeInTheDocument();
    expect(screen.getByText(/17.5m/)).toBeInTheDocument();
  });

  it("hides legacy banner when throws exist", () => {
    render(
      <CompetitionThrowsTable
        meet={{ ...baseMeet, result: 17.5 }}
        throws={[{ id: "t1", round: "PRELIM", attemptInRound: 1, distance: 18, isFoul: false, isPass: false, foulType: null, notes: null, videoUrl: null, wireLength: null }]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByTestId("legacy-banner")).toBeNull();
  });
});
