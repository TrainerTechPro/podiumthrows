import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "../DateInput";

describe("DateInput", () => {
  it("renders empty when value is null", () => {
    render(<DateInput value={null} onChange={() => {}} label="DOB" />);
    expect(screen.getByLabelText("DOB")).toHaveValue("");
  });

  it("renders the ISO date string when value is set", () => {
    render(<DateInput value="2026-05-04" onChange={() => {}} label="DOB" />);
    expect(screen.getByLabelText("DOB")).toHaveValue("2026-05-04");
  });

  it("fires onChange with the new ISO date string", () => {
    const onChange = vi.fn();
    render(<DateInput value={null} onChange={onChange} label="DOB" />);
    fireEvent.change(screen.getByLabelText("DOB"), { target: { value: "2026-05-04" } });
    expect(onChange).toHaveBeenCalledWith("2026-05-04");
  });

  it("fires onChange(null) when the value is cleared", () => {
    const onChange = vi.fn();
    render(<DateInput value="2026-05-04" onChange={onChange} label="DOB" />);
    fireEvent.change(screen.getByLabelText("DOB"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders error message and aria-invalid", () => {
    render(<DateInput value={null} onChange={() => {}} label="DOB" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("DOB")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<DateInput value={null} onChange={() => {}} label="DOB" helper="MM/DD/YYYY" />);
    expect(screen.getByText("MM/DD/YYYY")).toBeInTheDocument();
  });

  it("renders required asterisk", () => {
    render(<DateInput value={null} onChange={() => {}} label="DOB" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("respects disabled — does not fire onChange", () => {
    const onChange = vi.fn();
    render(<DateInput value={null} onChange={onChange} label="DOB" disabled />);
    const input = screen.getByLabelText("DOB");
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "2026-05-04" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards min/max to the native input", () => {
    render(
      <DateInput value={null} onChange={() => {}} label="Date" min="2025-01-01" max="2026-12-31" />
    );
    const input = screen.getByLabelText("Date");
    expect(input).toHaveAttribute("min", "2025-01-01");
    expect(input).toHaveAttribute("max", "2026-12-31");
  });

  it("uses type=date by default", () => {
    render(<DateInput value={null} onChange={() => {}} label="DOB" />);
    expect(screen.getByLabelText("DOB")).toHaveAttribute("type", "date");
  });

  it("supports type=datetime-local variant", () => {
    render(<DateInput value={null} onChange={() => {}} label="When" variant="datetime-local" />);
    expect(screen.getByLabelText("When")).toHaveAttribute("type", "datetime-local");
  });

  it("supports type=time variant", () => {
    render(<DateInput value={null} onChange={() => {}} label="At" variant="time" />);
    expect(screen.getByLabelText("At")).toHaveAttribute("type", "time");
  });

  describe("a11y", () => {
    it("aria-describedby points at error", () => {
      render(<DateInput value={null} onChange={() => {}} label="DOB" error="Bad" />);
      const input = screen.getByLabelText("DOB");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent("Bad");
    });
  });
});
