import React, { type ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { HistoryDrillRow } from "../_history-drill-row";
import type { HistoryDrill, HistoryThrow } from "@/lib/throws/history-types";

// EditThrowSheet (rendered when best-mark is tapped) calls useToast(),
// which throws unless wrapped in ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const baseThrows: HistoryThrow[] = [
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
    distance: 18.1,
    performedAt: "2026-04-08T14:35:00.000Z",
    isCompetition: false,
    isFoul: false,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
];

const drillEditable: HistoryDrill = {
  source: "free",
  event: "SHOT_PUT",
  implementKg: 7.26,
  implementLabel: "7.26kg",
  drillType: null,
  drillTypeLabel: null,
  throwCount: 2,
  bestMark: 18.42,
  isPersonalBest: true,
  bestThrowLogId: "t1",
  throws: baseThrows,
};

describe("HistoryDrillRow", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders best-mark as a button when bestThrowLogId is set", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Edit best throw/i })).toBeInTheDocument();
  });

  it("renders best-mark as static text when bestThrowLogId is null", () => {
    const drill = { ...drillEditable, bestThrowLogId: null };
    renderWithToast(<HistoryDrillRow drill={drill} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.queryByRole("button", { name: /Edit best throw/i })).not.toBeInTheDocument();
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
  });

  it("renders 'all N throws' link when throws.length > 1", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    expect(screen.getByRole("button", { name: /all 2 throws/i })).toBeInTheDocument();
  });

  it("does not render 'all N throws' link for single-throw drills", () => {
    const drill = { ...drillEditable, throwCount: 1, throws: [baseThrows[0]] };
    renderWithToast(<HistoryDrillRow drill={drill} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.queryByRole("button", { name: /all \d+ throws/i })).not.toBeInTheDocument();
  });

  it("shows 'all N throws' even when bestThrowLogId is null (foul-only drills)", () => {
    const foulOnly = {
      ...drillEditable,
      bestThrowLogId: null,
      throws: baseThrows.map((t) => ({ ...t, isFoul: true })),
    };
    renderWithToast(
      <HistoryDrillRow drill={foulOnly} athleteId="ath_1" onDataChanged={() => {}} />
    );
    expect(screen.getByRole("button", { name: /all 2 throws/i })).toBeInTheDocument();
  });

  it("opens the throws sub-sheet when 'all N throws' is tapped", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /all 2 throws/i }));
    // sub-sheet renders rows
    expect(screen.getByRole("button", { name: /Edit throw #1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit throw #2/i })).toBeInTheDocument();
  });

  it("opens EditThrowSheet for the best throw when best-mark is tapped", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit best throw/i }));
    // EditThrowSheet renders an "Edit throw" title via the Sheet primitive
    expect(screen.getAllByText(/Edit throw/i).length).toBeGreaterThan(0);
  });
});
