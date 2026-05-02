/**
 * GET /api/me/export
 *
 * Returns the authenticated user's full data export as a downloadable
 * JSON file. Rate-limited to 1 request per 24h per user — exports are
 * expensive (one large query graph) and shouldn't be hammered.
 *
 * Response shape: { _meta: { ... }, data: { ... } } per
 * src/lib/data-export/types.ts. Content-Disposition forces the
 * browser to download instead of render.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildExportForUser } from "@/lib/data-export/build";
import { logger } from "@/lib/logger";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`me-export:${session.userId}`, {
    maxAttempts: 1,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Exports are limited to once a day. Try again tomorrow.",
      },
      { status: 429 }
    );
  }

  const startedAt = Date.now();
  let envelope;
  try {
    envelope = await buildExportForUser(session.userId);
  } catch (err) {
    logger.error("data-export build failed", {
      context: "api/me/export",
      metadata: { userId: session.userId },
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to build export" }, { status: 500 });
  }

  const body = JSON.stringify(envelope, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `podium-export-${session.userId}-${date}.json`;

  logger.info("data-export complete", {
    context: "api/me/export",
    metadata: {
      userId: session.userId,
      role: session.role,
      payloadBytes: body.length,
      durationMs: Date.now() - startedAt,
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
