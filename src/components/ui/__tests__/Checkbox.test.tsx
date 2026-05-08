import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it("renders unchecked by default", () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Accept" />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).not.toBeChecked();
  });

  it("renders checked when checked=true", () => {
    render(<Checkbox checked onChange={() => {}} label="Accept" />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeChecked();
  });

  it("fires onChange(true) when toggled from unchecked", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("fires onChange(false) when toggled from checked", () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Accept" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("respects disabled — does not fire onChange", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept" disabled />);
    const cb = screen.getByRole("checkbox", { name: "Accept" });
    expect(cb).toBeDisabled();
    fireEvent.click(cb);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders without label (bare mode) and still has checkbox role", () => {
    render(<Checkbox checked={false} onChange={() => {}} aria-label="Bare checkbox" />);
    expect(screen.getByRole("checkbox", { name: "Bare checkbox" })).toBeInTheDocument();
  });

  it("renders error message when error prop set", () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Accept" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("renders helper text when no error", () => {
    render(
      <Checkbox checked={false} onChange={() => {}} label="Accept" helper="Optional opt-in" />
    );
    expect(screen.getByText("Optional opt-in")).toBeInTheDocument();
  });

  it("hides helper when error set (error wins)", () => {
    render(
      <Checkbox
        checked={false}
        onChange={() => {}}
        label="Accept"
        error="Required"
        helper="Optional opt-in"
      />
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Optional opt-in")).not.toBeInTheDocument();
  });

  it("renders required asterisk when required prop set", () => {
    render(<Checkbox checked={false} onChange={() => {}} label="Accept" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  describe("indeterminate", () => {
    it("sets the DOM indeterminate property when indeterminate=true", () => {
      render(<Checkbox checked={false} onChange={() => {}} label="All" indeterminate />);
      const cb = screen.getByRole("checkbox", { name: "All" }) as HTMLInputElement;
      expect(cb.indeterminate).toBe(true);
    });

    it("clears indeterminate when prop is false", () => {
      const { rerender } = render(
        <Checkbox checked={false} onChange={() => {}} label="All" indeterminate />
      );
      const cb = screen.getByRole("checkbox", { name: "All" }) as HTMLInputElement;
      expect(cb.indeterminate).toBe(true);
      rerender(<Checkbox checked={false} onChange={() => {}} label="All" indeterminate={false} />);
      expect(cb.indeterminate).toBe(false);
    });

    it("toggling indeterminate fires onChange(true)", () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} label="All" indeterminate />);
      fireEvent.click(screen.getByRole("checkbox", { name: "All" }));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe("a11y", () => {
    it("aria-invalid set when error", () => {
      render(<Checkbox checked={false} onChange={() => {}} label="Accept" error="Required" />);
      expect(screen.getByRole("checkbox", { name: "Accept" })).toHaveAttribute(
        "aria-invalid",
        "true"
      );
    });

    it("aria-describedby points at the helper/error", () => {
      render(<Checkbox checked={false} onChange={() => {}} label="Accept" helper="Hint" />);
      const cb = screen.getByRole("checkbox", { name: "Accept" });
      const describedBy = cb.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent("Hint");
    });
  });
});
