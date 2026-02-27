// ThrowFlow - AI Biomechanical Analysis Prompt Builder
// Builds structured prompts for video frame analysis

import { CalibrationInput, ThrowEvent, DrillType } from "./types";
import { EVENT_PHASES, DRILL_LABELS, EVENT_LABELS, CAMERA_LABELS } from "./types";
import { OPTIMAL_RELEASE_ANGLES, CORRECTIVE_DRILLS } from "./reference-data";

/**
 * Build the system prompt for biomechanical throw analysis.
 * This gives the AI model context about what it's analyzing and what format to respond in.
 */
export function buildSystemPrompt(): string {
  return `You are an expert biomechanics analyst specializing in track & field throwing events (Shot Put, Discus, Hammer, Javelin). You have deep knowledge of:
- Bondarchuk periodization and coaching methodology
- Phase-by-phase technical models for all four throwing events
- Common technical faults and corrective drills
- Release mechanics (angle, velocity, height relationships)
- Energy transfer chains and common "leak" points

You will analyze video frames of a throwing athlete and provide a structured technical assessment. Be specific, actionable, and reference exact frame positions when identifying issues. Use coaching-friendly language.

IMPORTANT: You must respond ONLY with valid JSON matching the schema provided. No markdown, no extra text.`;
}

/**
 * Build the user prompt with calibration data and analysis instructions.
 */
export function buildAnalysisPrompt(calibration: CalibrationInput): string {
  const eventLabel = EVENT_LABELS[calibration.event];
  const drillLabel = DRILL_LABELS[calibration.drillType];
  const cameraLabel = CAMERA_LABELS[calibration.cameraAngle];
  const phases = EVENT_PHASES[calibration.event];
  const optimalAngles = OPTIMAL_RELEASE_ANGLES[calibration.event];
  const drills = CORRECTIVE_DRILLS[calibration.event];

  const calibrationDetails = [
    `Event: ${eventLabel}`,
    `Drill/Technique: ${drillLabel}`,
    `Camera Angle: ${cameraLabel}`,
    calibration.athleteHeight ? `Athlete Height: ${calibration.athleteHeight}cm` : null,
    calibration.implementWeight ? `Implement Weight: ${calibration.implementWeight}kg` : null,
    calibration.knownDistance ? `Known Distance: ${calibration.knownDistance}m (use for efficiency analysis)` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const phaseList = phases.map((p, i) => `  ${i + 1}. ${p}`).join("\n");

  const drillList = drills
    .map((d) => `  - ${d.name}: targets ${d.targetIssues.join(", ")}`)
    .join("\n");

  return `Analyze the following ${eventLabel} ${drillLabel} video frames.

CALIBRATION DATA:
${calibrationDetails}

PHASES TO SCORE (rate each 0-10):
${phaseList}

OPTIMAL RELEASE ANGLES for ${eventLabel}: ${optimalAngles.min}°-${optimalAngles.max}° (ideal: ${optimalAngles.ideal}°)

AVAILABLE CORRECTIVE DRILLS:
${drillList}

${getDrillSpecificInstructions(calibration.event, calibration.drillType)}

Respond with this exact JSON structure:
{
  "phaseScores": [
    { "name": "<phase name>", "score": <0-10>, "notes": "<specific observation>" }
  ],
  "energyLeaks": [
    { "description": "<what energy is lost>", "percentImpact": <estimated % power lost>, "frameIndex": <frame number> }
  ],
  "releaseMetrics": {
    "angle": <estimated degrees or null if not visible>,
    "velocityRating": "<Low|Moderate|High|Elite>",
    "height": "<Below optimal|Optimal|Above optimal>",
    "theoreticalDistance": <estimated meters or null>
  },
  "overallScore": <0-100 composite>,
  "issueCards": [
    { "title": "<short issue name>", "description": "<detailed explanation>", "severity": "<HIGH|MEDIUM|LOW>", "frameIndex": <frame number>, "drill": "<recommended drill name>" }
  ],
  "drillRecs": [
    { "name": "<drill name>", "description": "<how to perform it>", "targetIssue": "<which issue it addresses>" }
  ]
}

Analyze ALL visible frames. Focus on:
1. Technical execution quality for each phase
2. Energy leaks (wasted motion, poor sequencing, balance issues)
3. Release mechanics (angle, height, velocity indicators)
4. Top 3-5 issues ranked by severity
5. Specific drill recommendations to address each issue`;
}

/**
 * Get drill-type-specific analysis instructions
 */
function getDrillSpecificInstructions(event: ThrowEvent, drillType: DrillType): string {
  const instructions: Record<string, string> = {
    STANDING: `DRILL FOCUS: This is a standing throw. Analyze:
- Setup position quality (feet placement, weight distribution)
- Upper-lower body sequencing from static position
- Release mechanics from power position
- DO NOT score approach/movement phases - focus on delivery.`,

    POWER_POSITION: `DRILL FOCUS: This is from power position. Analyze:
- Quality of power position setup (torque, base width)
- Unwinding sequence (legs → hips → trunk → arm)
- Release mechanics
- Weight transfer efficiency`,

    GLIDE: `DRILL FOCUS: This is a glide technique. Analyze:
- Starting stance and A-position quality
- Glide acceleration and leg drive
- Power position arrival and timing
- Transition smoothness from glide to delivery`,

    SPIN: `DRILL FOCUS: This is a rotational/spin technique. Analyze:
- Entry and initial drive
- Rotational velocity and axis stability
- Transition from rotation to power position
- Release timing relative to rotation`,

    HALF_TURN: `DRILL FOCUS: This is a half-turn drill. Analyze:
- Starting position and wind-up
- Rotation quality through 180°
- Arrival at power position
- Delivery mechanics`,

    SOUTH_AFRICAN: `DRILL FOCUS: This is a South African drill. Analyze:
- Hip engagement and timing
- Power position entry from the drill
- Emphasis on lower body contribution
- Upper body delay (hip lead)`,

    FULL_THROW: `FULL THROW ANALYSIS: Score all phases completely.`,
  };

  return instructions[drillType] || instructions.FULL_THROW;
}

/**
 * Build the content array for a multimodal AI request.
 * Interleaves frame images with positional context.
 */
export function buildFrameContent(
  frames: string[],
  frameIndices: number[],
  totalFrames: number
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];

  content.push({
    type: "text",
    text: `The following ${frames.length} key frames are selected from ${totalFrames} total frames. Frame indices shown for temporal reference.`,
  });

  for (let i = 0; i < frames.length; i++) {
    content.push({
      type: "text",
      text: `Frame ${frameIndices[i] + 1}/${totalFrames}:`,
    });
    content.push({
      type: "image_url",
      image_url: { url: frames[i] },
    });
  }

  return content;
}
