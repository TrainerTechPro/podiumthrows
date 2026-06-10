"use client";

/**
 * Web Speech audio coaching (F1): the user is at the tripod, not the screen.
 * Throttled so wobbling across a zone boundary doesn't machine-gun cues;
 * silently no-ops where speechSynthesis is unavailable.
 */

const CUE_THROTTLE_MS = 2500;

export class SpeechCues {
  private lastSpokenAt = 0;
  private lastCue = "";

  speak(cue: string, opts: { force?: boolean } = {}): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const now = Date.now();
    if (!opts.force && cue === this.lastCue && now - this.lastSpokenAt < CUE_THROTTLE_MS) {
      return;
    }
    this.lastCue = cue;
    this.lastSpokenAt = now;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cue);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export function cueForAlignment(args: {
  zone: "MISALIGNED" | "CLOSE" | "LOCKED";
  rollDeg: number | null;
  pitchDownDeg: number | null;
  pitchBand: [number, number];
}): string {
  const { zone, rollDeg, pitchDownDeg, pitchBand } = args;
  if (zone === "LOCKED") return "Locked. Hold still.";
  const parts: string[] = [];
  if (pitchDownDeg !== null) {
    if (pitchDownDeg < pitchBand[0]) parts.push("tilt down");
    else if (pitchDownDeg > pitchBand[1]) parts.push("tilt up");
  }
  if (rollDeg !== null && Math.abs(rollDeg) > 1.5) {
    parts.push(rollDeg > 0 ? "level left" : "level right");
  }
  if (parts.length === 0) return zone === "CLOSE" ? "Almost there." : "Adjust the tripod.";
  return parts.join(", ");
}
