import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { getPresignedDownloadUrl, isR2Configured } from "@/lib/r2";

/**
 * Resolves client-fetchable URLs for a job's artifacts: the smoothed pose
 * JSON (overlay player), the clip, and the PDF. R2 → short-lived presigned
 * GETs; local dev → /uploads/<key> (public dir).
 */
async function toUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  if (isR2Configured()) return getPresignedDownloadUrl(key, 600);
  return `/uploads/${key}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.analysisJob.findUnique({
    where: { id },
    include: {
      poseArtifact: { select: { smoothedPath: true } },
      result: { select: { reportPdfPath: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const ownsJob = job.userId === session.userId;
  if (!ownsJob && !(await canAccessAthlete(session.userId, session.role, job.athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const [smoothedPoseUrl, clipUrl, reportPdfUrl] = await Promise.all([
    toUrl(job.poseArtifact?.smoothedPath ?? null),
    toUrl(job.clipPath),
    toUrl(job.result?.reportPdfPath ?? null),
  ]);
  return NextResponse.json({
    success: true,
    data: { smoothedPoseUrl, clipUrl, reportPdfUrl },
  });
}
