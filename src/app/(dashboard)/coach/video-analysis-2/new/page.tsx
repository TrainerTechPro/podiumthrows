import Link from "next/link";
import { Ruler, Zap } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { UploadTrimmer } from "@/components/analysis/UploadTrimmer";

export const metadata = { title: "New analysis — Podium Throws" };
export const dynamic = "force-dynamic";

export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: { calibrationSessionId?: string; mode?: string };
}) {
  const { coach } = await requireCoachSession();
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const calibrationSessionId = searchParams.calibrationSessionId ?? null;
  const mode = calibrationSessionId ? "calibrated" : searchParams.mode === "quick" ? "quick" : null;

  if (athletes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="font-heading text-display">New analysis</h1>
        <p className="text-body text-muted">
          Add an athlete to your roster first —{" "}
          <Link href="/coach/athletes" className="text-primary-500 hover:underline">
            manage athletes
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="font-heading text-display">New analysis</h1>
        <p className="text-body text-muted">How was this footage filmed?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/coach/video-analysis-2/calibrate"
            className="card card-interactive space-y-2 p-5"
            data-testid="choose-calibrated"
          >
            <Ruler className="h-5 w-5 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
            <p className="font-heading text-section">Calibrated session</p>
            <p className="text-caption text-muted">
              Run the tripod wizard at the ring before filming. Unlocks release
              velocity, height, and distances (Elite), with full-confidence
              angle metrics.
            </p>
          </Link>
          <Link
            href="/coach/video-analysis-2/new?mode=quick"
            className="card card-interactive space-y-2 p-5"
            data-testid="choose-quick"
          >
            <Zap className="h-5 w-5 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
            <p className="font-heading text-section">Quick analysis</p>
            <p className="text-caption text-muted">
              For existing clips, handheld, or off-angle footage. No velocity or
              distance; angle metrics carry confidence grades so you know what
              to trust.
            </p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="font-heading text-display">New analysis</h1>
      {mode === "quick" ? (
        <p className="text-caption text-muted" data-testid="quick-mode-note">
          Quick analysis: no velocity or distance — those need a calibrated
          session. Angle metrics carry HIGH/MEDIUM/LOW confidence grades;
          timing and phase metrics are view-robust.{" "}
          <Link
            href="/coach/video-analysis-2/calibrate"
            className="text-primary-500 hover:underline"
          >
            Switch to a calibrated session
          </Link>
        </p>
      ) : (
        <p className="text-caption text-muted">
          Filming under this calibration session — velocity and distances
          unlock on Elite.
        </p>
      )}
      <UploadTrimmer athletes={athletes} calibrationSessionId={calibrationSessionId} />
    </div>
  );
}
