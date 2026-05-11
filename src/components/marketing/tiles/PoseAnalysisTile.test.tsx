import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoseAnalysisTile } from "./PoseAnalysisTile";

describe("PoseAnalysisTile", () => {
  it("renders without crashing", () => {
    render(<PoseAnalysisTile />);
  });

  it("shows the release-frame overline and timestamp", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/Release frame/i)).toBeInTheDocument();
    expect(screen.getByText(/00:02\.47/)).toBeInTheDocument();
  });

  it("shows three throws-specific measurements", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/Trunk lean/i)).toBeInTheDocument();
    expect(screen.getByText(/Release angle/i)).toBeInTheDocument();
    expect(screen.getByText(/Knee drive/i)).toBeInTheDocument();
  });

  it("shows target-range subtitles", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/target 30–35/)).toBeInTheDocument();
    expect(screen.getByText(/target 38–42/)).toBeInTheDocument();
    expect(screen.getByText(/target 130–140/)).toBeInTheDocument();
  });
});
