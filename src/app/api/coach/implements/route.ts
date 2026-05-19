import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import prisma from "@/lib/prisma";
import { createCustomImplement, listCustomImplementsForCoach } from "@/lib/implements";

const ThrowTypeEnum = z.enum(["HAMMER", "SHOT", "DISCUS", "JAVELIN", "WEIGHT_THROW"]);
const CategoryEnum = z.enum([
  "MEN_SENIOR",
  "WOMEN_SENIOR",
  "MEN_U20",
  "WOMEN_U20",
  "HS_BOYS",
  "HS_GIRLS",
  "TRAINING_HEAVY",
  "TRAINING_LIGHT",
]);

const CreateCustomImplementSchema = z.object({
  throwType: ThrowTypeEnum,
  weight: z.number().positive("Weight must be greater than zero"),
  unit: z.enum(["kg", "lb"]),
  displayLabel: z.string().trim().min(1).max(60).nullable().optional(),
  shortLabel: z.string().trim().min(1).max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  categories: z.array(CategoryEnum).max(8).optional(),
});

async function requireCoach() {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return {
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) {
    return {
      error: NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 }),
    };
  }
  return { coachId: coach.id };
}

/**
 * GET /api/coach/implements
 *
 * Returns the calling coach's custom implements only (no globals — the global
 * catalog is rendered separately in the settings UI for context). Includes
 * inactive rows so the UI can offer "restore" on soft-deleted ones.
 */
export async function GET() {
  try {
    const auth = await requireCoach();
    if ("error" in auth) return auth.error;

    const items = await listCustomImplementsForCoach(auth.coachId);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    logger.error("GET /api/coach/implements", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t load custom implements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/coach/implements
 *
 * Create a custom implement on the calling coach's catalog. Returns 409 on
 * (coach, throwType, weight, unit, displayLabel) collision so the UI can
 * surface "you already have this implement".
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCoach();
    if ("error" in auth) return auth.error;

    const parsed = await parseBody(request, CreateCustomImplementSchema);
    if (parsed instanceof NextResponse) return parsed;

    const created = await createCustomImplement(auth.coachId, {
      throwType: parsed.throwType,
      weight: parsed.weight,
      unit: parsed.unit,
      displayLabel: parsed.displayLabel ?? undefined,
      shortLabel: parsed.shortLabel ?? undefined,
      notes: parsed.notes ?? undefined,
      categories: parsed.categories,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an implement with that weight and label.",
        },
        { status: 409 }
      );
    }
    logger.error("POST /api/coach/implements", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t create custom implement" },
      { status: 500 }
    );
  }
}
