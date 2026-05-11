import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoreInProductStrip } from "./MoreInProductStrip";

describe("MoreInProductStrip", () => {
  it("renders without crashing", () => {
    render(<MoreInProductStrip />);
  });

  it("shows the overline", () => {
    render(<MoreInProductStrip />);
    expect(screen.getByText(/More in the product/i)).toBeInTheDocument();
  });

  it("lists the five remaining features", () => {
    render(<MoreInProductStrip />);
    expect(screen.getByText(/Athlete profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Questionnaire builder/i)).toBeInTheDocument();
    expect(screen.getByText(/Event groups/i)).toBeInTheDocument();
    expect(screen.getByText(/Practice tools/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance analytics/i)).toBeInTheDocument();
  });
});
