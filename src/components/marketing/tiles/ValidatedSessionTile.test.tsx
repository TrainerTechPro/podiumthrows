import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidatedSessionTile } from "./ValidatedSessionTile";

describe("ValidatedSessionTile", () => {
  it("renders without crashing", () => {
    render(<ValidatedSessionTile />);
  });

  it("shows the valid-session status", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText(/VALID/)).toBeInTheDocument();
  });

  it("cites Vol IV in the footer", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText(/Vol IV/)).toBeInTheDocument();
  });

  it("shows the descending implement sequence (9kg → 7.26kg → 6kg)", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText("9kg shot")).toBeInTheDocument();
    expect(screen.getByText("7.26kg shot")).toBeInTheDocument();
    expect(screen.getByText("6kg shot")).toBeInTheDocument();
  });
});
