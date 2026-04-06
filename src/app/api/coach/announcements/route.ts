import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getCoachAnnouncements, createAnnouncement } from "@/lib/data/team-hub";

/* ─── GET — list all non-expired announcements for the coach ─────────────── */

export async function GET() {
  try {
    const { coach } = await requireCoachApi();
    const data = await getCoachAnnouncements(coach.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/announcements", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch announcements." }, { status: 500 });
  }
}

/* ─── POST — create a new announcement ──────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const { title, body: bodyText, priority, pinned, targetType, targetId, expiresAt } = body;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    if (typeof bodyText !== "string" || !bodyText.trim()) {
      return NextResponse.json({ error: "body is required." }, { status: 400 });
    }

    // Validate priority
    const validPriorities = ["NORMAL", "URGENT"];
    if (priority !== undefined && !validPriorities.includes(priority as string)) {
      return NextResponse.json(
        { error: `priority must be one of: ${validPriorities.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate targetType
    const validTargetTypes = ["ALL", "GROUP", "INDIVIDUAL"];
    if (targetType !== undefined && !validTargetTypes.includes(targetType as string)) {
      return NextResponse.json(
        { error: `targetType must be one of: ${validTargetTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Parse expiresAt
    let expiresAtDate: Date | null = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      expiresAtDate = new Date(expiresAt as string);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt date." }, { status: 400 });
      }
    }

    const result = await createAnnouncement(coach.id, {
      title: title.trim(),
      body: bodyText.trim(),
      priority: typeof priority === "string" ? priority : undefined,
      pinned: typeof pinned === "boolean" ? pinned : undefined,
      targetType: typeof targetType === "string" ? targetType : undefined,
      targetId: typeof targetId === "string" ? targetId : null,
      expiresAt: expiresAtDate,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/announcements", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to create announcement." }, { status: 500 });
  }
}
