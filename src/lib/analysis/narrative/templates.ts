import type { NarrativeInput, NarrativeOutput } from "@/lib/contracts";

/**
 * Deterministic fallback narrative (F7): used when the model's output fails
 * numeral validation twice, or when no API key is configured. Built ONLY
 * from input values, so it can never confabulate — boring beats wrong.
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

export function templateNarrative(input: NarrativeInput): NarrativeOutput {
  const faultLines = input.faults.map(
    (f) =>
      `${f.faultName}: measured ${fmt(f.measuredValue, f.unit)} against a target of ` +
      `${fmt(f.targetRange[0], f.unit)}–${fmt(f.targetRange[1], f.unit)}.`
  );

  // Deterministic hedge mirroring prompt rule 5: on limited footage the
  // template must not state findings flatly either.
  const hedge =
    input.clipConfidence === "LOW"
      ? " Footage quality limits confidence on these readings — treat them as worth checking on better footage."
      : input.clipConfidence === "MEDIUM"
        ? " Filming conditions cap confidence on this clip — verify key readings when refilming."
        : "";

  const coachSummary =
    (faultLines.length > 0
      ? `Measured review: ${faultLines.join(" ")} Work the prescribed drills and refilm.`
      : `No rule thresholds were crossed on this throw's measured values. Keep building on this pattern and refilm to confirm consistency.`) +
    hedge;

  const phaseCommentary = input.faults.slice(0, 5).map((f) => ({
    phase: f.metricKey,
    comment: `Measured ${fmt(f.measuredValue, f.unit)} (target ${fmt(f.targetRange[0], f.unit)}–${fmt(f.targetRange[1], f.unit)}).`,
  }));

  // Deterministic drill pick: first matching option per fault tag, no dupes.
  const seen = new Set<string>();
  const drillSelections: NarrativeOutput["drillSelections"] = [];
  for (const fault of input.faults) {
    const option = input.drillOptions.find(
      (d) => !seen.has(d.id) && d.tags.some((t) => fault.drillTags.includes(t))
    );
    if (option) {
      seen.add(option.id);
      drillSelections.push({
        drillId: option.id,
        rationale: `Addresses ${fault.faultName.toLowerCase()} (measured ${fmt(fault.measuredValue, fault.unit)}).`,
      });
    }
  }

  return { coachSummary, phaseCommentary, drillSelections };
}
