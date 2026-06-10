import Link from "next/link";
import { Aperture, Upload } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";
import { checkAnalysisAllowance } from "@/lib/analysis/gating";

export const metadata = { title: "Video Analysis 2.0 — Podium Throws" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  PROCESSING: "Processing",
  POSE_COMPLETE: "Measuring",
  METRICS_COMPLETE: "Writing report",
  COMPLETE: "Complete",
  FAILED: "Failed",
  LOW_CONFIDENCE: "Refilm needed",
};

export default async function VideoAnalysis2Page() {
  const { session } = await requireCoachSession();

  const jobs = await prisma.analysisJob.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
      result: { select: { id: true } },
    },
  });

  const firstAthleteId = jobs[0]?.athlete.id ?? null;
  const allowance = firstAthleteId ? await checkAnalysisAllowance(firstAthleteId) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-display">Video Analysis</h1>
          <p className="text-body text-muted">
            Measured biomechanics — every number traceable to the frame it came from.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/coach/video-analysis-2/calibrate" className="btn-secondary">
            <Aperture className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Calibrate
          </Link>
          <Link href="/coach/video-analysis-2/new" className="btn-primary">
            <Upload className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            New analysis
          </Link>
        </div>
      </header>

      {allowance && allowance.quota !== null && (
        <p className="font-mono text-caption tabular-nums text-muted">
          {allowance.used} / {allowance.quota} analyses used this month ({allowance.plan})
        </p>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />}
          title="No analyses yet"
          description="Run the calibration wizard at the ring, film at 240fps, and upload a throw."
          action={
            <Link href="/coach/video-analysis-2/new" className="btn-primary">
              Start your first analysis
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/coach/video-analysis-2/${job.id}`}
                className="card card-interactive flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-semibold">
                    {job.athlete.firstName} {job.athlete.lastName}
                  </p>
                  <p className="text-caption text-muted">
                    {job.event.replace("_", " ")} ·{" "}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-mono text-micro uppercase tracking-wider text-muted">
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
