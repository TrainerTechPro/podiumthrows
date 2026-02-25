import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getDrillLibrary } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

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
    return NextResponse.json({ drills });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
    const body = await req.json();

    const { name, description, videoUrl, event, category, implementKg, difficulty, cues, athleteTypes } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Valid category is required (CE, SDE, SPE, GPE)" }, { status: 400 });
    }
    if (event && !VALID_EVENTS.includes(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }
    if (athleteTypes && Array.isArray(athleteTypes)) {
      for (const at of athleteTypes) {
        if (!VALID_ATHLETE_TYPES.includes(at)) {
          return NextResponse.json({ error: `Invalid athlete type: ${at}` }, { status: 400 });
        }
      }
    }

    const drill = await prisma.drill.create({
      data: {
        coachId: coach.id,
        name: name.trim(),
        description: description?.trim() || null,
        videoUrl: videoUrl?.trim() || null,
        event: event || null,
        category,
        implementKg: implementKg != null ? parseFloat(implementKg) : null,
        difficulty: difficulty || null,
        cues: Array.isArray(cues) ? cues.filter((c: string) => c.trim()) : [],
        athleteTypes: Array.isArray(athleteTypes) ? athleteTypes : [],
        isGlobal: false,
      },
    });

    return NextResponse.json({ drill }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
