import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import prisma from "@/lib/prisma";
import { softDeleteCustomImplement, updateCustomImplement } from "@/lib/implements";

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

const UpdateCustomImplementSchema = z.object({
  displayLabel: z.string().trim().min(1).max(60).nullable().optional(),
  shortLabel: z.string().trim().min(1).max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  categories: z.array(CategoryEnum).max(8).nullable().optional(),
  active: z.boolean().nullable().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

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
 * PATCH /api/coach/implements/:id
 *
 * Update labels, notes, categories, or active flag. Weight + throwType +
 * unit are immutable — changing them would invalidate every historical PR
 * keyed on this implement. Coach should soft-delete and recreate instead.
 */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireCoach();
    if ("error" in auth) return auth.error;

    const parsed = await parseBody(request, UpdateCustomImplementSchema);
    if (parsed instanceof NextResponse) return parsed;

    const updated = await updateCustomImplement(auth.coachId, id, {
      displayLabel: parsed.displayLabel ?? undefined,
      shortLabel: parsed.shortLabel ?? undefined,
      notes: parsed.notes,
      categories: parsed.categories ?? undefined,
      active: parsed.active ?? undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not owned")) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an implement with that weight and label.",
        },
        { status: 409 }
      );
    }
    logger.error("PATCH /api/coach/implements/[id]", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t update custom implement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coach/implements/:id
 *
 * Soft-delete. Hard-delete would orphan AthleteImplementPR + ThrowLog FK
 * references — soft-delete keeps history intact and just hides the row
 * from pickers. Restore via PATCH { active: true }.
 */
export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireCoach();
    if ("error" in auth) return auth.error;

    await softDeleteCustomImplement(auth.coachId, id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not owned")) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    logger.error("DELETE /api/coach/implements/[id]", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t delete custom implement" },
      { status: 500 }
    );
  }
}
