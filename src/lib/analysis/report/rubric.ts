import type { MetricsOutput, PhaseScore } from "@/lib/contracts";

/**
 * Published phase-score rubric (F9): each phase score is a weighted average
 * of measured sub-metrics — visible in-app, versioned on every result.
 *
 * Item scoring: 10 inside the target band; outside, score decays linearly by
 * (deviation ÷ band width) × 10, floored at 0. Items whose metric is null are
 * excluded; a phase with no measurable items scores null (shown as "not
 * measurable", never a fake number). Bands are COACH_TUNABLE alongside the
 * fault rules.
 */

export const RUBRIC_VERSION = "rubric-1.0.0";

export interface RubricItemSpec {
  metricKey: string;
  label: string;
  weight: number;
  target: [number, number];
}

export const SHOTPUT_RUBRIC: Record<string, RubricItemSpec[]> = {
  power_position: [
    {
      metricKey: "hip_shoulder_separation_at_power_position",
      label: "Hip–shoulder separation",
      weight: 0.6,
      target: [35, 45],
    },
    {
      metricKey: "trunk_inclination_at_power_position",
      label: "Trunk inclination",
      weight: 0.4,
      target: [20, 50],
    },
  ],
  drive: [
    {
      metricKey: "rear_leg_sweep_height_ratio",
      label: "Rear-leg sweep height",
      weight: 1,
      target: [0.2, 0.6],
    },
  ],
  delivery: [
    { metricKey: "release_angle", label: "Release angle", weight: 0.4, target: [32, 40] },
    {
      metricKey: "block_knee_angle_at_release",
      label: "Block-knee angle",
      weight: 0.3,
      target: [160, 180],
    },
    {
      metricKey: "delivery_duration",
      label: "Delivery duration",
      weight: 0.3,
      target: [0.18, 0.35],
    },
  ],
};

export function scoreItem(value: number, target: [number, number]): number {
  const [lo, hi] = target;
  if (value >= lo && value <= hi) return 10;
  const dev = value < lo ? lo - value : value - hi;
  const band = hi - lo;
  if (band <= 0) return 0;
  return Math.max(0, round1(10 - (dev / band) * 10));
}

export function computePhaseScores(metrics: MetricsOutput): PhaseScore[] {
  return Object.entries(SHOTPUT_RUBRIC).map(([phase, specs]) => {
    const items = specs
      .map((spec) => {
        const value = metrics.metrics[spec.metricKey];
        return value ? { spec, value } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const measurable = items.filter((i) => i.value.value !== null);
    let score: number | null = null;
    if (measurable.length > 0) {
      const totalWeight = measurable.reduce((s, i) => s + i.spec.weight, 0);
      score = round1(
        measurable.reduce(
          (s, i) => s + scoreItem(i.value.value!, i.spec.target) * i.spec.weight,
          0
        ) / totalWeight
      );
    }

    return {
      phase,
      score,
      items: items.map((i) => ({
        metricKey: i.spec.metricKey,
        label: i.spec.label,
        value: i.value,
        weight: i.spec.weight,
      })),
    };
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;
