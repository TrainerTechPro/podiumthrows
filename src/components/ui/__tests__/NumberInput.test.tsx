import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberInput } from "../NumberInput";

describe("NumberInput", () => {
  it("renders empty when value is null", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(null);
  });

  it("renders 0 when value is 0 (the bug this exists to fix)", () => {
    render(<NumberInput value={0} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(0);
  });

  it("renders the number when value is non-zero", () => {
    render(<NumberInput value={3.14} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(3.14);
  });

  it("fires onChange(null) when user clears the input", () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("fires onChange(0) when user types 0 (must distinguish from empty)", () => {
    const onChange = vi.fn();
    render(<NumberInput value={null} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("fires onChange(3.14) on parseable decimal", () => {
    const onChange = vi.fn();
    render(<NumberInput value={null} onChange={onChange} label="Weight" step={0.01} />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "3.14" } });
    expect(onChange).toHaveBeenCalledWith(3.14);
  });

  it("does not emit a non-null value for unparseable input", () => {
    // jsdom's <input type="number"> may emit either nothing or "" for "abc".
    // Either is acceptable — what we MUST guarantee is no NaN ever leaks out.
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "abc" } });
    for (const call of onChange.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });

  it("uses inputMode='decimal' when step has decimals", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Weight" step={0.1} />);
    expect(screen.getByLabelText("Weight")).toHaveAttribute("inputMode", "decimal");
  });

  it("uses inputMode='numeric' when step is integer", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Reps" step={1} />);
    expect(screen.getByLabelText("Reps")).toHaveAttribute("inputMode", "numeric");
  });

  it("renders unit suffix when unit prop given", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" unit="kg" />);
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("renders error message and aria-invalid when error prop set", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" error="Too high" />);
    expect(screen.getByText("Too high")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" helper="Enter in kg" />);
    expect(screen.getByText("Enter in kg")).toBeInTheDocument();
  });

  describe("steppers (when showSteppers=true)", () => {
    it("renders + and − buttons", () => {
      render(<NumberInput value={5} onChange={() => {}} label="Reps" showSteppers />);
      expect(screen.getByLabelText("Decrease Reps")).toBeInTheDocument();
      expect(screen.getByLabelText("Increase Reps")).toBeInTheDocument();
    });

    it("increments by step when + clicked", () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it("decrements by step when − clicked", () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Decrease Reps"));
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("clamps at min when decrementing", () => {
      const onChange = vi.fn();
      render(<NumberInput value={1} onChange={onChange} label="Reps" showSteppers min={1} />);
      fireEvent.click(screen.getByLabelText("Decrease Reps"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clamps at max when incrementing", () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} label="Reps" showSteppers max={10} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("treats null as 0 baseline when incrementing from empty", () => {
      const onChange = vi.fn();
      render(<NumberInput value={null} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });
});
