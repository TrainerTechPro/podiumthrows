import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError, getCoachVideos } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBody, CoachVideoCreateSchema } from "@/lib/api-schemas";
import { toServeUrl } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const url = new URL(req.url);

    const filters = {
      event: url.searchParams.get("event") || undefined,
      category: url.searchParams.get("category") || undefined,
      athleteId: url.searchParams.get("athleteId") || undefined,
      search: url.searchParams.get("search") || undefined,
    };

    const rows = await getCoachVideos(coach.id, filters);
    const videos = await Promise.all(
      rows.map(async (v) => ({
        ...v,
        url: (await toServeUrl(v.url, { key: v.storageKey })) ?? v.url,
        thumbnailUrl: await toServeUrl(v.thumbnailUrl),
      }))
    );
    return NextResponse.json({ success: true, data: { videos } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos GET Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const parsed = await parseBody(req, CoachVideoCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      url,
      storageKey,
      title,
      description,
      event,
      athleteId,
      category,
      tags,
      durationSec,
      fileSizeMb,
      thumbnailUrl,
      status,
    } = parsed;

    const initialStatus = status ?? "ready";

    // Validate athlete belongs to coach
    if (athleteId) {
      const athlete = await prisma.athleteProfile.findFirst({
        where: { id: athleteId, coachId: coach.id },
        select: { id: true },
      });
      if (!athlete) {
        return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
      }
    }

    const video = await prisma.videoUpload.create({
      data: {
        coachId: coach.id,
        url,
        storageKey: storageKey ?? null,
        title: title.trim(),
        description: description?.trim() || null,
        event: event ?? null,
        athleteId: athleteId ?? null,
        category: category ?? null,
        tags: tags ?? [],
        durationSec: durationSec ?? null,
        fileSizeMb: fileSizeMb ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        status: initialStatus,
      },
    });

    return NextResponse.json({ success: true, data: { video: { id: video.id } } }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos POST Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
