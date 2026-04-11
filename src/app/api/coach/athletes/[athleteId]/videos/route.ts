import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";
import {
  uploadSingleFile,
  generateAthleteVideoKey,
  getPublicUrl,
  isR2Configured,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/r2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: "Video storage is not configured" },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("video") as File | null;
  if (!file) {
    return NextResponse.json(
      { success: false, error: "No video file provided" },
      { status: 400 }
    );
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: `Unsupported video type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: `Video exceeds ${MAX_VIDEO_SIZE_MB}MB limit` },
      { status: 400 }
    );
  }

  const eventRaw = formData.get("event") as string | null;
  const implementWeightRaw = formData.get("implementWeight");
  const distanceRaw = formData.get("distance");
  const notes = formData.get("notes") as string | null;

  const ALLOWED_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
  type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

  const event: AllowedEvent | null =
    eventRaw && (ALLOWED_EVENTS as readonly string[]).includes(eventRaw)
      ? (eventRaw as AllowedEvent)
      : null;

  function parseFiniteNumber(raw: FormDataEntryValue | null): number | null {
    if (raw == null || raw === "") return null;
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
  }

  const implementWeight = parseFiniteNumber(implementWeightRaw);
  const distance = parseFiniteNumber(distanceRaw);

  const r2Key = generateAthleteVideoKey(athleteId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadSingleFile(r2Key, buffer, file.type);
  const url = getPublicUrl(r2Key);

  const video = await prisma.athleteVideo.create({
    data: {
      athleteProfileId: athleteId,
      uploadedById: ctx.coach.id,
      r2Key,
      url,
      event,
      implementWeight,
      distance,
      notes: notes || null,
    },
  });

  return NextResponse.json({ success: true, data: video }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const videos = await prisma.athleteVideo.findMany({
    where: { athleteProfileId: athleteId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: videos });
}
