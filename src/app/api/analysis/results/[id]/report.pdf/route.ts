import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { getPresignedDownloadUrl, isR2Configured } from "@/lib/r2";

/** GET /api/analysis/results/:id/report.pdf — :id is the analysis JOB id. */
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
    include: { result: { select: { reportPdfPath: true } } },
  });
  if (!job || !job.result?.reportPdfPath) {
    return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
  }
  const ownsJob = job.userId === session.userId;
  if (!ownsJob && !(await canAccessAthlete(session.userId, session.role, job.athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (isR2Configured()) {
    const url = await getPresignedDownloadUrl(job.result.reportPdfPath, 600);
    return NextResponse.redirect(url);
  }
  const bytes = readFileSync(
    path.join(process.cwd(), "public", "uploads", job.result.reportPdfPath)
  );
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="analysis-${id}.pdf"`,
    },
  });
}
