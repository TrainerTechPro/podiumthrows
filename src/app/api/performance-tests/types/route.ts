import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── GET — list active performance test types (catalog) ── */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const types = await prisma.performanceTestType.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: types });
  } catch (error) {
    logger.error("GET /api/performance-tests/types", { context: "performance-tests", error });
    return NextResponse.json(
      { success: false, error: "Failed to load test types" },
      { status: 500 }
    );
  }
}
