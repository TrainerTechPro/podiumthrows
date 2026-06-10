import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { parseBody } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import { enqueuePoseJob } from "@/lib/analysis/pose-client";
import { checkAnalysisAllowance } from "@/lib/analysis/gating";
import { AnalysisEventSchema } from "@/lib/contracts";

export const AnalysisJobCreateSchema = z.object({
  athleteId: z.string().min(1),
  event: AnalysisEventSchema,
  /** R2 key of the uploaded clip (from the upload pipeline). */
  clipPath: z.string().min(1),
  calibrationSessionId: z.string().nullable().optional(),
  fpsDeclared: z.number().positive().nullable().optional(),
  trimStartS: z.number().nonnegative().nullable().optional(),
  trimEndS: z.number().positive().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, AnalysisJobCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { athleteId, event, clipPath, calibrationSessionId, fpsDeclared, trimStartS, trimEndS } =
    parsed;

  // F2: cap 15 s per clip — enforced on the trim window the pose service
  // will actually extract.
  if (trimStartS != null && trimEndS != null && trimEndS - trimStartS > 15) {
    return NextResponse.json(
      { success: false, error: "Trim the clip to a single throw (max 15 seconds)" },
      { status: 400 }
    );
  }

  if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Tier gating (PRD §8): Free 3/mo, Pro 50/mo, Elite unlimited.
  const allowance = await checkAnalysisAllowance(athleteId);
  if (!allowance) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }
  if (!allowance.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          allowance.plan === "FREE"
            ? "Free plan includes 3 analyses per month — upgrade to Pro for 50."
            : "Monthly analysis quota reached — upgrade to Elite for unlimited analyses.",
      },
      { status: 402 }
    );
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
      trimStartS: trimStartS ?? null,
      trimEndS: trimEndS ?? null,
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
