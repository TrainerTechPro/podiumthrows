import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseQuery } from "@/lib/api-schemas";
import { aggregateHistoryDays } from "@/lib/throws/history";

const EventEnum = z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

const HistoryQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "ytd", "all", "custom"]).default("30d"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  events: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(EventEnum)),
  implements: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((n) => parseFloat(n)).filter((n) => Number.isFinite(n)) : []
    ),
  prOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  // Reserved for Task 12 (cursor-based pagination); ignored by the current handler.
  cursor: z.string().optional(),
});

function rangeToStartDate(range: z.infer<typeof HistoryQuerySchema>["range"], start?: string): Date {
  const now = new Date();
  switch (range) {
    case "7d":  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "all": return new Date(0); // epoch
    case "custom": return start ? new Date(`${start}T00:00:00`) : new Date(0);
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint is athlete-only by design: it returns the currently
    // signed-in athlete's history. Coach-side history (e.g. for a coach
    // viewing one of their athletes) is served via a separate route that
    // accepts an explicit athleteId and runs through canAccessAthlete().
    // Mixing both shapes in one endpoint would require dropping the
    // implicit-athlete contract and forcing every athlete-side caller to
    // pass their own id, which is a worse default.
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = parseQuery(request, HistoryQuerySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { range, start, end, events, implements: implementFilter, prOnly } = parsed;

    const profile = await prisma.athleteProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 403 });
    }

    const startDate = rangeToStartDate(range, start);
    const endDate = end ? new Date(`${end}T23:59:59`) : new Date();

    const [throwLogs, blockLogs] = await Promise.all([
      prisma.throwLog.findMany({
        where: {
          athleteId: profile.id,
          date: { gte: startDate, lte: endDate },
          ...(events.length > 0 ? { event: { in: events } } : {}),
          ...(implementFilter.length > 0 ? { implementWeight: { in: implementFilter } } : {}),
          ...(prOnly ? { isPersonalBest: true } : {}),
        },
        orderBy: { date: "desc" },
        // Sanity cap to prevent OOM on athletes with multi-year history.
        // TODO(pagination): Task 12 will replace this with cursor-based pagination.
        take: 2000,
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          assignment: {
            athleteId: profile.id,
            assignedDate: { gte: startDate.toISOString().slice(0, 10), lte: endDate.toISOString().slice(0, 10) },
            status: { in: ["IN_PROGRESS", "COMPLETED"] },
            ...(events.length > 0 ? { session: { event: { in: events } } } : {}),
          },
        },
        include: {
          assignment: {
            select: {
              id: true,
              assignedDate: true,
              athleteId: true,
              status: true,
              session: { select: { event: true, name: true } },
            },
          },
          block: { select: { blockType: true, config: true } },
        },
        orderBy: { createdAt: "desc" },
        // Sanity cap to prevent OOM on athletes with multi-year history.
        // TODO(pagination): Task 12 will replace this with cursor-based pagination.
        take: 2000,
      }),
    ]);

    const days = aggregateHistoryDays({ throwLogs, blockLogs });

    const sessions = days.filter((d) => d.assignmentId != null).length;
    const throws = days.reduce((sum, d) => sum + d.totalThrows, 0);

    return NextResponse.json({
      success: true,
      data: {
        days,
        nextCursor: null,
        totals: { sessions, throws },
      },
    });
  } catch (error) {
    logger.error("GET /api/throws/history error", { context: "throws/history", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
