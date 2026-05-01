import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryDayCard } from "../_history-day-card";
import type { HistoryDay } from "@/lib/throws/history-types";

const sampleDay: HistoryDay = {
  date: "2026-04-08",
  weekdayShort: "TUE",
  dateLabel: "Apr 8",
  events: ["SHOT_PUT"],
  totalThrows: 18,
  bestMarkOverall: 18.42,
  hasPR: true,
  drills: [
    {
      source: "free",
      event: "SHOT_PUT",
      implementKg: 7.26,
      implementLabel: "7.26kg",
      drillType: null,
      drillTypeLabel: null,
      throwCount: 18,
      bestMark: 18.42,
      isPersonalBest: true,
      bestThrowLogId: null, // legacy fixture — no per-throw data needed for these tests
      throws: [],
    },
  ],
  assignmentId: null,
  selfLoggedSessionId: null,
};

describe("HistoryDayCard", () => {
  it("renders collapsed with summary stats", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.getByText("TUE")).toBeInTheDocument();
    expect(screen.getByText("Apr 8")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Personal best/i)).toBeInTheDocument();
  });

  it("is not expanded by default", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("expands when tapped and shows drill rows", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Free log · 7\.26kg/)).toBeInTheDocument();
  });

  it("shows 'View full session' link when assigned", () => {
    const assignedDay: HistoryDay = { ...sampleDay, assignmentId: "asgn1" };
    render(<HistoryDayCard day={assignedDay} athleteId="ath_1" onDataChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue.*Apr 8/i }));
    expect(screen.getByRole("link", { name: /View full session/i })).toHaveAttribute(
      "href",
      "/athlete/throws/asgn1"
    );
  });

  it("shows 'Edit session' link for self-logged sessions", () => {
    const selfLoggedDay: HistoryDay = { ...sampleDay, selfLoggedSessionId: "sl1" };
    render(<HistoryDayCard day={selfLoggedDay} athleteId="ath_1" onDataChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue.*Apr 8/i }));
    expect(screen.getByRole("link", { name: /Edit session/i })).toHaveAttribute(
      "href",
      "/athlete/throws/log?edit=sl1"
    );
  });
});
