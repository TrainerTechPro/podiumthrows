import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getNotifications, resolveNotificationContext } from "@/lib/notifications";
import { categoryToTypes, type NotificationCategory } from "@/lib/notifications/deep-links";
import { logger } from "@/lib/logger";

const QuerySchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return 50;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
    }),
  unreadOnly: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  category: z
    .enum(["all", "feedback", "prs", "team", "system"])
    .nullable()
    .optional()
    .transform((v) => (v ?? "all") as NotificationCategory),
  types: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : null)),
});

/* ─── GET — cursor-paginated notifications ───────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await resolveNotificationContext(session);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      unreadOnly: url.searchParams.get("unreadOnly"),
      category: url.searchParams.get("category"),
      types: url.searchParams.get("types"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    // Explicit `types=` wins over category mapping (used internally for
    // single-type filters like the legacy bell dropdown).
    const fromCategory = categoryToTypes(parsed.data.category, ctx.effectiveRole);
    const types =
      parsed.data.types && parsed.data.types.length > 0 ? parsed.data.types : fromCategory;

    const result = await getNotifications(ctx.profileId, ctx.effectiveRole, {
      cursor: parsed.data.cursor ?? null,
      limit: parsed.data.limit,
      unreadOnly: parsed.data.unreadOnly,
      types,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    logger.error("GET /api/notifications", { context: "api", metadata: { error: String(err) } });
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications." },
      { status: 500 }
    );
  }
}
