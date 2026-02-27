const MUSCLE_VIZ_BASE_URL = "https://muscle-visualizer-api.p.rapidapi.com";

/**
 * Get muscle visualization URL for given muscles.
 * Returns an image URL that highlights the specified muscles on an anatomical diagram.
 * Requires RAPIDAPI_KEY env variable.
 */
export function getMuscleVisualizationUrl(
  muscles: string[],
  options?: {
    color?: string;
    bodyType?: "male" | "female";
    view?: "front" | "back";
  }
): string | null {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    muscles: muscles.join(","),
    color: options?.color || "#4F46E5",
    body_type: options?.bodyType || "male",
    view: options?.view || "front",
  });

  return `${MUSCLE_VIZ_BASE_URL}/v1/visualize/muscles?${params.toString()}`;
}

/**
 * Fetch muscle visualization image as a buffer.
 * Returns null if RAPIDAPI_KEY is not set.
 */
export async function fetchMuscleVisualization(
  muscles: string[],
  options?: {
    color?: string;
    bodyType?: "male" | "female";
    view?: "front" | "back";
  }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      muscles: muscles.join(","),
      color: options?.color || "#4F46E5",
      body_type: options?.bodyType || "male",
      view: options?.view || "front",
    });

    const res = await fetch(`${MUSCLE_VIZ_BASE_URL}/v1/visualize/muscles?${params.toString()}`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "muscle-visualizer-api.p.rapidapi.com",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";

    return { buffer, contentType };
  } catch {
    return null;
  }
}

/**
 * Fetch workout muscle activation visualization (primary + secondary colors).
 */
export async function fetchWorkoutVisualization(
  muscles: string[],
  options?: {
    bodyType?: "male" | "female";
    view?: "front" | "back";
  }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      muscles: muscles.join(","),
      body_type: options?.bodyType || "male",
      view: options?.view || "front",
    });

    const res = await fetch(`${MUSCLE_VIZ_BASE_URL}/v1/visualize/workout?${params.toString()}`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "muscle-visualizer-api.p.rapidapi.com",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";

    return { buffer, contentType };
  } catch {
    return null;
  }
}

/**
 * Get available muscle groups from the API.
 * Returns a fallback list if API is not available.
 */
export async function getAvailableMuscles(): Promise<string[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return FALLBACK_MUSCLES;

  try {
    const res = await fetch(`${MUSCLE_VIZ_BASE_URL}/v1/muscles`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "muscle-visualizer-api.p.rapidapi.com",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) return FALLBACK_MUSCLES;

    const data = await res.json();
    return data.muscles || FALLBACK_MUSCLES;
  } catch {
    return FALLBACK_MUSCLES;
  }
}

const FALLBACK_MUSCLES = [
  "biceps", "triceps", "forearms",
  "deltoids", "trapezius", "rotator cuff",
  "pectorals", "serratus anterior",
  "lats", "rhomboids", "erector spinae",
  "rectus abdominis", "obliques", "transverse abdominis",
  "quadriceps", "hamstrings", "glutes",
  "calves", "hip flexors", "adductors", "abductors",
];

/**
 * Map muscle names from ExerciseDB to Muscle Visualizer format.
 * ExerciseDB uses specific names, Muscle Visualizer may expect different names.
 */
export function mapExerciseDBToVisualizerMuscles(muscles: string[]): string[] {
  const mapping: Record<string, string> = {
    "biceps": "biceps",
    "triceps": "triceps",
    "forearms": "forearms",
    "delts": "deltoids",
    "traps": "trapezius",
    "pectorals": "pectorals",
    "lats": "lats",
    "upper back": "rhomboids",
    "spine": "erector spinae",
    "abs": "rectus abdominis",
    "quads": "quadriceps",
    "hamstrings": "hamstrings",
    "glutes": "glutes",
    "calves": "calves",
    "adductors": "adductors",
    "abductors": "abductors",
    "serratus anterior": "serratus anterior",
    "levator scapulae": "trapezius",
    "cardiovascular system": "pectorals",
  };

  return muscles.map((m) => mapping[m.toLowerCase()] || m.toLowerCase());
}
