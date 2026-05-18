import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getDrillLibrary } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { parseBody, CoachDrillCreateSchema } from "@/lib/api-schemas";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
const VALID_CATEGORIES = ["CE", "SDE", "SPE", "GPE"];
const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const VALID_ATHLETE_TYPES = ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"];

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
    const sp = req.nextUrl.searchParams;

    const filters: {
      event?: string;
      category?: string;
      difficulty?: string;
      athleteType?: string;
      search?: string;
    } = {};

    const event = sp.get("event");
    if (event && VALID_EVENTS.includes(event)) filters.event = event;

    const category = sp.get("category");
    if (category && VALID_CATEGORIES.includes(category)) filters.category = category;

    const difficulty = sp.get("difficulty");
    if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) filters.difficulty = difficulty;

    const athleteType = sp.get("athleteType");
    if (athleteType && VALID_ATHLETE_TYPES.includes(athleteType)) filters.athleteType = athleteType;

    const search = sp.get("search");
    if (search) filters.search = search;

    const drills = await getDrillLibrary(coach.id, filters);
    return NextResponse.json({ success: true, data: { drills } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();

    const parsed = await parseBody(req, CoachDrillCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      name,
      description,
      videoUrl,
      event,
      category,
      implementKg,
      difficulty,
      cues,
      athleteTypes,
    } = parsed;

    const drill = await prisma.drill.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description?.trim() || null,
        videoUrl: videoUrl?.trim() || null,
        event: event ?? null,
        category,
        implementKg: implementKg ?? null,
        difficulty: difficulty ?? null,
        cues: cues?.filter((c) => c.trim()) ?? [],
        athleteTypes: athleteTypes ?? [],
        isGlobal: false,
      },
    });

    return NextResponse.json({ success: true, data: { drill } }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
