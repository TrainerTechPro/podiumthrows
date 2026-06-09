/**
 * Benchmark runner CLI (PRD §9 Phase 0, §11 gates).
 *
 * Inputs: a directory of pose outputs and a directory of labels, matched by
 * basename: <clipId>.json (PoseOutput contract) ↔ <clipId>.labels.json
 * (GoldenLabels). Optional --pred <dir> with <clipId>.metrics.json
 * (MetricsOutput) supplies release-frame + phase-boundary predictions.
 *
 * Deterministic — same inputs, same numbers, no LLM anywhere.
 *
 * Usage:
 *   npx tsx scripts/eval/run-benchmark.ts --pose <dir> --labels <dir>
 *     [--pred <dir>] [--out report.json]
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { PoseOutputSchema, MetricsOutputSchema } from "@/lib/contracts";
import { GoldenLabelsSchema } from "@/lib/analysis/eval/labels";
import {
  runBenchmark,
  type ClipPrediction,
} from "@/lib/analysis/eval/benchmark";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function fmt(x: number | null, digits = 3): string {
  return x === null ? "—" : x.toFixed(digits);
}

function main() {
  const poseDir = arg("--pose");
  const labelsDir = arg("--labels");
  const predDir = arg("--pred");
  const outPath = arg("--out");
  if (!poseDir || !labelsDir) {
    console.error("Usage: tsx scripts/eval/run-benchmark.ts --pose <dir> --labels <dir> [--pred <dir>] [--out report.json]");
    process.exit(1);
  }

  const inputs = readdirSync(poseDir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".labels.json"))
    .sort()
    .flatMap((file) => {
      const clipId = basename(file, ".json");
      const labelsPath = join(labelsDir, `${clipId}.labels.json`);
      if (!existsSync(labelsPath)) {
        console.warn(`skip ${clipId}: no labels file`);
        return [];
      }
      const pose = PoseOutputSchema.parse(
        JSON.parse(readFileSync(join(poseDir, file), "utf8"))
      );
      const labels = GoldenLabelsSchema.parse(
        JSON.parse(readFileSync(labelsPath, "utf8"))
      );
      let prediction: ClipPrediction | null = null;
      const predPath = predDir ? join(predDir, `${clipId}.metrics.json`) : null;
      if (predPath && existsSync(predPath)) {
        const metrics = MetricsOutputSchema.parse(
          JSON.parse(readFileSync(predPath, "utf8"))
        );
        prediction = {
          releaseFrame: metrics.metrics.release_frame?.value ?? null,
          phaseBoundaries: metrics.phaseBoundaries,
        };
      }
      return [{ clipId, pose, labels, prediction }];
    });

  if (inputs.length === 0) {
    console.error("No matched pose/label pairs found.");
    process.exit(1);
  }

  const report = runBenchmark(inputs);
  const a = report.aggregate;

  console.log(`\nBenchmark — model: ${report.modelId}  clips: ${report.clips.length}`);
  console.log("┌──────────────────────────────┬──────────┬─────────────────────────┐");
  console.log("│ metric                       │ value    │ gate (PRD §11)          │");
  console.log("├──────────────────────────────┼──────────┼─────────────────────────┤");
  console.log(`│ PCK@0.05 upper body          │ ${fmt(a.pckUpper).padEnd(8)} │ ≥ 0.90                  │`);
  console.log(`│ PCK@0.05 lower body          │ ${fmt(a.pckLower).padEnd(8)} │ ≥ 0.85                  │`);
  console.log(`│ L/R swap rate                │ ${fmt(a.swapRate).padEnd(8)} │ < 0.01 (post-temporal)  │`);
  console.log(`│ release within ±2fr @60fps   │ ${fmt(a.release.withinTolerance).padEnd(8)} │ ≥ 0.90                  │`);
  console.log(`│ release mean |err| (frames)  │ ${fmt(a.release.meanAbs, 2).padEnd(8)} │ —                       │`);
  console.log(`│ phase-boundary IoU (mean)    │ ${fmt(a.phaseIouMean).padEnd(8)} │ ≥ 0.85                  │`);
  console.log("└──────────────────────────────┴──────────┴─────────────────────────┘");

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${outPath}`);
  }
}

main();
