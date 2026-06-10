import { describe, it, expect } from "vitest";
import type { MetricValue } from "@/lib/contracts";
import {
  applyConfidenceGrades,
  gradeClipConfidence,
  gradeMetricConfidence,
  minGrade,
} from "../confidence";
import { SHOTPUT_VIEW_SENSITIVITY } from "../metrics/definitions/shotput";

const goodClip = {
  meanQuality: 0.9,
  fps: 60,
  perFrameQuality: Array(100).fill(0.9),
};

describe("gradeClipConfidence", () => {
  it("grades a clean 60fps clip HIGH", () => {
    const c = gradeClipConfidence(goodClip);
    expect(c.grade).toBe("HIGH");
    expect(c.degradedFrameFraction).toBe(0);
  });

  it("is the minimum of its signals: 30fps alone pulls HIGH quality to MEDIUM", () => {
    expect(gradeClipConfidence({ ...goodClip, fps: 30 }).grade).toBe("MEDIUM");
    expect(gradeClipConfidence({ ...goodClip, fps: 59.94 }).grade).toBe("MEDIUM");
  });

  it("grades sub-30fps footage LOW regardless of pose quality", () => {
    expect(gradeClipConfidence({ ...goodClip, fps: 24 }).grade).toBe("LOW");
  });

  it("grades by mean quality band: 0.7 → MEDIUM, 0.55 → LOW", () => {
    expect(gradeClipConfidence({ ...goodClip, meanQuality: 0.7 }).grade).toBe("MEDIUM");
    expect(gradeClipConfidence({ ...goodClip, meanQuality: 0.55 }).grade).toBe("LOW");
  });

  it("degraded-frame fraction (interpolated/untrusted frames) downgrades the clip", () => {
    // 20% of frames below the degraded threshold → MEDIUM; 50% → LOW.
    const fifth = [...Array(80).fill(0.9), ...Array(20).fill(0.4)];
    expect(
      gradeClipConfidence({ meanQuality: 0.8, fps: 60, perFrameQuality: fifth }).grade
    ).toBe("MEDIUM");
    const half = [...Array(50).fill(0.9), ...Array(50).fill(0.4)];
    expect(
      gradeClipConfidence({ meanQuality: 0.65, fps: 60, perFrameQuality: half }).grade
    ).toBe("LOW");
  });
});

describe("gradeMetricConfidence", () => {
  it("maps numeric confidence to grades at 0.8 / 0.5", () => {
    expect(gradeMetricConfidence(0.95)).toBe("HIGH");
    expect(gradeMetricConfidence(0.8)).toBe("HIGH");
    expect(gradeMetricConfidence(0.6)).toBe("MEDIUM");
    expect(gradeMetricConfidence(0.5)).toBe("MEDIUM");
    expect(gradeMetricConfidence(0.3)).toBe("LOW");
  });
});

describe("minGrade", () => {
  it("returns the worst grade", () => {
    expect(minGrade("HIGH", "MEDIUM")).toBe("MEDIUM");
    expect(minGrade("MEDIUM", "LOW", "HIGH")).toBe("LOW");
    expect(minGrade("HIGH")).toBe("HIGH");
  });
});

describe("applyConfidenceGrades", () => {
  const m = (confidence: number, value: number | null = 40): MetricValue => ({
    value,
    unit: "deg",
    confidence,
    frameRefs: value === null ? [] : [10],
  });

  it("caps view-sensitive metrics at MEDIUM when uncalibrated", () => {
    const out = applyConfidenceGrades(
      { trunk_inclination_at_release: m(0.95) },
      {
        clipGrade: "HIGH",
        calibrated: false,
        viewSensitivity: SHOTPUT_VIEW_SENSITIVITY,
      }
    );
    expect(out.trunk_inclination_at_release.confidenceGrade).toBe("MEDIUM");
  });

  it("does NOT cap view-sensitive metrics when calibrated", () => {
    const out = applyConfidenceGrades(
      { trunk_inclination_at_release: m(0.95) },
      {
        clipGrade: "HIGH",
        calibrated: true,
        viewSensitivity: SHOTPUT_VIEW_SENSITIVITY,
      }
    );
    expect(out.trunk_inclination_at_release.confidenceGrade).toBe("HIGH");
  });

  it("timing metrics keep their measured confidence uncalibrated (view-robust)", () => {
    const out = applyConfidenceGrades(
      { entry_duration: { ...m(0.95), unit: "s" }, release_frame: { ...m(0.95), unit: "frame" } },
      {
        clipGrade: "HIGH",
        calibrated: false,
        viewSensitivity: SHOTPUT_VIEW_SENSITIVITY,
      }
    );
    expect(out.entry_duration.confidenceGrade).toBe("HIGH");
    expect(out.release_frame.confidenceGrade).toBe("HIGH");
  });

  it("clip grade caps every metric (bad clip, good keypoint)", () => {
    const out = applyConfidenceGrades(
      { entry_duration: { ...m(0.95), unit: "s" } },
      { clipGrade: "LOW", calibrated: true, viewSensitivity: SHOTPUT_VIEW_SENSITIVITY }
    );
    expect(out.entry_duration.confidenceGrade).toBe("LOW");
  });

  it("a low numeric confidence grades LOW even when the cap would be MEDIUM", () => {
    const out = applyConfidenceGrades(
      { trunk_inclination_at_release: m(0.3) },
      { clipGrade: "HIGH", calibrated: false, viewSensitivity: SHOTPUT_VIEW_SENSITIVITY }
    );
    expect(out.trunk_inclination_at_release.confidenceGrade).toBe("LOW");
  });

  it("leaves null-valued metrics ungraded — not-measurable is a product state", () => {
    const out = applyConfidenceGrades(
      { release_velocity: { ...m(0, null), unit: "m/s" } },
      { clipGrade: "HIGH", calibrated: false, viewSensitivity: SHOTPUT_VIEW_SENSITIVITY }
    );
    expect(out.release_velocity.confidenceGrade).toBeUndefined();
  });

  it("every shotput metric carries a viewSensitivity tag", () => {
    // Pins the definitions ↔ confidence-model contract: a new metric without
    // a tag would silently skip the uncalibrated cap.
    for (const key of [
      "hip_shoulder_separation_at_power_position",
      "trunk_inclination_at_power_position",
      "trunk_inclination_at_release",
      "release_angle",
      "release_height",
      "release_velocity",
      "block_knee_angle_at_release",
      "rear_leg_sweep_height_ratio",
      "com_displacement",
      "release_frame",
      "entry_duration",
      "drive_duration",
      "delivery_duration",
    ]) {
      expect(SHOTPUT_VIEW_SENSITIVITY[key], key).toBeDefined();
    }
  });
});
