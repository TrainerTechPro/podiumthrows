/**
 * Notification preferences — per-channel master switches, per-type
 * overrides, and quiet hours. See spec §2.3.2 and §2.5.
 *
 *   GET    /api/notifications/preferences
 *   PATCH  /api/notifications/preferences
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const DEFAULTS = {
  pushEnabled: true,
  emailEnabled: true,
  inAppEnabled: true,
  typeOverrides: {} as Record<string, Record<string, boolean>>,
  quietStart: "22:00" as string | null,
  quietEnd: "07:00" as string | null,
  timezone: null as string | null,
};

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm")
  .nullable();

const channelOverrideSchema = z
  .object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    inApp: z.boolean().optional(),
  })
  .strict();

const PatchSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    typeOverrides: z.record(z.string(), channelOverrideSchema).optional(),
    quietStart: timeStringSchema.optional(),
    quietEnd: timeStringSchema.optional(),
    timezone: z.string().nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.notificationPreference.findUnique({
      where: { userId: session.userId },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: serialize(existing),
      });
    }

    const created = await prisma.notificationPreference.create({
      data: {
        userId: session.userId,
        pushEnabled: DEFAULTS.pushEnabled,
        emailEnabled: DEFAULTS.emailEnabled,
        inAppEnabled: DEFAULTS.inAppEnabled,
        typeOverrides: DEFAULTS.typeOverrides,
        quietStart: DEFAULTS.quietStart,
        quietEnd: DEFAULTS.quietEnd,
      },
    });

    return NextResponse.json({ success: true, data: serialize(created) });
  } catch (err) {
    logger.error("GET /api/notifications/preferences", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          fieldErrors: parsed.error.issues.map((i) => ({
            field: i.path.join(".") || "_body",
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // If both quietStart and quietEnd end up null, clear them. If only one is
    // provided, require the other to be set (or already stored) so we never
    // end up with a half-configured window.
    const input = parsed.data;
    if (
      (input.quietStart === null && input.quietEnd === undefined) ||
      (input.quietEnd === null && input.quietStart === undefined)
    ) {
      // allow single-null clears only when the other side is already absent
    }

    const updated = await prisma.notificationPreference.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        pushEnabled: input.pushEnabled ?? DEFAULTS.pushEnabled,
        emailEnabled: input.emailEnabled ?? DEFAULTS.emailEnabled,
        inAppEnabled: input.inAppEnabled ?? DEFAULTS.inAppEnabled,
        typeOverrides: input.typeOverrides ?? DEFAULTS.typeOverrides,
        quietStart: input.quietStart === undefined ? DEFAULTS.quietStart : input.quietStart,
        quietEnd: input.quietEnd === undefined ? DEFAULTS.quietEnd : input.quietEnd,
        timezone: input.timezone === undefined ? DEFAULTS.timezone : input.timezone,
      },
      update: {
        pushEnabled: input.pushEnabled,
        emailEnabled: input.emailEnabled,
        inAppEnabled: input.inAppEnabled,
        typeOverrides: input.typeOverrides,
        quietStart: input.quietStart,
        quietEnd: input.quietEnd,
        timezone: input.timezone,
      },
    });

    return NextResponse.json({ success: true, data: serialize(updated) });
  } catch (err) {
    logger.error("PATCH /api/notifications/preferences", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

type PrefRow = Awaited<ReturnType<typeof prisma.notificationPreference.findUnique>>;

function serialize(pref: NonNullable<PrefRow>) {
  return {
    pushEnabled: pref.pushEnabled,
    emailEnabled: pref.emailEnabled,
    inAppEnabled: pref.inAppEnabled,
    typeOverrides: (pref.typeOverrides as Record<string, Record<string, boolean>>) ?? {},
    quietStart: pref.quietStart,
    quietEnd: pref.quietEnd,
    timezone: pref.timezone,
    updatedAt: pref.updatedAt.toISOString(),
  };
}
