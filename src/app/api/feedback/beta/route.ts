/**
 * POST /api/feedback/beta
 *
 * Beta-tester feedback widget endpoint. Accepts a short typed message
 * (BUG/CONFUSION/FEATURE/PRAISE), auto-captured client context, and an
 * optional screenshot as a data URL. Screenshot is persisted to R2
 * (local filesystem in dev), and the row is written to BetaFeedback.
 *
 * Rate-limited to 10 submissions per hour per user — beta testers
 * shouldn't be able to spam the inbox even if they hit the button
 * repeatedly.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  isR2Configured,
  uploadSingleFile,
  saveFileLocally,
  generateImageKey,
  isAllowedImageType,
  MAX_IMAGE_SIZE_MB,
} from "@/lib/r2";

const BetaFeedbackSchema = z.object({
  type: z.enum(["BUG", "CONFUSION", "FEATURE", "PRAISE"]),
  body: z.string().trim().min(1, "Please describe what happened").max(4000),
  url: z.string().max(2048),
  userAgent: z.string().max(512).optional().nullable(),
  viewport: z
    .string()
    .regex(/^\d+x\d+$/, "Viewport must be WxH")
    .max(16)
    .optional()
    .nullable(),
  consoleErrors: z
    .array(z.object({ message: z.string().max(2000), timestamp: z.number().optional() }))
    .max(20)
    .optional()
    .nullable(),
  /** Data URL: "data:image/png;base64,..." — optional. */
  screenshot: z
    .string()
    .max(8 * 1024 * 1024)
    .optional()
    .nullable(),
});

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimit(`beta-feedback:${session.userId}`, {
      maxAttempts: 10,
      windowMs: 60 * 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: "You've sent a lot of feedback lately — take a breath, then try again.",
        },
        { status: 429 }
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = BetaFeedbackSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Optional screenshot — decode, validate mime + size, upload.
    let screenshotKey: string | null = null;
    if (data.screenshot) {
      const decoded = parseDataUrl(data.screenshot);
      if (!decoded) {
        return NextResponse.json(
          { success: false, error: "Screenshot must be a data:image/... URL" },
          { status: 400 }
        );
      }
      if (!isAllowedImageType(decoded.mime)) {
        return NextResponse.json(
          { success: false, error: `Screenshot type ${decoded.mime} not allowed` },
          { status: 400 }
        );
      }
      const mb = decoded.buffer.length / (1024 * 1024);
      if (mb > MAX_IMAGE_SIZE_MB) {
        return NextResponse.json(
          {
            success: false,
            error: `Screenshot too large (${mb.toFixed(1)}MB, max ${MAX_IMAGE_SIZE_MB}MB)`,
          },
          { status: 400 }
        );
      }
      const ext =
        decoded.mime === "image/png" ? ".png" : decoded.mime === "image/jpeg" ? ".jpg" : ".img";
      const key = generateImageKey(session.userId, `feedback${ext}`).replace(
        "images/",
        "feedback/"
      );
      try {
        if (isR2Configured()) {
          await uploadSingleFile(key, decoded.buffer, decoded.mime);
        } else {
          await saveFileLocally(key, decoded.buffer);
        }
        screenshotKey = key;
      } catch (err) {
        // Don't reject the whole submission — textual feedback is still
        // valuable even if the upload fails. Log and move on.
        logger.error("Beta feedback screenshot upload failed", {
          context: "api/feedback",
          metadata: { userId: session.userId },
          error: err,
        });
      }
    }

    const row = await prisma.betaFeedback.create({
      data: {
        userId: session.userId,
        userRole: session.role,
        type: data.type,
        body: data.body,
        url: data.url,
        userAgent: data.userAgent ?? null,
        viewport: data.viewport ?? null,
        consoleErrors: (data.consoleErrors as object | undefined) ?? undefined,
        screenshotKey,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      data: { feedbackId: row.id, createdAt: row.createdAt.toISOString() },
    });
  } catch (err) {
    logger.error("POST /api/feedback/beta", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
