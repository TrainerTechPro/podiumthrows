import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throwflow — list analyses for current coach
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const analyses = await prisma.throwAnalysis.findMany({
      where: { coachId: coach.id },
      include: {
        athlete: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = analyses.map((a) => ({
      id: a.id,
      event: a.event,
      drillType: a.drillType,
      cameraAngle: a.cameraAngle,
      overallScore: a.overallScore,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      athleteName: a.athlete
        ? a.athlete.user.email
        : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("GET /api/throwflow error", { context: "throwflow", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throwflow — create a new analysis record and run AI analysis
export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      event,
      drillType,
      cameraAngle,
      athleteId,
      athleteHeight,
      implementWeight,
      knownDistance,
      frames: _frames,
      keyFrames,
      keyFrameIndices,
      totalFrames,
      videoDuration,
    } = body;

    if (!event || !drillType || !cameraAngle) {
      return NextResponse.json(
        { success: false, error: "Event, drill type, and camera angle are required" },
        { status: 400 }
      );
    }

    if (!keyFrames || keyFrames.length === 0) {
      return NextResponse.json(
        { success: false, error: "Video frames are required for analysis" },
        { status: 400 }
      );
    }

    // Create the analysis record as ANALYZING
    const analysis = await prisma.throwAnalysis.create({
      data: {
        coachId: coach.id,
        athleteId: athleteId || null,
        event,
        drillType,
        cameraAngle,
        athleteHeight: athleteHeight || null,
        implementWeight: implementWeight || null,
        knownDistance: knownDistance || null,
        frameCount: totalFrames || keyFrames.length,
        videoDuration: videoDuration || null,
        status: "ANALYZING",
      },
    });

    // Run AI analysis (non-blocking approach: update record when done)
    void runAnalysis(analysis.id, {
      event,
      drillType,
      cameraAngle,
      athleteHeight,
      implementWeight,
      knownDistance,
      keyFrames,
      keyFrameIndices,
      totalFrames,
    }).catch((err) => {
      logger.error("ThrowFlow analysis failed", { context: "throwflow", error: err });
    });

    return NextResponse.json({ success: true, data: { id: analysis.id, status: "ANALYZING" } });
  } catch (error) {
    logger.error("POST /api/throwflow error", { context: "throwflow", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// Run the AI analysis and update the database record
async function runAnalysis(
  analysisId: string,
  params: {
    event: string;
    drillType: string;
    cameraAngle: string;
    athleteHeight?: number;
    implementWeight?: number;
    knownDistance?: number;
    keyFrames: string[];
    keyFrameIndices: number[];
    totalFrames: number;
  }
) {
  const { buildSystemPrompt, buildAnalysisPrompt, buildFrameContent } = await import(
    "@/lib/throwflow/prompt-builder"
  );
  try {
    const calibration = {
      event: params.event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN",
      drillType: params.drillType as "FULL_THROW" | "STANDING" | "POWER_POSITION" | "HALF_TURN" | "GLIDE" | "SPIN" | "SOUTH_AFRICAN",
      cameraAngle: params.cameraAngle as "SIDE" | "BEHIND" | "FRONT" | "DIAGONAL",
      athleteHeight: params.athleteHeight,
      implementWeight: params.implementWeight,
      knownDistance: params.knownDistance,
    };

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildAnalysisPrompt(calibration);
    const frameContent = buildFrameContent(
      params.keyFrames,
      params.keyFrameIndices,
      params.totalFrames
    );

    // Build multimodal message for OpenAI-compatible API
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }, ...frameContent],
      },
    ];

    // Call AI API (OpenAI-compatible endpoint)
    const apiKey = process.env.OPENAI_API_KEY;
    const apiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    const model = process.env.THROWFLOW_MODEL || "gpt-4o";

    if (!apiKey) {
      await prisma.throwAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          errorMessage: "AI API key not configured. Set OPENAI_API_KEY in environment variables.",
        },
      });
      return;
    }

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const rawText = result.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // If parsing fails, save the raw text and mark as completed with partial data
      await prisma.throwAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "COMPLETED",
          rawAnalysis: rawText,
          errorMessage: "AI response could not be parsed as structured data. Raw analysis saved.",
        },
      });
      return;
    }

    // Update the analysis record with parsed results
    await prisma.throwAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        phaseScores: JSON.stringify({ phases: parsed.phaseScores || [] }),
        energyLeaks: JSON.stringify(parsed.energyLeaks || []),
        releaseMetrics: JSON.stringify(parsed.releaseMetrics || {}),
        overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : null,
        issueCards: JSON.stringify(parsed.issueCards || []),
        drillRecs: JSON.stringify(parsed.drillRecs || []),
        rawAnalysis: rawText,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    logger.error("ThrowFlow analysis error", { context: "throwflow", error: message });
    await prisma.throwAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
  }
}
