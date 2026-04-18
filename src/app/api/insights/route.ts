// src/app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type AthleteInsight } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { InsightsListQuerySchema } from "@/lib/api-schemas";
import { toWire } from "@/lib/insights/serialize";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = InsightsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }
    const { athleteId, mode, category, limit, includeDismissed } = parsed.data;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let rawRows: AthleteInsight[];

    if (mode === "latest") {
      const categoryFilter = category
        ? Prisma.sql`AND "category"::text = ${category}`
        : Prisma.empty;
      const dismissFilter = includeDismissed ? Prisma.empty : Prisma.sql`AND "dismissedAt" IS NULL`;

      rawRows = await prisma.$queryRaw<AthleteInsight[]>(Prisma.sql`
        SELECT DISTINCT ON ("athleteId", "category", "metric") *
        FROM "AthleteInsight"
        WHERE "athleteId" = ${athleteId}
          ${categoryFilter}
          ${dismissFilter}
        ORDER BY "athleteId", "category", "metric", "computedAt" DESC
        LIMIT ${limit}
      `);
    } else {
      rawRows = await prisma.athleteInsight.findMany({
        where: {
          athleteId,
          ...(category ? { category } : {}),
          ...(includeDismissed ? {} : { dismissedAt: null }),
        },
        orderBy: { computedAt: "desc" },
        take: limit,
      });
    }

    // Strip coach-only evidence from athlete payloads.
    const role = currentUser.role === "COACH" ? "COACH" : "ATHLETE";
    const insights = rawRows.map((r) => toWire(r, role));

    return NextResponse.json({
      success: true,
      data: { insights, total: insights.length },
    });
  } catch (error) {
    logger.error("Get insights error", { context: "insights/route", error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
