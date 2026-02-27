import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new NextResponse("Missing id", { status: 400 });

    const video = await prisma.drillVideo.findUnique({ where: { id } });
    if (!video) return new NextResponse("Not found", { status: 404 });

    // Access check
    if (currentUser.role === "ATHLETE") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile || video.athleteId !== profile.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) return new NextResponse("Forbidden", { status: 403 });
      if (video.coachId !== coachProfile.id && video.athleteId) {
        const athlete = await prisma.athleteProfile.findUnique({
          where: { id: video.athleteId },
          select: { coachId: true },
        });
        if (athlete?.coachId !== coachProfile.id) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
    }

    if (video.filePath.startsWith("http")) {
      return NextResponse.redirect(video.filePath);
    }

    const fileStats = await stat(video.filePath);
    const fileBuffer = await readFile(video.filePath);

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileStats.size - 1;
      const chunk = fileBuffer.slice(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileStats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": video.mimeType,
        },
      });
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": video.mimeType,
        "Content-Length": String(fileStats.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    logger.error("Serve drill video error", { context: "drill-videos/serve", error: error });
    return new NextResponse("Internal server error", { status: 500 });
  }
}
