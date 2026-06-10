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

  // Defense in depth vs IDOR: only presign keys this job legitimately owns.
  // clipPath must be under the owner's upload prefix (also enforced at job
  // creation); artifact paths are server-generated under analysis/<jobId>/.
  const ownsKey = (key: string | null, prefix: string): string | null =>
    key && key.startsWith(prefix) && !key.includes("..") ? key : null;
  const clipKey = ownsKey(job.clipPath, `analysis/clips/${job.userId}/`);
  const artifactPrefix = `analysis/${job.id}/`;

  const [smoothedPoseUrl, clipUrl, reportPdfUrl] = await Promise.all([
    toUrl(ownsKey(job.poseArtifact?.smoothedPath ?? null, artifactPrefix)),
    toUrl(clipKey),
    toUrl(ownsKey(job.result?.reportPdfPath ?? null, artifactPrefix)),
  ]);
  return NextResponse.json({
    success: true,
    data: { smoothedPoseUrl, clipUrl, reportPdfUrl },
  });
}
