/**
 * GET /api/releases/unseen
 *
 * Returns the latest Release targeting this user's role that they
 * haven't yet acknowledged. Used by the what's-new modal on dashboard
 * layout mount. Returns `{ release: null }` when nothing to show.
 *
 * Older unseen releases are intentionally skipped — if three releases
 * stacked up while the user was away, they see only the newest. The
 * older ones are implicitly marked as seen when they ack the newest,
 * so the modal doesn't spam three nights in a row.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const audienceFilter = session.role === "COACH" ? ["COACH", "BOTH"] : ["ATHLETE", "BOTH"];

    const latest = await prisma.release.findFirst({
      where: { audience: { in: audienceFilter } },
      orderBy: { publishedAt: "desc" },
      select: {
        slug: true,
        title: true,
        bullets: true,
        ctaText: true,
        ctaHref: true,
        publishedAt: true,
      },
    });

    if (!latest) {
      return NextResponse.json({ success: true, data: { release: null } });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { lastSeenReleaseSlug: true },
    });

    if (user?.lastSeenReleaseSlug === latest.slug) {
      return NextResponse.json({ success: true, data: { release: null } });
    }

    return NextResponse.json({
      success: true,
      data: {
        release: {
          slug: latest.slug,
          title: latest.title,
          bullets: Array.isArray(latest.bullets) ? (latest.bullets as unknown as string[]) : [],
          ctaText: latest.ctaText,
          ctaHref: latest.ctaHref,
          publishedAt: latest.publishedAt.toISOString(),
        },
      },
    });
  } catch (err) {
    logger.error("GET /api/releases/unseen", { context: "api", error: err });
    // Fail-soft: on error, return no release rather than breaking the
    // dashboard. The modal is a nice-to-have, not a critical path.
    return NextResponse.json({ success: true, data: { release: null } });
  }
}
