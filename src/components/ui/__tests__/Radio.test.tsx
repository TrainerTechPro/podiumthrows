import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadioGroup, Radio } from "../Radio";

describe("RadioGroup + Radio", () => {
  it("renders all options", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
        <Radio value="c" label="C" />
      </RadioGroup>
    );
    expect(screen.getByLabelText("A")).toBeInTheDocument();
    expect(screen.getByLabelText("B")).toBeInTheDocument();
    expect(screen.getByLabelText("C")).toBeInTheDocument();
  });

  it("checks the option matching value", () => {
    render(
      <RadioGroup value="b" onChange={() => {}} aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    expect(screen.getByLabelText("A")).not.toBeChecked();
    expect(screen.getByLabelText("B")).toBeChecked();
  });

  it("fires onChange with the new value when an option is selected", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup value="a" onChange={onChange} aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    fireEvent.click(screen.getByLabelText("B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("groups options under one shared name attribute", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    const a = screen.getByLabelText("A") as HTMLInputElement;
    const b = screen.getByLabelText("B") as HTMLInputElement;
    expect(a.name).toBe(b.name);
    expect(a.name).not.toBe("");
  });

  it("respects per-radio disabled — does not fire onChange", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup value="a" onChange={onChange} aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" disabled />
      </RadioGroup>
    );
    const b = screen.getByLabelText("B");
    expect(b).toBeDisabled();
    fireEvent.click(b);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects group-level disabled on every radio", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} disabled aria-label="choices">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    expect(screen.getByLabelText("A")).toBeDisabled();
    expect(screen.getByLabelText("B")).toBeDisabled();
  });

  it("renders a group-level error message", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} aria-label="choices" error="Pick one">
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders a group label when provided", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} label="Choose one">
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    expect(screen.getByText("Choose one")).toBeInTheDocument();
  });

  describe("keyboard navigation", () => {
    it("ArrowDown moves selection to next option", () => {
      const onChange = vi.fn();
      render(
        <RadioGroup value="a" onChange={onChange} aria-label="choices">
          <Radio value="a" label="A" />
          <Radio value="b" label="B" />
          <Radio value="c" label="C" />
        </RadioGroup>
      );
      fireEvent.keyDown(screen.getByLabelText("A"), { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith("b");
    });

    it("ArrowUp moves selection to previous option", () => {
      const onChange = vi.fn();
      render(
        <RadioGroup value="b" onChange={onChange} aria-label="choices">
          <Radio value="a" label="A" />
          <Radio value="b" label="B" />
        </RadioGroup>
      );
      fireEvent.keyDown(screen.getByLabelText("B"), { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith("a");
    });

    it("ArrowDown wraps from last to first", () => {
      const onChange = vi.fn();
      render(
        <RadioGroup value="b" onChange={onChange} aria-label="choices">
          <Radio value="a" label="A" />
          <Radio value="b" label="B" />
        </RadioGroup>
      );
      fireEvent.keyDown(screen.getByLabelText("B"), { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith("a");
    });

    it("ArrowDown skips disabled options", () => {
      const onChange = vi.fn();
      render(
        <RadioGroup value="a" onChange={onChange} aria-label="choices">
          <Radio value="a" label="A" />
          <Radio value="b" label="B" disabled />
          <Radio value="c" label="C" />
        </RadioGroup>
      );
      fireEvent.keyDown(screen.getByLabelText("A"), { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith("c");
    });
  });

  describe("a11y", () => {
    it("container has role=radiogroup", () => {
      render(
        <RadioGroup value="a" onChange={() => {}} aria-label="choices">
          <Radio value="a" label="A" />
        </RadioGroup>
      );
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    });

    it("radiogroup has aria-invalid when error", () => {
      render(
        <RadioGroup value="a" onChange={() => {}} aria-label="choices" error="x">
          <Radio value="a" label="A" />
        </RadioGroup>
      );
      expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("supports bare radio (no label) — for custom card layouts", () => {
    render(
      <RadioGroup value="a" onChange={() => {}} aria-label="choices">
        <Radio value="a" aria-label="Card A" />
        <Radio value="b" aria-label="Card B" />
      </RadioGroup>
    );
    expect(screen.getByLabelText("Card A")).toBeChecked();
    expect(screen.getByLabelText("Card B")).not.toBeChecked();
  });
});
