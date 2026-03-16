import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  scoreAdaptationSpeed,
  scoreTransferType,
  scoreSelfFeelingAccuracy,
  scoreLightImplResponse,
  scoreRecoveryProfile,
  computeRecommendedMethod,
} from "@/lib/throws/profile-utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const typing = await prisma.coachTyping.findUnique({
      where: { coachId: coach.id },
    });

    return NextResponse.json({ ok: true, data: typing });
  } catch (err) {
    logger.error("GET /api/coach/my-training/typing", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch typing" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      adaptationSpeedResponses,
      transferTypeResponses,
      selfFeelingResponses,
      lightImplResponses,
      recoveryResponses,
    } = body as {
      adaptationSpeedResponses: Record<string, number>[];
      transferTypeResponses: Record<string, number>[];
      selfFeelingResponses: Record<string, number>[];
      lightImplResponses: Record<string, number>[];
      recoveryResponses: Record<string, number>[];
    };

    // Score each quiz
    const adaptation = scoreAdaptationSpeed(adaptationSpeedResponses);
    const transfer = scoreTransferType(transferTypeResponses);
    const selfFeeling = scoreSelfFeelingAccuracy(selfFeelingResponses);
    const lightImpl = scoreLightImplResponse(lightImplResponses);
    const recovery = scoreRecoveryProfile(recoveryResponses);
    const method = computeRecommendedMethod(adaptation.group, recovery.profile);

    const typing = await prisma.coachTyping.upsert({
      where: { coachId: coach.id },
      update: {
        adaptationSpeedResponses: JSON.stringify(adaptationSpeedResponses),
        transferTypeResponses: JSON.stringify(transferTypeResponses),
        selfFeelingResponses: JSON.stringify(selfFeelingResponses),
        lightImplResponses: JSON.stringify(lightImplResponses),
        recoveryResponses: JSON.stringify(recoveryResponses),
        adaptationGroup: adaptation.group,
        adaptationLabel: adaptation.label,
        adaptationConf: adaptation.confidence,
        transferType: transfer.type,
        transferLabel: transfer.label,
        transferConf: transfer.confidence,
        selfFeelingAccuracy: selfFeeling.accuracy,
        selfFeelingLabel: selfFeeling.label,
        selfFeelingConf: selfFeeling.confidence,
        lightImplResponse: lightImpl.response,
        lightImplLabel: lightImpl.label,
        lightImplConf: lightImpl.confidence,
        recoveryProfile: recovery.profile,
        recoveryLabel: recovery.label,
        recoveryConf: recovery.confidence,
        recommendedMethod: method.method,
        methodReason: method.reason,
        complexDuration: method.complexDuration,
        sessionsToForm: method.sessionsToForm,
        completedAt: new Date(),
      },
      create: {
        coachId: coach.id,
        adaptationSpeedResponses: JSON.stringify(adaptationSpeedResponses),
        transferTypeResponses: JSON.stringify(transferTypeResponses),
        selfFeelingResponses: JSON.stringify(selfFeelingResponses),
        lightImplResponses: JSON.stringify(lightImplResponses),
        recoveryResponses: JSON.stringify(recoveryResponses),
        adaptationGroup: adaptation.group,
        adaptationLabel: adaptation.label,
        adaptationConf: adaptation.confidence,
        transferType: transfer.type,
        transferLabel: transfer.label,
        transferConf: transfer.confidence,
        selfFeelingAccuracy: selfFeeling.accuracy,
        selfFeelingLabel: selfFeeling.label,
        selfFeelingConf: selfFeeling.confidence,
        lightImplResponse: lightImpl.response,
        lightImplLabel: lightImpl.label,
        lightImplConf: lightImpl.confidence,
        recoveryProfile: recovery.profile,
        recoveryLabel: recovery.label,
        recoveryConf: recovery.confidence,
        recommendedMethod: method.method,
        methodReason: method.reason,
        complexDuration: method.complexDuration,
        sessionsToForm: method.sessionsToForm,
      },
    });

    return NextResponse.json({ ok: true, data: typing }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/coach/my-training/typing", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to save typing" }, { status: 500 });
  }
}
