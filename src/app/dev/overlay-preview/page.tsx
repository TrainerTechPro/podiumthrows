import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SmoothedPoseSchema, PoseOutputSchema } from "@/lib/contracts";
import { runTemporalPipeline } from "@/lib/analysis/temporal/pipeline";
import { segmentShotPutPhases } from "@/lib/analysis/metrics/phases";
import { OverlayPlayer } from "@/components/analysis/OverlayPlayer";

/**
 * Dev-only harness for the OverlayPlayer Playwright smoke test
 * (e2e/analysis-overlay.spec.ts). 404s outside development/test.
 */
export const dynamic = "force-dynamic";

export default function OverlayPreviewPage() {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_DEV_ROUTES) {
    notFound();
  }

  const raw = PoseOutputSchema.parse(
    JSON.parse(
      readFileSync(
        path.join(process.cwd(), "services/pose/fixtures/fixture-pose.json"),
        "utf8"
      )
    )
  );
  const { smoothed } = runTemporalPipeline(raw);
  const pose = SmoothedPoseSchema.parse(smoothed);
  const phases = segmentShotPutPhases(pose, Math.floor(pose.frames.length * 0.6));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-heading text-title mb-4">Overlay preview (dev)</h1>
      <OverlayPlayer pose={pose} phaseBoundaries={phases} videoUrl={null} />
    </main>
  );
}
