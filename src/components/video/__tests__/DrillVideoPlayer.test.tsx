/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { DrillVideoPlayer } from "../DrillVideoPlayer";

/**
 * The slow-mo toggle is the only custom control on the athlete drill-video
 * player. Native controls handle scrub + play/pause. These guards keep the
 * speed-cycling, aria-labeling, and playbackRate side-effect honest.
 */
describe("DrillVideoPlayer slow-mo toggle", () => {
  function getVideo() {
    // Native <video> has no semantic role by default; reach for it directly.
    const el = document.querySelector("video");
    if (!el) throw new Error("video element not found");
    return el as HTMLVideoElement;
  }

  it("starts at 1× and cycles 1× → 0.5× → 0.25× → 1×", () => {
    render(<DrillVideoPlayer src="/fake.mp4" />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("1×");
    expect(getVideo().playbackRate).toBe(1);

    fireEvent.click(btn);
    expect(btn.textContent).toBe("0.5×");
    expect(getVideo().playbackRate).toBe(0.5);

    fireEvent.click(btn);
    expect(btn.textContent).toBe("0.25×");
    expect(getVideo().playbackRate).toBe(0.25);

    fireEvent.click(btn);
    expect(btn.textContent).toBe("1×");
    expect(getVideo().playbackRate).toBe(1);
  });

  it("updates aria-pressed + aria-label when slow-mo engages", () => {
    render(<DrillVideoPlayer src="/fake.mp4" />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toMatch(/off/i);

    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toMatch(/0\.5×/);
  });

  it("places the toggle at the top-right so native bottom controls aren't covered", () => {
    render(<DrillVideoPlayer src="/fake.mp4" />);
    const btn = screen.getByRole("button");
    // Class-presence assertion is intentional — the contract is "top-right",
    // not specific spacing values. If layout drifts to bottom, this fails.
    expect(btn.className).toMatch(/\btop-2\b/);
    expect(btn.className).toMatch(/\bright-2\b/);
    expect(btn.className).not.toMatch(/\bbottom-/);
  });

  it("renders the <video> with playsInline + nodownload + native controls", () => {
    render(<DrillVideoPlayer src="/fake.mp4" />);
    const v = getVideo();
    expect(v.hasAttribute("controls")).toBe(true);
    expect(v.hasAttribute("playsInline")).toBe(true);
    expect(v.getAttribute("controlslist")).toBe("nodownload");
  });
});
