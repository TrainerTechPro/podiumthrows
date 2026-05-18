import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBody, UserModeUpdateSchema } from "@/lib/api-schemas";

/* ─── PUT — toggle User.activeMode ──────────────────────────────────────── */

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const parsed = await parseBody(req, UserModeUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const targetMode = parsed.mode;

    // If switching to TRAINING, verify coach has enabled it
    if (targetMode === "TRAINING") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { trainingEnabled: true },
      });

      if (!coach?.trainingEnabled) {
        return NextResponse.json(
          { success: false, error: "Training Mode is not enabled for this account." },
          { status: 403 }
        );
      }
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { activeMode: targetMode },
    });

    const isProduction = process.env.NODE_ENV === "production";
    const cookieValue = [
      `active-mode=${targetMode}`,
      "Path=/",
      "SameSite=Strict",
      "Max-Age=31536000", // 1 year
      ...(isProduction ? ["Secure"] : []),
    ].join("; ");

    const response = NextResponse.json({ success: true, data: { mode: targetMode } });
    response.headers.append("Set-Cookie", cookieValue);
    return response;
  } catch (err) {
    logger.error("PUT /api/user/mode", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
