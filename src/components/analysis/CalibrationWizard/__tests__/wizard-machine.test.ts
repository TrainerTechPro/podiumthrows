import { describe, it, expect } from "vitest";
import {
  classifyAlignment,
  initialWizardState,
  wizardReducer,
  EVENT_CAPTURE_CONFIG,
  LOCK_HOLD_MS,
  type WizardEvent,
  type WizardState,
} from "../wizard-machine";
import type { RingEllipse } from "@/lib/contracts";

const ellipse: RingEllipse = { cx: 480, cy: 540, rx: 300, ry: 110, rotation: 0 };

function run(events: WizardEvent[], from: WizardState = initialWizardState): WizardState {
  return events.reduce(wizardReducer, from);
}

/** beta for a desired pitch-down: pitchDown = 90 − beta. */
const sampleFor = (pitchDown: number, roll: number) => ({
  alpha: 0,
  beta: 90 - pitchDown,
  gamma: roll,
});

describe("classifyAlignment", () => {
  const config = EVENT_CAPTURE_CONFIG.SHOT_PUT;

  it("LOCKED inside roll ±1.5° and the pitch band", () => {
    expect(classifyAlignment(sampleFor(12, 0.5), config)).toBe("LOCKED");
    expect(classifyAlignment(sampleFor(8, -1.5), config)).toBe("LOCKED");
    expect(classifyAlignment(sampleFor(20, 1.5), config)).toBe("LOCKED");
  });

  it("CLOSE within 2× tolerances", () => {
    expect(classifyAlignment(sampleFor(12, 2.5), config)).toBe("CLOSE");
    expect(classifyAlignment(sampleFor(24, 0), config)).toBe("CLOSE");
  });

  it("MISALIGNED beyond", () => {
    expect(classifyAlignment(sampleFor(12, 5), config)).toBe("MISALIGNED");
    expect(classifyAlignment(sampleFor(45, 0), config)).toBe("MISALIGNED");
  });

  it("MISALIGNED on null gyro values (no fake confidence)", () => {
    expect(classifyAlignment({ alpha: null, beta: null, gamma: null }, config)).toBe(
      "MISALIGNED"
    );
  });
});

describe("wizard happy path (gyro granted)", () => {
  it("walks event_select → … → done", () => {
    let s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1000 },
    ]);
    expect(s.step).toBe("align");
    expect(s.alignment).toBe("LOCKED");
    expect(s.lockedSinceMs).toBe(1000);

    // Hold not yet elapsed: no capture.
    s = wizardReducer(s, {
      type: "LOCK_HOLD_ELAPSED",
      nowMs: 1000 + LOCK_HOLD_MS - 1,
      ringEllipse: ellipse,
    });
    expect(s.step).toBe("align");

    s = run(
      [
        { type: "LOCK_HOLD_ELAPSED", nowMs: 1000 + LOCK_HOLD_MS, ringEllipse: ellipse },
        { type: "SAVE" },
        { type: "SAVE_OK", calibrationSessionId: "cal_1" },
      ],
      s
    );
    expect(s.step).toBe("done");
    expect(s.ringEllipse).toEqual(ellipse);
    expect(s.calibrationSessionId).toBe("cal_1");
  });

  it("losing lock resets the hold timer", () => {
    let s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1000 },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 8), nowMs: 1400 }, // wobble out
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1800 }, // back in
    ]);
    expect(s.lockedSinceMs).toBe(1800); // restarted, not 1000
    s = wizardReducer(s, {
      type: "LOCK_HOLD_ELAPSED",
      nowMs: 1800 + LOCK_HOLD_MS - 1,
      ringEllipse: ellipse,
    });
    expect(s.step).toBe("align");
  });

  it("ignores all-null samples — a sensor dropout never destroys a held lock", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1000 },
      {
        type: "ORIENTATION_SAMPLE",
        sample: { alpha: null, beta: null, gamma: null },
        nowMs: 1100,
      },
    ]);
    expect(s.alignment).toBe("LOCKED");
    expect(s.lockedSinceMs).toBe(1000);
  });

  it("keeps the original lock start across sustained LOCKED samples", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1000 },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(13, 0.2), nowMs: 1500 },
    ]);
    expect(s.lockedSinceMs).toBe(1000);
  });
});

describe("gyro denial path (F1: never blocks)", () => {
  it("manual confirm reaches captured without any orientation sample", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_DENIED" },
      { type: "MANUAL_LEVEL_CONFIRM", nowMs: 2000 },
      { type: "LOCK_HOLD_ELAPSED", nowMs: 2000 + LOCK_HOLD_MS, ringEllipse: ellipse },
    ]);
    expect(s.step).toBe("captured");
    expect(s.gyro).toBe("denied");
  });

  it("orientation samples are ignored when gyro is denied", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_DENIED" },
      { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 1000 },
    ]);
    expect(s.alignment).toBe("MISALIGNED");
    expect(s.lockedSinceMs).toBeNull();
  });

  it("manual confirm is rejected when gyro IS granted (no bypassing the gyro)", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "MANUAL_LEVEL_CONFIRM", nowMs: 2000 },
    ]);
    expect(s.alignment).toBe("MISALIGNED");
  });
});

describe("save failure and recovery", () => {
  const captured = run([
    { type: "SELECT_EVENT", event: "SHOT_PUT" },
    { type: "CONFIRM_POSITION" },
    { type: "GYRO_GRANTED" },
    { type: "ORIENTATION_SAMPLE", sample: sampleFor(12, 0), nowMs: 0 },
    { type: "LOCK_HOLD_ELAPSED", nowMs: LOCK_HOLD_MS, ringEllipse: ellipse },
  ]);

  it("SAVE_FAILED lands in error with the message; RETRY returns to captured", () => {
    let s = run(
      [{ type: "SAVE" }, { type: "SAVE_FAILED", message: "network down" }],
      captured
    );
    expect(s.step).toBe("error");
    expect(s.errorMessage).toBe("network down");
    s = wizardReducer(s, { type: "RETRY" });
    expect(s.step).toBe("captured");
    expect(s.ringEllipse).toEqual(ellipse); // ellipse survives the retry
  });

  it("RESET returns to the initial state from anywhere", () => {
    const s = wizardReducer(captured, { type: "RESET" });
    expect(s).toEqual(initialWizardState);
  });
});

describe("illegal transitions are no-ops", () => {
  it("cannot capture while MISALIGNED", () => {
    const s = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "CONFIRM_POSITION" },
      { type: "GYRO_GRANTED" },
      { type: "LOCK_HOLD_ELAPSED", nowMs: 99999, ringEllipse: ellipse },
    ]);
    expect(s.step).toBe("align");
  });

  it("cannot SAVE before capture, cannot double-SELECT_EVENT", () => {
    const s1 = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "SAVE" },
    ]);
    expect(s1.step).toBe("position");
    const s2 = run([
      { type: "SELECT_EVENT", event: "SHOT_PUT" },
      { type: "SELECT_EVENT", event: "HAMMER" },
    ]);
    expect(s2.event).toBe("SHOT_PUT");
  });

  it("SAVE_OK outside saving is ignored", () => {
    const s = wizardReducer(initialWizardState, {
      type: "SAVE_OK",
      calibrationSessionId: "x",
    });
    expect(s.step).toBe("event_select");
  });
});
