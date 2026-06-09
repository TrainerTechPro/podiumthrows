import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  PoseOutputSchema,
  PoseWebhookPayloadSchema,
  COCO17_KEYPOINTS,
  MetricsOutputSchema,
  FaultResultSchema,
  FaultRulesFileSchema,
  NarrativeInputSchema,
  NarrativeOutputSchema,
  StoredNarrativeSchema,
  CalibrationCreateSchema,
  HomographySchema,
  ReportModelSchema,
  JobStatusSchema,
  canTransition,
  JOB_STATUSES,
} from "..";

/** parse → serialize → parse must be lossless and stable for every contract. */
function roundtrip<T>(schema: z.ZodType<T>, fixture: unknown): void {
  const first = schema.parse(fixture);
  const wire = JSON.stringify(first);
  const second = schema.parse(JSON.parse(wire));
  expect(second).toEqual(first);
  expect(JSON.stringify(second)).toBe(wire);
}

const keypoints = COCO17_KEYPOINTS.map((_, i) => ({
  x: 100 + i,
  y: 200 + i,
  conf: 0.9,
}));

const poseOutput = {
  schemaVersion: "1.0",
  jobId: "job_1",
  modelId: "rtmpose-l",
  modelVersion: "1.3.0",
  fps: 60,
  resolution: { width: 1920, height: 1080 },
  frames: [
    { idx: 0, t: 0, bbox: [10, 20, 300, 600], keypoints },
    { idx: 1, t: 1 / 60, bbox: null, keypoints: null },
  ],
};

const metricValue = {
  value: 38.2,
  unit: "deg",
  confidence: 0.91,
  frameRefs: [42],
};

const metricsOutput = {
  schemaVersion: "1.0",
  event: "SHOT_PUT",
  definitionsVersion: "shotput-1.0.0",
  calibrated: false,
  metrics: {
    hip_shoulder_separation_at_power_position: metricValue,
    release_velocity: { value: null, unit: "m/s", confidence: 0, frameRefs: [] },
  },
  phaseBoundaries: [
    { phase: "entry", startFrame: 0, endFrame: 30 },
    { phase: "drive", startFrame: 31, endFrame: 55 },
  ],
  quality: { meanQuality: 0.87, lowConfidence: false },
};

const faultResult = {
  ruleId: "early_shoulder_opening",
  severity: "HIGH",
  measuredValue: 18,
  targetRange: [35, 45],
  evidenceFrames: [42],
  drillTags: ["separation"],
  faultName: "Early shoulder opening",
  metricKey: "hip_shoulder_separation_at_power_position",
  unit: "deg",
};

const rulesFile = {
  version: "shotput-rules-1.0.0",
  event: "SHOT_PUT",
  rules: [
    {
      ruleId: "early_shoulder_opening",
      faultName: "Early shoulder opening",
      metricKey: "hip_shoulder_separation_at_power_position",
      comparator: "below",
      targetRange: [35, 45],
      unit: "deg",
      severityBands: [
        { deviationGte: 0, severity: "LOW" },
        { deviationGte: 5, severity: "MEDIUM" },
        { deviationGte: 10, severity: "HIGH" },
      ],
      minConfidence: 0.5,
      drillTags: ["separation"],
      coachTunable: true,
    },
  ],
  drillTagMap: {
    separation: { category: "SPECIAL_DEVELOPMENTAL", keywords: ["separation", "x-factor"] },
  },
};

const narrativeInput = {
  event: "SHOT_PUT",
  athleteContext: { level: "D1", recentFaultIds: [] },
  metrics: { hip_shoulder_separation_at_power_position: metricValue },
  faults: [faultResult],
  drillOptions: [
    { id: "d1", name: "Separation med-ball throw", description: null, tags: ["separation"] },
  ],
};

const narrativeOutput = {
  coachSummary: "Separation at the power position measured 38.2 degrees.",
  phaseCommentary: [{ phase: "power_position", comment: "Strong wrap." }],
  drillSelections: [{ drillId: "d1", rationale: "Targets separation." }],
};

const reportModel = {
  header: { event: "SHOT_PUT", athleteName: "Test Athlete", date: "2026-06-09", calibrated: true },
  phaseScores: [
    {
      phase: "power_position",
      score: 7.5,
      items: [
        {
          metricKey: "hip_shoulder_separation_at_power_position",
          label: "Hip–shoulder separation",
          value: metricValue,
          weight: 1,
        },
      ],
    },
  ],
  faultCards: [
    {
      fault: faultResult,
      displayValue: "Separation: 18°",
      displayTarget: "target 35–45°",
      thumbnailPath: null,
    },
  ],
  drills: [{ id: "d1", name: "Separation med-ball throw", description: null, rationale: null }],
  coachSummary: "Summary text.",
  methodology: ["Angles are computed from smoothed COCO-17 keypoints."],
  watermark: false,
  rubricVersion: "rubric-1.0.0",
  rulesVersion: "shotput-rules-1.0.0",
};

