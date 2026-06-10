import {
  FaultRulesFileSchema,
  type FaultResult,
  type FaultRule,
  type FaultRulesFile,
  type MetricsOutput,
} from "@/lib/contracts";
import shotputRulesJson from "./rules/shotput.json";

/**
 * Rules engine (F6): versioned rules in config, not code. Each rule =
 * metric expression + threshold band + severity mapping + frame-evidence
 * selector + drill tags.
 *
 * Trust rules:
 * - a rule never fires on a null-valued or below-minConfidence metric —
 *   false accusations destroy coach trust faster than misses (PRD §11);
 * - severity = the band with the highest deviationGte that the measured
 *   deviation reaches;
 * - evidence frames come from the metric's own frameRefs (provenance).
 */

export function loadShotPutRules(): FaultRulesFile {
  return FaultRulesFileSchema.parse(shotputRulesJson);
}

function deviation(rule: FaultRule, value: number): number | null {
  const [lo, hi] = rule.targetRange;
  switch (rule.comparator) {
    case "below":
      return value < lo ? lo - value : null;
    case "above":
      return value > hi ? value - hi : null;
    case "outside":
      if (value < lo) return lo - value;
      if (value > hi) return value - hi;
      return null;
  }
}

function severityFor(rule: FaultRule, dev: number): FaultResult["severity"] {
  let chosen: FaultResult["severity"] = rule.severityBands[0].severity;
  let best = -Infinity;
  for (const band of rule.severityBands) {
    if (dev >= band.deviationGte && band.deviationGte >= best) {
      best = band.deviationGte;
      chosen = band.severity;
    }
  }
  return chosen;
}

export function evaluateFaults(
  metrics: MetricsOutput,
  rulesFile: FaultRulesFile = loadShotPutRules()
): FaultResult[] {
  if (rulesFile.event !== metrics.event) {
    throw new Error(
      `Rules file is for ${rulesFile.event}, metrics are for ${metrics.event}`
    );
  }

  const faults: FaultResult[] = [];
  for (const rule of rulesFile.rules) {
    const metric = metrics.metrics[rule.metricKey];
    if (!metric || metric.value === null) continue;
    if (metric.confidence < rule.minConfidence) continue;

    const dev = deviation(rule, metric.value);
    if (dev === null) continue;

    faults.push({
      ruleId: rule.ruleId,
      severity: severityFor(rule, dev),
      measuredValue: metric.value,
      targetRange: rule.targetRange,
      evidenceFrames: metric.frameRefs,
      drillTags: rule.drillTags,
      faultName: rule.faultName,
      metricKey: rule.metricKey,
      unit: rule.unit,
    });
  }
  return faults;
}
