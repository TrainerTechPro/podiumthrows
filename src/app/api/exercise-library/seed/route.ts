import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import exerciseData from "@/../public/data/exercise-library.json";
import { logger } from "@/lib/logger";

// Infer equipment from exercise title
function inferEquipment(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith("barbell") || t.startsWith("ez-bar") || t.startsWith("ez bar")) return "Barbell";
  if (t.startsWith("dumbbell")) return "Dumbbell";
  if (t.startsWith("cable")) return "Cable";
  if (t.startsWith("lever") || t.startsWith("sled")) return "Machine";
  if (t.startsWith("smith")) return "Smith Machine";
  if (t.startsWith("suspended") || t.includes("trx") || t.includes("suspension")) return "Suspension Trainer";
  if (t.startsWith("medicine ball") || t.startsWith("medicine")) return "Medicine Ball";
  if (t.startsWith("kettlebell")) return "Kettlebell";
  if (t.startsWith("band") || t.includes("band-assisted") || t.includes("resistance band")) return "Resistance Band";
  if (t.startsWith("trap bar") || t.startsWith("trap")) return "Trap Bar";
  if (t.startsWith("machine-assisted") || t.startsWith("assisted")) return "Machine";
  if (t.startsWith("weighted")) return "Weighted Bodyweight";
  if (t.startsWith("self-assisted") || t.startsWith("bodyweight") || t.startsWith("inverted") || t.startsWith("push-up") || t.startsWith("lying") || t.startsWith("hanging") || t.startsWith("wall")) return "Bodyweight";
  if (t.includes("barbell")) return "Barbell";
  if (t.includes("dumbbell")) return "Dumbbell";
  if (t.includes("cable")) return "Cable";
  if (t.includes("machine") || t.includes("lever")) return "Machine";
  return "Other";
}

// Clean HTML entities from text
function cleanText(text: string | undefined | null): string | null {
  if (!text) return null;
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || null;
}

interface RawExercise {
  title: string;
  group: string;
  url?: string;
  utility?: string;
  mechanics?: string;
  force?: string;
  target?: string[];
  synergists?: string[];
  stabilizers?: string[];
  preparation?: string;
  execution?: string;
  comments?: string;
}

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Only coaches can seed the exercise library" },
        { status: 403 }
      );
    }

    // Check if library already has data
    const existingCount = await prisma.exerciseLibrary.count();
    if (existingCount > 100) {
      return NextResponse.json({
        success: true,
        data: { message: `Library already populated with ${existingCount} exercises`, seeded: 0 },
      });
    }

    const exercises = exerciseData as RawExercise[];
    let seeded = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < exercises.length; i += batchSize) {
      const batch = exercises.slice(i, i + batchSize);
      const records = batch.map((ex) => ({
        name: ex.title,
        muscleGroup: ex.group,
        equipment: inferEquipment(ex.title),
        target: ex.target && ex.target.length > 0 ? JSON.stringify(ex.target) : null,
        synergists: ex.synergists && ex.synergists.length > 0 ? JSON.stringify(ex.synergists) : null,
        stabilizers: ex.stabilizers && ex.stabilizers.length > 0 ? JSON.stringify(ex.stabilizers) : null,
        preparation: cleanText(ex.preparation),
        execution: cleanText(ex.execution),
        tips: cleanText(ex.comments) === "None" ? null : cleanText(ex.comments),
        force: ex.force || null,
        mechanics: ex.mechanics || null,
        utility: ex.utility || null,
        videoUrl: null,
        videoEmbed: null,
      }));

      await prisma.exerciseLibrary.createMany({
        data: records,
        skipDuplicates: true,
      });
      seeded += records.length;
    }

    return NextResponse.json({
      success: true,
      data: { message: `Seeded ${seeded} exercises into the library`, seeded },
    });
  } catch (error) {
    logger.error("Seed exercise library error", { context: "exercise-library/seed", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to seed exercise library" },
      { status: 500 }
    );
  }
}