describe("contract round-trips (parse → serialize → parse)", () => {
  it("PoseOutput", () => roundtrip(PoseOutputSchema, poseOutput));
  it("PoseWebhookPayload (success)", () =>
    roundtrip(PoseWebhookPayloadSchema, {
      jobId: "job_1",
      status: "pose_complete",
      rawPath: "analysis/job_1/pose.json",
      modelId: "rtmpose-l",
      modelVersion: "1.3.0",
      fpsTrue: 59.94,
      meanDetectionConf: 0.95,
      timings: { download: 1.2, pose: 41.7 },
    }));
  it("PoseWebhookPayload (failure)", () =>
    roundtrip(PoseWebhookPayloadSchema, {
      jobId: "job_1",
      status: "failed",
      error: { code: "MULTI_PERSON", message: "Ambiguous detection" },
    }));
  it("MetricsOutput", () => roundtrip(MetricsOutputSchema, metricsOutput));
  it("FaultResult", () => roundtrip(FaultResultSchema, faultResult));
  it("FaultRulesFile", () => roundtrip(FaultRulesFileSchema, rulesFile));
  it("NarrativeInput", () => roundtrip(NarrativeInputSchema, narrativeInput));
  it("NarrativeOutput", () => roundtrip(NarrativeOutputSchema, narrativeOutput));
  it("StoredNarrative", () =>
    roundtrip(StoredNarrativeSchema, {
      output: narrativeOutput,
      source: "claude",
      model: "claude-fable-5",
      validatorRetries: 0,
    }));
  it("CalibrationCreate", () =>
    roundtrip(CalibrationCreateSchema, {
      event: "SHOT_PUT",
      ringEllipse: { cx: 960, cy: 720, rx: 410, ry: 150, rotation: 0.02 },
      deviceOrientation: { alpha: 12.1, beta: 84.2, gamma: -0.4 },
      calibrationStillPath: null,
      athleteId: null,
    }));
  it("Homography", () =>
    roundtrip(HomographySchema, {
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      pixelsPerMeter: 384.2,
      reprojectionError: 0.011,
      ringDiameterM: 2.135,
    }));
  it("ReportModel", () => roundtrip(ReportModelSchema, reportModel));
});

describe("contract rejection paths", () => {
  it("rejects keypoint arrays that are not exactly 17", () => {
    const bad = {
      ...poseOutput,
      frames: [{ idx: 0, t: 0, bbox: null, keypoints: keypoints.slice(0, 16) }],
    };
    expect(PoseOutputSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects confidence outside [0,1]", () => {
    expect(
      MetricsOutputSchema.safeParse({
        ...metricsOutput,
        metrics: { x: { ...metricValue, confidence: 1.2 } },
      }).success
    ).toBe(false);
  });
  it("rejects NaN metric values (finite-only)", () => {
    expect(
      MetricsOutputSchema.safeParse({
        ...metricsOutput,
        metrics: { x: { ...metricValue, value: Number.NaN } },
      }).success
    ).toBe(false);
  });
  it("rejects an unknown job status", () => {
    expect(JobStatusSchema.safeParse("ANALYZING").success).toBe(false);
  });
});

describe("job state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("QUEUED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "POSE_COMPLETE")).toBe(true);
    expect(canTransition("POSE_COMPLETE", "METRICS_COMPLETE")).toBe(true);
    expect(canTransition("METRICS_COMPLETE", "COMPLETE")).toBe(true);
  });
  it("allows quality gate and requeue paths", () => {
    expect(canTransition("POSE_COMPLETE", "LOW_CONFIDENCE")).toBe(true);
    expect(canTransition("PROCESSING", "QUEUED")).toBe(true);
    expect(canTransition("FAILED", "QUEUED")).toBe(true);
  });
  it("rejects skipping and backward transitions", () => {
    expect(canTransition("QUEUED", "COMPLETE")).toBe(false);
    expect(canTransition("COMPLETE", "QUEUED")).toBe(false);
    expect(canTransition("LOW_CONFIDENCE", "PROCESSING")).toBe(false);
    expect(canTransition("METRICS_COMPLETE", "POSE_COMPLETE")).toBe(false);
  });
  it("every status has an entry in the transition table", async () => {
    const { JOB_TRANSITIONS } = await import("../jobs");
    for (const s of JOB_STATUSES) {
      expect(Array.isArray(JOB_TRANSITIONS[s])).toBe(true);
    }
  });
});
