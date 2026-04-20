import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { useState } from "react";
import { Sheet, useSheet } from "../Sheet";

/* ─── Test helpers ──────────────────────────────────────────────────────── */

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function flushTransitionIn() {
  // rAF twice → setVisible(true)
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

function Harness({
  initialOpen = false,
  ...rest
}: {
  initialOpen?: boolean;
  title?: string;
  ariaLabel?: string;
  preventClose?: boolean;
  side?: "bottom" | "right";
  size?: "sm" | "md" | "lg" | "full";
  showHandle?: boolean;
  children?: React.ReactNode;
}) {
  const { open, onOpen, onClose } = useSheet(initialOpen);
  return (
    <>
      <button type="button" onClick={onOpen}>
        open
      </button>
      <Sheet
        open={open}
        onClose={onClose}
        side={rest.side ?? "bottom"}
        size={rest.size}
        title={rest.title}
        ariaLabel={rest.ariaLabel}
        preventClose={rest.preventClose}
        showHandle={rest.showHandle}
      >
        {rest.children ?? <button type="button">inside</button>}
      </Sheet>
    </>
  );
}

beforeEach(() => {
  mockMatchMedia(false);
  document.body.style.overflow = "";
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

/* ─── Tests ─────────────────────────────────────────────────────────────── */

describe("Sheet", () => {
  it("renders nothing when closed", () => {
    render(<Harness title="Settings" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mounts and becomes visible after open flips true", async () => {
    render(<Harness initialOpen title="Settings" />);
    await flushTransitionIn();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toHaveAttribute("data-state", "open");
  });

  it("unmounts after open flips false past exit timeout", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<Sheet open onClose={() => {}} side="bottom" title="X" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Sheet open={false} onClose={() => {}} side="bottom" title="X" />);
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    vi.useRealTimers();
  });

  it("Escape key calls onClose", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} side="bottom" title="X" />);
    await flushTransitionIn();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key is ignored when preventClose", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} side="bottom" title="X" preventClose />);
    await flushTransitionIn();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop click calls onClose", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} side="bottom" title="X" />);
    await flushTransitionIn();
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click is ignored when preventClose", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} side="bottom" title="X" preventClose />);
    await flushTransitionIn();
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("click inside panel does not call onClose", async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} side="bottom" title="X">
        <div data-testid="inner">content</div>
      </Sheet>
    );
    await flushTransitionIn();
    fireEvent.click(screen.getByTestId("inner"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses first focusable inside panel on open", async () => {
    render(
      <Sheet open onClose={() => {}} side="bottom" title="X">
        <button type="button">first</button>
        <button type="button">second</button>
      </Sheet>
    );
    await flushTransitionIn();
    // Close button is first in DOM order (header renders before body)
    await waitFor(() => {
      expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    });
  });

  it("has role=dialog, aria-modal=true, and an accessible name", async () => {
    render(<Sheet open onClose={() => {}} side="right" title="Settings" />);
    await flushTransitionIn();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "sheet-title");
  });

  it("falls back to ariaLabel when title is absent", async () => {
    render(<Sheet open onClose={() => {}} side="right" ariaLabel="Filters" />);
    await flushTransitionIn();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Filters");
    expect(dialog).not.toHaveAttribute("aria-labelledby");
  });

  it("locks body scroll while open, restores on close", async () => {
    vi.useFakeTimers();
    document.body.style.overflow = "scroll";
    const { rerender } = render(<Sheet open onClose={() => {}} side="bottom" title="X" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Sheet open={false} onClose={() => {}} side="bottom" title="X" />);
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(document.body.style.overflow).toBe("scroll");
    vi.useRealTimers();
  });

  it("stacked sheets ref-count body scroll lock via save/restore", async () => {
    function Two() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <>
          <Sheet open={outer} onClose={() => setOuter(false)} side="right" title="Outer" />
          <Sheet open={inner} onClose={() => setInner(false)} side="bottom" title="Inner" />
          <button type="button" onClick={() => setInner(false)}>
            close-inner
          </button>
          <button type="button" onClick={() => setOuter(false)}>
            close-outer
          </button>
        </>
      );
    }
    vi.useFakeTimers();
    document.body.style.overflow = "auto";
    render(<Two />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByText("close-inner"));
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByText("close-outer"));
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(document.body.style.overflow).toBe("auto");
    vi.useRealTimers();
  });

  it("applies bottom size class when side=bottom", async () => {
    render(<Sheet open onClose={() => {}} side="bottom" size="lg" title="X" />);
    await flushTransitionIn();
    expect(screen.getByRole("dialog").className).toContain("max-h-[85vh]");
  });

  it("applies right size class when side=right", async () => {
    render(<Sheet open onClose={() => {}} side="right" size="sm" title="X" />);
    await flushTransitionIn();
    expect(screen.getByRole("dialog").className).toContain("max-w-sm");
  });

  it("shows handle by default for bottom, hides it for right", async () => {
    render(<Sheet open onClose={() => {}} side="bottom" title="X" />);
    await flushTransitionIn();
    expect(screen.getByRole("dialog").querySelector(".w-10.h-1.rounded-full")).toBeInTheDocument();
    cleanup();
    render(<Sheet open onClose={() => {}} side="right" title="X" />);
    await flushTransitionIn();
    expect(screen.getByRole("dialog").querySelector(".w-10.h-1.rounded-full")).toBeNull();
  });

  it("reduced-motion skips the rAF two-phase and becomes visible synchronously", async () => {
    mockMatchMedia(true);
    render(<Sheet open onClose={() => {}} side="bottom" title="X" />);
    await act(async () => {
      await Promise.resolve();
    });
    // No rAF flush needed — visible should already be true
    const wrapper = screen.getByRole("dialog").parentElement;
    expect(wrapper).toHaveAttribute("data-state", "open");
  });
});

describe("useSheet", () => {
  it("exposes open/onOpen/onClose/toggle", () => {
    function Probe() {
      const s = useSheet();
      return (
        <>
          <span data-testid="state">{String(s.open)}</span>
          <button type="button" onClick={s.onOpen}>
            open
          </button>
          <button type="button" onClick={s.onClose}>
            close
          </button>
          <button type="button" onClick={s.toggle}>
            toggle
          </button>
        </>
      );
    }
    render(<Probe />);
    expect(screen.getByTestId("state").textContent).toBe("false");
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("state").textContent).toBe("true");
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("state").textContent).toBe("false");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("state").textContent).toBe("true");
  });
});
