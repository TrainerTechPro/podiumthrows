import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getTeamLinks, createTeamLink } from "@/lib/data/team-hub";

/* ─── GET — list all team links for the coach ────────────────────────────── */

export async function GET() {
  try {
    const { coach } = await requireCoachApi();
    const data = await getTeamLinks(coach.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/team-links", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t fetch team links." }, { status: 500 });
  }
}

/* ─── POST — create a new team link ─────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const { title, url, category, icon } = body;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "title is required." }, { status: 400 });
    }
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ success: false, error: "url is required." }, { status: 400 });
    }

    // Basic URL format validation
    try {
      new URL(url.trim());
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format." }, { status: 400 });
    }

    const result = await createTeamLink(coach.id, {
      title: title.trim(),
      url: url.trim(),
      category: typeof category === "string" ? category.trim() || undefined : undefined,
      icon: typeof icon === "string" ? icon.trim() || undefined : undefined,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/team-links", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t create team link." }, { status: 500 });
  }
}
