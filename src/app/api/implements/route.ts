import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { listImplements } from "@/lib/implements";
import type { ImplementType, ImplementCategory } from "@prisma/client";

const VALID_THROW_TYPES: ReadonlyArray<ImplementType> = ["HAMMER", "SHOT", "DISCUS", "JAVELIN"];
const VALID_CATEGORIES: ReadonlyArray<ImplementCategory> = [
  "MEN_SENIOR",
  "WOMEN_SENIOR",
  "MEN_U20",
  "WOMEN_U20",
  "HS_BOYS",
  "HS_GIRLS",
  "TRAINING_HEAVY",
  "TRAINING_LIGHT",
];

/**
 * GET /api/implements?throwType=&category=
 *
 * Returns the active catalog, optionally filtered. Authenticated users only.
 * Returns rows with categoryTags joined for picker UI.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const throwTypeParam = searchParams.get("throwType");
    const categoryParam = searchParams.get("category");

    const throwType =
      throwTypeParam && VALID_THROW_TYPES.includes(throwTypeParam as ImplementType)
        ? (throwTypeParam as ImplementType)
        : undefined;
    const category =
      categoryParam && VALID_CATEGORIES.includes(categoryParam as ImplementCategory)
        ? (categoryParam as ImplementCategory)
        : undefined;

    const items = await listImplements({ throwType, category });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    logger.error("GET /api/implements", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Failed to load implements" },
      { status: 500 }
    );
  }
}
