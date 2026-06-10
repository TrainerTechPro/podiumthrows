import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { parseBody } from "@/lib/api-schemas";
import { CalibrationCreateSchema } from "@/lib/contracts";
import {
  computeHomography,
  isCalibrationValid,
} from "@/lib/analysis/calibration/homography";

/** Clips uploaded within this window inherit the calibration (F1 step 4). */
const SESSION_VALID_HOURS = 6;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, CalibrationCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { event, ringEllipse, deviceOrientation, calibrationStillPath, athleteId } = parsed;

  if (athleteId && !(await canAccessAthlete(session.userId, session.role, athleteId))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Server-side homography + reprojection gate (F1 acceptance < 2%).
  // An invalid fit is stored WITHOUT a homography: the session still
  // standardizes filming and angles/timing work; velocity shows
  // "requires calibration" rather than a number we can't stand behind.
  const homography = computeHomography(ringEllipse, event);
  const calibrated = isCalibrationValid(homography);

  const row = await prisma.calibrationSession.create({
    data: {
      userId: session.userId,
      athleteId: athleteId ?? null,
      event,
      ringEllipse: ringEllipse as object,
      deviceOrientation: deviceOrientation ?? Prisma.JsonNull,
      homography: calibrated && homography ? (homography as object) : Prisma.JsonNull,
      calibrationStillPath: calibrationStillPath ?? null,
      validUntil: new Date(Date.now() + SESSION_VALID_HOURS * 3600 * 1000),
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id: row.id,
        calibrated,
        reprojectionError: homography?.reprojectionError ?? null,
        validUntil: row.validUntil,
      },
    },
    { status: 201 }
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const sessions = await prisma.calibrationSession.findMany({
    where: { userId: session.userId, validUntil: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      event: true,
      homography: true,
      validUntil: true,
      createdAt: true,
      athleteId: true,
    },
  });
  return NextResponse.json({
    success: true,
    data: sessions.map((s) => ({ ...s, calibrated: s.homography !== null })),
  });
}
