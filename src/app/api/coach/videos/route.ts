import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError, getCoachVideos } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_CATEGORIES = ["training", "competition", "drill", "analysis"];

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

    const videos = await getCoachVideos(coach.id, filters);
    return NextResponse.json({ videos });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[videos GET] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();

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
    } = body as {
      url?: string;
      storageKey?: string;
      title?: string;
      description?: string;
      event?: string;
      athleteId?: string;
      category?: string;
      tags?: string[];
      durationSec?: number;
      fileSizeMb?: number;
      thumbnailUrl?: string;
    };

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    // Validate event if provided
    if (event && !VALID_EVENTS.includes(event)) {
      return NextResponse.json(
        { error: `Invalid event. Must be one of: ${VALID_EVENTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate athlete belongs to coach
    if (athleteId) {
      const athlete = await prisma.athleteProfile.findFirst({
        where: { id: athleteId, coachId: coach.id },
        select: { id: true },
      });
      if (!athlete) {
        return NextResponse.json(
          { error: "Athlete not found" },
          { status: 404 }
        );
      }
    }

    const video = await prisma.videoUpload.create({
      data: {
        coachId: coach.id,
        url,
        storageKey: storageKey || null,
        title: title.trim(),
        description: description?.trim() || null,
        event: event ? (event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN") : null,
        athleteId: athleteId || null,
        category: category || null,
        tags: tags || [],
        durationSec: durationSec || null,
        fileSizeMb: fileSizeMb || null,
        thumbnailUrl: thumbnailUrl || null,
        status: "ready",
      },
    });

    return NextResponse.json({ video: { id: video.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[videos POST] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
