/**
 * Golden-set labeling CLI (PRD §9 Phase 0).
 *
 * Steps through a clip's frames (by timestamp; open the clip in QuickTime /
 * mpv alongside — frame-step with arrow keys there) and records:
 *   - release frame
 *   - phase boundaries
 *   - keypoint ground truth at critical instants (entered inline or merged
 *     from a JSON file exported by an external annotator, e.g. CVAT)
 *
 * Output: <clip>.labels.json validating GoldenLabelsSchema — the exact shape
 * stored in golden_set_clips.labels. Pass --db to upsert the row (requires
 * POSTGRES_PRISMA_URL).
 *
 * Usage:
 *   npx tsx scripts/eval/label-clips.ts <clip.mp4> --event SHOT_PUT
 *     [--keypoints-from gt.json] [--db]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  GoldenLabelsSchema,
  type GoldenLabels,
  GtFrameSchema,
} from "@/lib/analysis/eval/labels";
import { SHOTPUT_PHASES } from "@/lib/contracts";

function probe(clip: string): { fps: number; totalFrames: number } {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-count_frames",
      "-show_entries", "stream=r_frame_rate,nb_read_frames",
      "-of", "json",
      clip,
    ],
    { encoding: "utf8" }
  );
  const stream = JSON.parse(out).streams?.[0];
  const [num, den] = String(stream.r_frame_rate).split("/").map(Number);
  return {
    fps: den ? num / den : num,
    totalFrames: Number(stream.nb_read_frames),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const clip = args[0];
  if (!clip || !existsSync(clip)) {
    console.error("Usage: tsx scripts/eval/label-clips.ts <clip> --event SHOT_PUT [--keypoints-from gt.json] [--db]");
    process.exit(1);
  }
  const event = (args[args.indexOf("--event") + 1] ?? "SHOT_PUT") as GoldenLabels["event"];
  const kpFile = args.includes("--keypoints-from")
    ? args[args.indexOf("--keypoints-from") + 1]
    : null;

  const { fps, totalFrames } = probe(clip);
  console.log(`\n${clip}\n  fps: ${fps.toFixed(2)}  frames: ${totalFrames}  duration: ${(totalFrames / fps).toFixed(2)}s`);
  console.log(`  Frame N is at t = N / ${fps.toFixed(2)}s. Step frames in QuickTime (←/→) or mpv (,/.)\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const askInt = async (q: string): Promise<number | null> => {
    const raw = (await rl.question(q)).trim();
    if (raw === "" || raw === "-") return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 0 || n >= totalFrames) {
      console.log(`  must be 0..${totalFrames - 1} (or blank to skip)`);
      return askInt(q);
    }
    return n;
  };

  const releaseFrame = await askInt("Release frame (blank if not visible): ");

  const phaseBoundaries: GoldenLabels["phaseBoundaries"] = [];
  console.log(`\nPhase boundaries (blank start = phase absent). Order: ${SHOTPUT_PHASES.join(" → ")}`);
  for (const phase of SHOTPUT_PHASES) {
    const start = await askInt(`  ${phase} start: `);
    if (start === null) continue;
    const end = await askInt(`  ${phase} end:   `);
    if (end === null || end < start) {
      console.log("  end must be ≥ start; skipping phase");
      continue;
    }
    phaseBoundaries.push({ phase, startFrame: start, endFrame: end });
  }

  let keypointGT: GoldenLabels["keypointGT"] = [];
  if (kpFile) {
    const parsed = JSON.parse(readFileSync(kpFile, "utf8"));
    keypointGT = (Array.isArray(parsed) ? parsed : parsed.keypointGT).map(
      (f: unknown) => GtFrameSchema.parse(f)
    );
    console.log(`\nMerged keypoint GT for ${keypointGT.length} frame(s) from ${kpFile}`);
  } else {
    console.log("\nNo --keypoints-from file; keypointGT left empty (PCK rows need it).");
  }

  const notes = (await rl.question("Notes (difficulty, lighting…): ")).trim() || null;
  rl.close();

  const labels: GoldenLabels = GoldenLabelsSchema.parse({
    schemaVersion: "1.0",
    event,
    fps,
    totalFrames,
    releaseFrame,
    phaseBoundaries,
    keypointGT,
    notes,
  });

  const outPath = clip.replace(/\.[^.]+$/, "") + ".labels.json";
  writeFileSync(outPath, JSON.stringify(labels, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (args.includes("--db")) {
    const { default: prisma } = await import("@/lib/prisma");
    const row = await prisma.goldenSetClip.create({
      data: {
        clipPath: clip,
        event,
        labels: labels as object,
        difficulty: notes ? [notes] : [],
        source: "label-clips-cli",
      },
    });
    console.log(`Upserted golden_set_clips row ${row.id}`);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
