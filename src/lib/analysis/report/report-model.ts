import {
  ReportModelSchema,
  type FaultResult,
  type MetricsOutput,
  type ReportModel,
  type StoredNarrative,
} from "@/lib/contracts";
import { computePhaseScores, RUBRIC_VERSION } from "./rubric";

/**
 * ReportModel builder (F9, D10): the single source of every string painted
 * into the report and the PDF. assertReportTraceable runs INSIDE the builder
 * — a report whose displayed numbers don't all exist in the metrics JSON
 * cannot be constructed, in production or in tests.
 */

const UNIT_DISPLAY: Record<string, string> = {
  deg: "°",
  m: " m",
  "m/s": " m/s",
  s: " s",
  frame: "",
  ratio: "",
  count: "",
  px: " px",
};

function fmt(value: number, unit: string): string {
  return `${value}${UNIT_DISPLAY[unit] ?? ` ${unit}`}`;
}

export const METHODOLOGY: string[] = [
  "Joint positions are estimated per frame by a benchmarked pose model, then stabilized: low-confidence points are discarded (never guessed), left/right identities are enforced by trajectory continuity, short occlusions are spline-filled and flagged, and trajectories are smoothed with a OneEuro filter tuned to preserve release dynamics.",
  "Angles (separation, trunk, knee) are measured between body segments on the stabilized keypoints at the cited frame. Every value in this report links to the exact frames it was measured on.",
  "Release is detected from the wrist-velocity peak combined with elbow extension. Phase boundaries come from deterministic kinematic rules; phase scores apply the published rubric to measured sub-metrics only.",
  "Velocity, height, and displacement appear only when the clip was filmed with a completed calibration: the ring's known diameter fixes the pixel-to-meter scale. Without calibration those rows read 'requires calibration' — they are never estimated.",
  "Faults compare measured values against coach-authored target ranges. We do not display energy percentages or efficiency scores: they cannot be measured from video and are excluded by design.",
];

const NUMERAL_RE = /\d+(?:\.\d+)?/g;

/**
 * The Stage-5 gate: every numeral displayed on a fault card or rubric row
 * must exist in the metrics JSON (metric values, frameRefs, target ranges
 * carried on the fault). Phase scores are derived by the published rubric
 * and are stamped with rubricVersion instead.
 */
export function assertReportTraceable(
  report: ReportModel,
  metrics: MetricsOutput,
  faults: FaultResult[]
): void {
  const allowed = new Set<number>();
  for (const match of JSON.stringify(metrics).match(NUMERAL_RE) ?? []) {
    allowed.add(Number.parseFloat(match));
  }
  for (const match of JSON.stringify(faults).match(NUMERAL_RE) ?? []) {
    allowed.add(Number.parseFloat(match));
  }

  const offending: string[] = [];
  const check = (where: string, text: string) => {
    for (const match of text.match(NUMERAL_RE) ?? []) {
      if (!allowed.has(Number.parseFloat(match))) {
        offending.push(`${where}: "${match}"`);
      }
    }
  };

  for (const card of report.faultCards) {
    check(`faultCard(${card.fault.ruleId}).displayValue`, card.displayValue);
    check(`faultCard(${card.fault.ruleId}).displayTarget`, card.displayTarget);
  }
  for (const phase of report.phaseScores) {
    for (const item of phase.items) {
      if (item.value.value !== null && !allowed.has(item.value.value)) {
        offending.push(`phase(${phase.phase}).${item.metricKey}: ${item.value.value}`);
      }
    }
  }

  if (offending.length > 0) {
    throw new Error(
      `Report contains numbers not traceable to analysis_results.metrics:\n${offending.join("\n")}`
    );
  }
}

export function buildReportModel(args: {
  metrics: MetricsOutput;
  faults: FaultResult[];
  narrative: StoredNarrative;
  athleteName: string;
  dateIso: string;
  drills: ReportModel["drills"];
  keyframeByRule?: Record<string, string>;
  watermark: boolean;
  rulesVersion: string;
}): ReportModel {
  const {
    metrics,
    faults,
    narrative,
    athleteName,
    dateIso,
    drills,
    keyframeByRule = {},
    watermark,
    rulesVersion,
  } = args;

  const report: ReportModel = {
    header: {
      event: metrics.event,
      athleteName,
      date: dateIso,
      calibrated: metrics.calibrated,
    },
    phaseScores: computePhaseScores(metrics),
    faultCards: faults.map((fault) => ({
      fault,
      displayValue: `${fault.faultName}: ${fmt(fault.measuredValue, fault.unit)}`,
      displayTarget: `target ${fmt(fault.targetRange[0], fault.unit)}–${fmt(fault.targetRange[1], fault.unit)}`,
      thumbnailPath: keyframeByRule[fault.ruleId] ?? null,
    })),
    drills,
    coachSummary: narrative.output.coachSummary,
    methodology: METHODOLOGY,
    watermark,
    rubricVersion: RUBRIC_VERSION,
    rulesVersion,
  };

  const parsed = ReportModelSchema.parse(report);
  assertReportTraceable(parsed, metrics, faults);
  return parsed;
}
