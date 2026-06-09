import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { parseBody } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import { enqueuePoseJob } from "@/lib/analysis/pose-client";
import { AnalysisEventSchema } from "@/lib/contracts";

export const AnalysisJobCreateSchema = z.object({
  athleteId: z.string().min(1),
  event: AnalysisEventSchema,
  /** R2 key of the uploaded clip (from the upload pipeline). */
  clipPath: z.string().min(1),
  calibrationSessionId: z.string().nullable().optional(),
  fpsDeclared: z.number().positive().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, AnalysisJobCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { athleteId, event, clipPath, calibrationSessionId, fpsDeclared } = parsed;

  if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (calibrationSessionId) {
    const cal = await prisma.calibrationSession.findUnique({
      where: { id: calibrationSessionId },
      select: { userId: true },
    });
    if (!cal || cal.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Calibration session not found" },
        { status: 404 }
      );
    }
  }

  const job = await prisma.analysisJob.create({
    data: {
      userId: session.userId,
      athleteId,
      event,
      clipPath,
      calibrationSessionId: calibrationSessionId ?? null,
      fpsDeclared: fpsDeclared ?? null,
      timings: { uploadedAt: new Date().toISOString() },
    },
  });

  // Fire-and-forget trigger; failure leaves the job QUEUED for the cron retry.
  enqueuePoseJob(job).catch((err) => {
    logger.error("analysis/jobs: pose trigger threw", {
      metadata: { jobId: job.id },
      error: err instanceof Error ? err : new Error(String(err)),
    });
  });

  return NextResponse.json({ success: true, data: job }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const athleteId = request.nextUrl.searchParams.get("athleteId");
  if (athleteId && !(await canAccessAthlete(session.userId, session.role, athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const jobs = await prisma.analysisJob.findMany({
    where: { userId: session.userId, ...(athleteId ? { athleteId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { result: { select: { id: true } } },
  });
  return NextResponse.json({ success: true, data: jobs });
}
