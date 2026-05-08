import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { useFilePicker, type RejectedFile } from "../useFilePicker";

function Harness({
  accept,
  multiple,
  maxSize,
  onFiles = () => {},
  onRejected = () => {},
}: {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFiles?: (files: File[]) => void;
  onRejected?: (rejected: RejectedFile[]) => void;
}) {
  const picker = useFilePicker({ accept, multiple, maxSize, onFiles, onRejected });
  return (
    <div>
      <button onClick={picker.open}>Choose</button>
      {picker.input}
    </div>
  );
}

function makeFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("useFilePicker", () => {
  it("renders a hidden file input", () => {
    const { container } = render(<Harness />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
  });

  it("forwards accept attribute", () => {
    const { container } = render(<Harness accept="image/*" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");
  });

  it("forwards multiple attribute when set", () => {
    const { container } = render(<Harness multiple />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");
  });

  it("does not set multiple when omitted", () => {
    const { container } = render(<Harness />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toHaveAttribute("multiple");
  });

  it("fires onFiles with selected files", () => {
    const onFiles = vi.fn();
    const { container } = render(<Harness onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("photo.png", 1024, "image/png");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("does not fire onFiles when no files selected (cancel)", () => {
    const onFiles = vi.fn();
    const { container } = render(<Harness onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("rejects files over maxSize", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    const { container } = render(
      <Harness onFiles={onFiles} onRejected={onRejected} maxSize={500} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const small = makeFile("ok.png", 200, "image/png");
    const big = makeFile("toobig.png", 1000, "image/png");
    fireEvent.change(input, { target: { files: [small, big] } });
    expect(onFiles).toHaveBeenCalledWith([small]);
    expect(onRejected).toHaveBeenCalledWith([{ file: big, reason: "size" }]);
  });

  it("does not call onFiles when ALL files are rejected", () => {
    const onFiles = vi.fn();
    const onRejected = vi.fn();
    const { container } = render(
      <Harness onFiles={onFiles} onRejected={onRejected} maxSize={100} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const big = makeFile("toobig.png", 1000, "image/png");
    fireEvent.change(input, { target: { files: [big] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith([{ file: big, reason: "size" }]);
  });

  it("open() programmatically triggers the input click", () => {
    const clickSpy = vi.fn();
    // Patch HTMLInputElement.prototype.click before render
    const original = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = clickSpy;
    try {
      render(<Harness />);
      fireEvent.click(screen.getByText("Choose"));
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      HTMLInputElement.prototype.click = original;
    }
  });

  it("resets the input value after selection — same file can be picked twice", () => {
    const onFiles = vi.fn();
    const { container } = render(<Harness onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("photo.png", 1024, "image/png");
    act(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    // After change, value should be reset so re-selecting the same file fires onChange again
    expect(input.value).toBe("");
  });
});
