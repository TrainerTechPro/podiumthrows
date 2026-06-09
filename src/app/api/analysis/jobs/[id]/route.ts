import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";

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
      poseArtifact: true,
      result: true,
      calibrationSession: {
        select: { id: true, event: true, homography: true, validUntil: true },
      },
    },
  });
  if (!job) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const ownsJob = job.userId === session.userId;
  if (!ownsJob && !(await canAccessAthlete(session.userId, session.role, job.athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: job });
}
