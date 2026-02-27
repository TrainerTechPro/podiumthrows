// ThrowFlow - AI Biomechanical Analysis Types

export type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

export type DrillType =
  | "FULL_THROW"
  | "STANDING"
  | "POWER_POSITION"
  | "HALF_TURN"
  | "GLIDE"
  | "SPIN"
  | "SOUTH_AFRICAN";

export type CameraAngle = "SIDE" | "BEHIND" | "FRONT" | "DIAGONAL";

export type AnalysisStatus = "PENDING" | "ANALYZING" | "COMPLETED" | "FAILED";

export interface CalibrationInput {
  event: ThrowEvent;
  drillType: DrillType;
  cameraAngle: CameraAngle;
  athleteHeight?: number; // cm
  implementWeight?: number; // kg
  knownDistance?: number; // meters
}

export interface PhaseScore {
  name: string;
  score: number; // 0-10
  notes: string;
}

export interface EnergyLeak {
  description: string;
  percentImpact: number;
  frameIndex: number;
}

export interface ReleaseMetrics {
  angle: number | null; // degrees
  velocityRating: string; // "Low" | "Moderate" | "High" | "Elite"
  height: string; // "Below optimal" | "Optimal" | "Above optimal"
  theoreticalDistance: number | null; // meters
}

export interface IssueCard {
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  frameIndex: number;
  drill: string;
}

export interface DrillRecommendation {
  name: string;
  description: string;
  targetIssue: string;
}

export interface AnalysisResult {
  phaseScores: PhaseScore[];
  energyLeaks: EnergyLeak[];
  releaseMetrics: ReleaseMetrics;
  overallScore: number;
  issueCards: IssueCard[];
  drillRecs: DrillRecommendation[];
  rawAnalysis: string;
  drillType: DrillType;
}

export interface ThrowAnalysisData {
  id: string;
  coachId?: string;
  athleteId?: string;
  event: ThrowEvent;
  drillType: DrillType;
  cameraAngle: CameraAngle;
  athleteHeight?: number;
  implementWeight?: number;
  knownDistance?: number;
  phaseScores: PhaseScore[];
  energyLeaks: EnergyLeak[];
  releaseMetrics: ReleaseMetrics | null;
  overallScore: number | null;
  issueCards: IssueCard[];
  drillRecs: DrillRecommendation[];
  rawAnalysis?: string;
  frameCount: number;
  videoDuration?: number;
  status: AnalysisStatus;
  errorMessage?: string;
  createdAt: string;
  athleteName?: string;
}

// Event-specific phase definitions
export const EVENT_PHASES: Record<ThrowEvent, string[]> = {
  SHOT_PUT: ["Setup/Stance", "Wind-up/Glide", "Power Position", "Delivery/Release", "Recovery/Reverse"],
  DISCUS: ["Entry/Wind-up", "Back Swing", "Rotation/Turn", "Power Position", "Delivery/Release", "Recovery"],
  HAMMER: ["Entry/Winds", "Turns (1st)", "Turns (2nd)", "Turns (3rd/4th)", "Delivery/Release", "Recovery"],
  JAVELIN: ["Approach Run", "Cross-over Steps", "Block/Plant", "Delivery/Release", "Recovery"],
};

// Event-specific drill types
export const EVENT_DRILLS: Record<ThrowEvent, DrillType[]> = {
  SHOT_PUT: ["FULL_THROW", "STANDING", "POWER_POSITION", "GLIDE", "SPIN", "SOUTH_AFRICAN"],
  DISCUS: ["FULL_THROW", "STANDING", "POWER_POSITION", "HALF_TURN", "SOUTH_AFRICAN"],
  HAMMER: ["FULL_THROW", "STANDING", "POWER_POSITION"],
  JAVELIN: ["FULL_THROW", "STANDING", "POWER_POSITION", "HALF_TURN"],
};

export const DRILL_LABELS: Record<DrillType, string> = {
  FULL_THROW: "Full Throw",
  STANDING: "Stand Throw",
  POWER_POSITION: "Power Position",
  HALF_TURN: "Half Turn",
  GLIDE: "Glide",
  SPIN: "Spin",
  SOUTH_AFRICAN: "South African Drill",
};

export const CAMERA_LABELS: Record<CameraAngle, string> = {
  SIDE: "Side View",
  BEHIND: "Behind View",
  FRONT: "Front View",
  DIAGONAL: "Diagonal View",
};

export const EVENT_LABELS: Record<ThrowEvent, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};
