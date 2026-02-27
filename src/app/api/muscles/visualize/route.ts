import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchMuscleVisualization, mapExerciseDBToVisualizerMuscles } from "@/lib/muscle-visualizer";
import { logger } from "@/lib/logger";

// Proxy endpoint for muscle visualization
// Returns an image highlighting the requested muscles
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const musclesParam = searchParams.get("muscles");
    const color = searchParams.get("color") || "#4F46E5";
    const bodyType = (searchParams.get("bodyType") || "male") as "male" | "female";
    const view = (searchParams.get("view") || "front") as "front" | "back";

    if (!musclesParam) {
      return NextResponse.json(
        { success: false, error: "muscles parameter is required" },
        { status: 400 }
      );
    }

    const muscles = musclesParam.split(",").map((m) => m.trim());
    const mappedMuscles = mapExerciseDBToVisualizerMuscles(muscles);

    const result = await fetchMuscleVisualization(mappedMuscles, {
      color,
      bodyType,
      view,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Muscle visualization not available. Set RAPIDAPI_KEY environment variable." },
        { status: 503 }
      );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    logger.error("Muscle visualization error", { context: "muscles/visualize", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to generate visualization" },
      { status: 500 }
    );
  }
}
