import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "../Textarea";

describe("Textarea", () => {
  it("renders the value", () => {
    render(<Textarea value="hello" onChange={() => {}} label="Notes" />);
    expect(screen.getByLabelText("Notes")).toHaveValue("hello");
  });

  it("renders empty when value is empty string", () => {
    render(<Textarea value="" onChange={() => {}} label="Notes" />);
    expect(screen.getByLabelText("Notes")).toHaveValue("");
  });

  it("fires onChange with the new string", () => {
    const onChange = vi.fn();
    render(<Textarea value="" onChange={onChange} label="Notes" />);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "new text" } });
    expect(onChange).toHaveBeenCalledWith("new text");
  });

  it("renders error message and aria-invalid when error prop set", () => {
    render(<Textarea value="" onChange={() => {}} label="Notes" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<Textarea value="" onChange={() => {}} label="Notes" helper="Markdown supported" />);
    expect(screen.getByText("Markdown supported")).toBeInTheDocument();
  });

  it("hides helper when error is set (error wins)", () => {
    render(
      <Textarea
        value=""
        onChange={() => {}}
        label="Notes"
        error="Required"
        helper="Markdown supported"
      />
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Markdown supported")).not.toBeInTheDocument();
  });

  it("renders required asterisk when required prop set", () => {
    render(<Textarea value="" onChange={() => {}} label="Notes" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  describe("character count", () => {
    it("does not render counter when maxLength is unset", () => {
      render(<Textarea value="hi" onChange={() => {}} label="Notes" />);
      expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
    });

    it("renders 'N characters remaining' when maxLength is set", () => {
      render(<Textarea value="hi" onChange={() => {}} label="Notes" maxLength={10} />);
      expect(screen.getByText("8 characters remaining")).toBeInTheDocument();
    });

    it("uses singular 'character' when 1 char left", () => {
      render(<Textarea value="123456789" onChange={() => {}} label="Notes" maxLength={10} />);
      expect(screen.getByText("1 character remaining")).toBeInTheDocument();
    });

    it("renders '0 characters remaining' at limit", () => {
      render(<Textarea value="1234567890" onChange={() => {}} label="Notes" maxLength={10} />);
      expect(screen.getByText("0 characters remaining")).toBeInTheDocument();
    });

    it("warns when at or near limit (atLimit class)", () => {
      const { container } = render(
        <Textarea value="1234567890" onChange={() => {}} label="Notes" maxLength={10} />
      );
      const counter = container.querySelector("[data-counter]");
      expect(counter).toHaveAttribute("data-at-limit", "true");
    });

    it("does not flag at-limit when well below threshold", () => {
      const { container } = render(
        <Textarea value="hi" onChange={() => {}} label="Notes" maxLength={100} />
      );
      const counter = container.querySelector("[data-counter]");
      expect(counter).toHaveAttribute("data-at-limit", "false");
    });
  });

  describe("autoResize", () => {
    it("does not set rows when autoResize is false", () => {
      render(<Textarea value="" onChange={() => {}} label="Notes" rows={5} />);
      expect(screen.getByLabelText("Notes")).toHaveAttribute("rows", "5");
    });

    it("uses minRows as initial rows when autoResize is true", () => {
      render(
        <Textarea value="" onChange={() => {}} label="Notes" autoResize minRows={2} maxRows={6} />
      );
      // The textarea should have rows attribute reflecting minRows
      expect(screen.getByLabelText("Notes")).toHaveAttribute("rows", "2");
    });
  });

  describe("disabled", () => {
    it("respects disabled prop", () => {
      render(<Textarea value="" onChange={() => {}} label="Notes" disabled />);
      expect(screen.getByLabelText("Notes")).toBeDisabled();
    });
  });

  describe("a11y", () => {
    it("wires aria-describedby to error", () => {
      render(<Textarea value="" onChange={() => {}} label="Notes" error="Bad" />);
      const ta = screen.getByLabelText("Notes");
      const describedBy = ta.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent("Bad");
    });

    it("wires aria-describedby to helper when no error", () => {
      render(<Textarea value="" onChange={() => {}} label="Notes" helper="Hint" />);
      const ta = screen.getByLabelText("Notes");
      const describedBy = ta.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent("Hint");
    });
  });
});
