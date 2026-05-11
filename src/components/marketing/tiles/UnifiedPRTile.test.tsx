import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedPRTile } from "./UnifiedPRTile";

describe("UnifiedPRTile", () => {
  it("renders without crashing", () => {
    render(<UnifiedPRTile />);
  });

  it("shows the athlete name and sub-line", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText("Marcus Johnson")).toBeInTheDocument();
    expect(screen.getByText(/SHOT PUT/)).toBeInTheDocument();
  });

  it("shows three implement weights with their distances", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText("6 KG")).toBeInTheDocument();
    expect(screen.getByText("7.26 KG")).toBeInTheDocument();
    expect(screen.getByText("8 KG")).toBeInTheDocument();
    expect(screen.getByText("19.42m")).toBeInTheDocument();
    expect(screen.getByText("18.05m")).toBeInTheDocument();
    expect(screen.getByText("17.20m")).toBeInTheDocument();
  });

  it("includes the catalog-keyed footer", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText(/Catalog-keyed/)).toBeInTheDocument();
  });
});
