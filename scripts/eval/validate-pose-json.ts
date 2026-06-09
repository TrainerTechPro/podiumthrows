/**
 * Validate a pose JSON file against the PoseOutput contract.
 * Used by the Stage-3 VERIFY and services/pose/DEPLOY.md smoke check.
 *
 *   npx tsx scripts/eval/validate-pose-json.ts /tmp/pose.json
 */
import { readFileSync } from "node:fs";
import { PoseOutputSchema } from "@/lib/contracts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/eval/validate-pose-json.ts <pose.json>");
  process.exit(1);
}

const result = PoseOutputSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
if (!result.success) {
  console.error("INVALID against PoseOutputSchema:");
  console.error(result.error.issues.slice(0, 10));
  process.exit(1);
}

const { frames, modelId, modelVersion, fps, resolution } = result.data;
const detected = frames.filter((f) => f.bbox !== null).length;
console.log(
  `VALID PoseOutput: ${frames.length} frames (${detected} with detections), ` +
    `model ${modelId}@${modelVersion}, ${fps}fps ${resolution.width}x${resolution.height}`
);
