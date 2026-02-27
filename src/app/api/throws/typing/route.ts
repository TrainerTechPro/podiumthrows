import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import {
  scoreAdaptationSpeed,
  scoreTransferType,
  scoreSelfFeelingAccuracy,
  scoreLightImplResponse,
  scoreRecoveryProfile,
  computeRecommendedMethod,
} from "@/lib/throws/profile-utils";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, quizResponses } = body;

    if (!athleteId || !quizResponses) {
      return NextResponse.json({ success: false, error: "athleteId and quizResponses are required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Score each quiz
    const adaptationResult = quizResponses.adaptationSpeed
      ? scoreAdaptationSpeed(quizResponses.adaptationSpeed)
      : null;
    const transferResult = quizResponses.transferType
      ? scoreTransferType(quizResponses.transferType)
      : null;
    const selfFeelingResult = quizResponses.selfFeeling
      ? scoreSelfFeelingAccuracy(quizResponses.selfFeeling)
      : null;
    const lightImplResult = quizResponses.lightImpl
      ? scoreLightImplResponse(quizResponses.lightImpl)
      : null;
    const recoveryResult = quizResponses.recovery
      ? scoreRecoveryProfile(quizResponses.recovery)
      : null;

    // Compute recommended method
    const adaptationGroup = adaptationResult?.group ?? 2;
    const recoveryProfile = recoveryResult?.profile ?? "standard";
    const methodResult = computeRecommendedMethod(adaptationGroup, recoveryProfile);

    const today = new Date().toISOString().split("T")[0];

    const typing = await prisma.throwsTyping.upsert({
      where: { athleteId },
      create: {
        athleteId,
        quizAdaptationSpeed: quizResponses.adaptationSpeed ? JSON.stringify(quizResponses.adaptationSpeed) : null,
        quizTransferType: quizResponses.transferType ? JSON.stringify(quizResponses.transferType) : null,
        quizSelfFeeling: quizResponses.selfFeeling ? JSON.stringify(quizResponses.selfFeeling) : null,
        quizLightImpl: quizResponses.lightImpl ? JSON.stringify(quizResponses.lightImpl) : null,
        quizRecovery: quizResponses.recovery ? JSON.stringify(quizResponses.recovery) : null,
        adaptationGroup: adaptationResult?.group ?? null,
        transferType: transferResult?.type ?? null,
        selfFeelingAccuracy: selfFeelingResult?.accuracy ?? null,
        lightImplResponse: lightImplResult?.response ?? null,
        recoveryProfile: recoveryResult?.profile ?? null,
        recommendedMethod: methodResult.method,
        optimalComplexDuration: methodResult.complexDuration,
        estimatedSessionsToForm: methodResult.sessionsToForm,
        confidenceAdaptation: adaptationResult?.confidence ?? 0,
        confidenceTransfer: transferResult?.confidence ?? 0,
        confidenceSelfFeeling: selfFeelingResult?.confidence ?? 0,
        quizCompletedDate: today,
      },
      update: {
        quizAdaptationSpeed: quizResponses.adaptationSpeed ? JSON.stringify(quizResponses.adaptationSpeed) : undefined,
        quizTransferType: quizResponses.transferType ? JSON.stringify(quizResponses.transferType) : undefined,
        quizSelfFeeling: quizResponses.selfFeeling ? JSON.stringify(quizResponses.selfFeeling) : undefined,
        quizLightImpl: quizResponses.lightImpl ? JSON.stringify(quizResponses.lightImpl) : undefined,
        quizRecovery: quizResponses.recovery ? JSON.stringify(quizResponses.recovery) : undefined,
        adaptationGroup: adaptationResult?.group ?? undefined,
        transferType: transferResult?.type ?? undefined,
        selfFeelingAccuracy: selfFeelingResult?.accuracy ?? undefined,
        lightImplResponse: lightImplResult?.response ?? undefined,
        recoveryProfile: recoveryResult?.profile ?? undefined,
        recommendedMethod: methodResult.method,
        optimalComplexDuration: methodResult.complexDuration,
        estimatedSessionsToForm: methodResult.sessionsToForm,
        confidenceAdaptation: adaptationResult?.confidence ?? undefined,
        confidenceTransfer: transferResult?.confidence ?? undefined,
        confidenceSelfFeeling: selfFeelingResult?.confidence ?? undefined,
        quizCompletedDate: today,
      },
    });

    return NextResponse.json({ success: true, data: typing });
  } catch (error) {
    logger.error("Typing error", { context: "throws/typing", error: error });
    return NextResponse.json({ success: false, error: "Failed to save typing" }, { status: 500 });
  }
}

/** PATCH — coach manual override: set classification directly without the quiz */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, adaptationGroup, transferType, selfFeelingAccuracy, lightImplResponse, recoveryProfile } = body;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const adaptGroup = adaptationGroup ? parseInt(adaptationGroup) : undefined;
    const recovProf = recoveryProfile ?? "standard";
    const adaptGrp = adaptGroup ?? 2;
    const methodResult = computeRecommendedMethod(adaptGrp, recovProf);
    const today = new Date().toISOString().split("T")[0];

    const typing = await prisma.throwsTyping.upsert({
      where: { athleteId },
      create: {
        athleteId,
        adaptationGroup: adaptGroup ?? null,
        transferType: transferType ?? null,
        selfFeelingAccuracy: selfFeelingAccuracy ?? null,
        lightImplResponse: lightImplResponse ?? null,
        recoveryProfile: recoveryProfile ?? null,
        recommendedMethod: methodResult.method,
        optimalComplexDuration: methodResult.complexDuration,
        estimatedSessionsToForm: methodResult.sessionsToForm,
        typingSource: "COACH",
        quizCompletedDate: today,
      },
      update: {
        ...(adaptGroup !== undefined && { adaptationGroup: adaptGroup }),
        ...(transferType !== undefined && { transferType }),
        ...(selfFeelingAccuracy !== undefined && { selfFeelingAccuracy }),
        ...(lightImplResponse !== undefined && { lightImplResponse }),
        ...(recoveryProfile !== undefined && { recoveryProfile }),
        recommendedMethod: methodResult.method,
        optimalComplexDuration: methodResult.complexDuration,
        estimatedSessionsToForm: methodResult.sessionsToForm,
        typingSource: "COACH",
        quizCompletedDate: today,
      },
    });

    return NextResponse.json({ success: true, data: typing });
  } catch (error) {
    logger.error("Manual typing override error", { context: "throws/typing", error: error });
    return NextResponse.json({ success: false, error: "Failed to save typing override" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const typing = await prisma.throwsTyping.findUnique({ where: { athleteId } });
    return NextResponse.json({ success: true, data: typing });
  } catch (error) {
    logger.error("Get typing error", { context: "throws/typing", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch typing" }, { status: 500 });
  }
}
