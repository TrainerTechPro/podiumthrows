import Link from "next/link";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { UploadTrimmer } from "@/components/analysis/UploadTrimmer";

export const metadata = { title: "New analysis — Podium Throws" };
export const dynamic = "force-dynamic";

export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: { calibrationSessionId?: string };
}) {
  const { coach } = await requireCoachSession();
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="font-heading text-display">New analysis</h1>
      {athletes.length === 0 ? (
        <p className="text-body text-muted">
          Add an athlete to your roster first —{" "}
          <Link href="/coach/athletes" className="text-primary-500 hover:underline">
            manage athletes
          </Link>
          .
        </p>
      ) : (
        <UploadTrimmer
          athletes={athletes}
          calibrationSessionId={searchParams.calibrationSessionId ?? null}
        />
      )}
      <p className="text-caption text-muted">
        Filming with a calibration session unlocks velocity and distances (Elite).{" "}
        <Link href="/coach/video-analysis-2/calibrate" className="text-primary-500 hover:underline">
          Run the calibration wizard
        </Link>{" "}
        at the ring before filming.
      </p>
    </div>
  );
}
