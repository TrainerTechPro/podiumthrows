import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runWeeklyRecapJob } from "@/lib/recap/run-job";
import { assertCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/weekly-recap
 *
 * Vercel Cron — Sunday 7pm UTC (`0 19 * * 0` in vercel.json).
 *
 * Job logic lives in @/lib/recap/run-job so it can be invoked from tests
 * and admin scripts. Next.js Route Handler files only allow specific
 * named exports (GET/POST/etc. + `dynamic`/`runtime`/`maxDuration`/...) —
 * any extra export breaks the build.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runWeeklyRecapJob();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error("Weekly recap cron error", { context: "cron/weekly-recap", error: err });
    return NextResponse.json({ success: false, error: "Weekly recap job failed" }, { status: 500 });
  }
}
