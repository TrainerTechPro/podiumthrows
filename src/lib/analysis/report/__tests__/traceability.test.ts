import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  syntheticThrow,
  fixtureHomography,
} from "../../__fixtures__/synthetic-throw";
import { runMetricsEngine } from "../../metrics/engine";
import { evaluateFaults, loadShotPutRules } from "../../faults/engine";
import { generateNarrative } from "../../narrative/claude";
import { buildReportModel, assertReportTraceable } from "../report-model";
import { computePhaseScores, scoreItem } from "../rubric";
import { renderReportPdf } from "../pdf";
import type { NarrativeInput } from "@/lib/contracts";

/**
 * Stage-5 VERIFY: end-to-end fixture run — synthetic throw → metrics →
 * faults → narrative (template path; no network in tests) → ReportModel →
 * actual PDF bytes — with the traceability gate proving every displayed
 * number exists in analysis_results.metrics.
 */

async function runFixturePipeline() {
  const pose = syntheticThrow();
  const metrics = runMetricsEngine({
    pose,
    event: "SHOT_PUT",
    homography: fixtureHomography,
    hand: "right",
  });
  const faults = evaluateFaults(metrics);
  const narrativeInput: NarrativeInput = {
    event: "SHOT_PUT",
    athleteContext: { level: null, recentFaultIds: [] },
    metrics: metrics.metrics,
    faults,
    drillOptions: [
      { id: "d1", name: "Half-turn separation throw", description: null, tags: ["separation"] },
      { id: "d2", name: "Firm block stand throw", description: null, tags: ["block"] },
      { id: "d3", name: "Slow-tempo South African", description: null, tags: ["rhythm", "release_mechanics", "posture"] },
    ],
  };
  const narrative = await generateNarrative(narrativeInput, {
    callModel: async () => null, // force schema-failure → retry → template path
  });
  const report = buildReportModel({
    metrics,
    faults,
    narrative,
    athleteName: "Fixture Athlete",
    dateIso: "2026-06-09",
    drills: narrative.output.drillSelections.map((sel) => {
      const d = narrativeInput.drillOptions.find((o) => o.id === sel.drillId)!;
      return { id: d.id, name: d.name, description: d.description, rationale: sel.rationale };
    }),
    watermark: false,
    rulesVersion: loadShotPutRules().version,
  });
  return { metrics, faults, narrative, report };
}

describe("end-to-end fixture run (Stage-5 VERIFY)", () => {
  it("produces a report whose every displayed number traces to metrics", async () => {
    const { metrics, faults, report } = await runFixturePipeline();
    // The gate already ran inside buildReportModel; run it again explicitly.
    expect(() => assertReportTraceable(report, metrics, faults)).not.toThrow();
    expect(report.faultCards.length).toBeGreaterThan(0);
  });

  it("the gate actually rejects an untraceable number", async () => {
    const { metrics, faults, report } = await runFixturePipeline();
    const tampered = {
      ...report,
      faultCards: [
        {
          ...report.faultCards[0],
          displayValue: "Energy efficiency: 73.4", // confabulated
        },
        ...report.faultCards.slice(1),
      ],
    };
    expect(() => assertReportTraceable(tampered, metrics, faults)).toThrow(/73.4/);
  });

  it("renders a real PDF with pages and bytes", async () => {
    const { report } = await runFixturePipeline();
    const bytes = await renderReportPdf(report);
    expect(bytes.length).toBeGreaterThan(2000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    writeFileSync("/tmp/va2-fixture-report.pdf", bytes);
  });

  it("is deterministic at the ReportModel layer", async () => {
    const a = await runFixturePipeline();
    const b = await runFixturePipeline();
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
  });
});

describe("rubric", () => {
  it("scores 10 in band, decays linearly outside, floors at 0", () => {
    expect(scoreItem(40, [35, 45])).toBe(10);
    expect(scoreItem(30, [35, 45])).toBe(5); // 5 under, band 10 → 10 − 5 = 5
    expect(scoreItem(20, [35, 45])).toBe(0); // 15 under → floored
  });

  it("excludes null metrics and marks unmeasurable phases null", () => {
    const metrics = runMetricsEngine({
      pose: syntheticThrow(),
      event: "SHOT_PUT",
      homography: null, // release_angle null → delivery still scored on others
    });
    const scores = computePhaseScores(metrics);
    const delivery = scores.find((s) => s.phase === "delivery")!;
    // release_angle is null (uncalibrated) but knee + duration are measured.
    expect(delivery.score).not.toBeNull();
    const releaseItem = delivery.items.find((i) => i.metricKey === "release_angle")!;
    expect(releaseItem.value.value).toBeNull();
  });
});
