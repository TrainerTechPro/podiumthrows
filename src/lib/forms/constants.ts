// ─── Form Constants ────────────────────────────────────────────────────────
// Implement weights, body regions, and other domain-specific constants

// ─── Implement Weights (kg) ────────────────────────────────────────────────
// Standard competition and training implements per event/gender

export type ImplementWeight = {
  label: string;
  weightKg: number;
  isCompetition: boolean;
};

export const IMPLEMENT_WEIGHTS: Record<
  string,
  Record<string, ImplementWeight[]>
> = {
  SHOT_PUT: {
    MALE: [
      { label: "9kg (Over)", weightKg: 9, isCompetition: false },
      { label: "8kg (Over)", weightKg: 8, isCompetition: false },
      { label: "7.26kg (Comp)", weightKg: 7.26, isCompetition: true },
      { label: "6kg (Under)", weightKg: 6, isCompetition: false },
      { label: "5kg (Under)", weightKg: 5, isCompetition: false },
      { label: "4kg (Youth)", weightKg: 4, isCompetition: false },
    ],
    FEMALE: [
      { label: "5kg (Over)", weightKg: 5, isCompetition: false },
      { label: "4kg (Comp)", weightKg: 4, isCompetition: true },
      { label: "3kg (Under)", weightKg: 3, isCompetition: false },
      { label: "2kg (Youth)", weightKg: 2, isCompetition: false },
    ],
  },
  DISCUS: {
    MALE: [
      { label: "2.5kg (Over)", weightKg: 2.5, isCompetition: false },
      { label: "2kg (Comp)", weightKg: 2, isCompetition: true },
      { label: "1.75kg (Under)", weightKg: 1.75, isCompetition: false },
      { label: "1.5kg (Youth)", weightKg: 1.5, isCompetition: false },
      { label: "1kg (Youth)", weightKg: 1, isCompetition: false },
    ],
    FEMALE: [
      { label: "1.5kg (Over)", weightKg: 1.5, isCompetition: false },
      { label: "1kg (Comp)", weightKg: 1, isCompetition: true },
      { label: "0.75kg (Youth)", weightKg: 0.75, isCompetition: false },
    ],
  },
  HAMMER: {
    MALE: [
      { label: "9.08kg (Over)", weightKg: 9.08, isCompetition: false },
      { label: "7.26kg (Comp)", weightKg: 7.26, isCompetition: true },
      { label: "6kg (Under)", weightKg: 6, isCompetition: false },
      { label: "5kg (Youth)", weightKg: 5, isCompetition: false },
      { label: "4kg (Youth)", weightKg: 4, isCompetition: false },
    ],
    FEMALE: [
      { label: "5kg (Over)", weightKg: 5, isCompetition: false },
      { label: "4kg (Comp)", weightKg: 4, isCompetition: true },
      { label: "3kg (Under)", weightKg: 3, isCompetition: false },
      { label: "2kg (Youth)", weightKg: 2, isCompetition: false },
    ],
  },
  JAVELIN: {
    MALE: [
      { label: "900g (Over)", weightKg: 0.9, isCompetition: false },
      { label: "800g (Comp)", weightKg: 0.8, isCompetition: true },
      { label: "700g (Under)", weightKg: 0.7, isCompetition: false },
      { label: "600g (Youth)", weightKg: 0.6, isCompetition: false },
    ],
    FEMALE: [
      { label: "700g (Over)", weightKg: 0.7, isCompetition: false },
      { label: "600g (Comp)", weightKg: 0.6, isCompetition: true },
      { label: "500g (Under)", weightKg: 0.5, isCompetition: false },
      { label: "400g (Youth)", weightKg: 0.4, isCompetition: false },
    ],
  },
};

// ─── Body Map Regions ──────────────────────────────────────────────────────
// SVG-friendly region IDs for body diagram tapping

export interface BodyRegion {
  id: string;
  label: string;
  group: "upper" | "core" | "lower";
}

export const BODY_REGIONS: BodyRegion[] = [
  // Upper body
  { id: "neck", label: "Neck", group: "upper" },
  { id: "left_shoulder", label: "Left Shoulder", group: "upper" },
  { id: "right_shoulder", label: "Right Shoulder", group: "upper" },
  { id: "left_elbow", label: "Left Elbow", group: "upper" },
  { id: "right_elbow", label: "Right Elbow", group: "upper" },
  { id: "left_wrist", label: "Left Wrist", group: "upper" },
  { id: "right_wrist", label: "Right Wrist", group: "upper" },
  { id: "left_hand", label: "Left Hand", group: "upper" },
  { id: "right_hand", label: "Right Hand", group: "upper" },
  { id: "upper_back", label: "Upper Back", group: "upper" },
  { id: "chest", label: "Chest", group: "upper" },
  // Core
  { id: "lower_back", label: "Lower Back", group: "core" },
  { id: "abdomen", label: "Abdomen", group: "core" },
  { id: "left_hip", label: "Left Hip", group: "core" },
  { id: "right_hip", label: "Right Hip", group: "core" },
  { id: "glutes", label: "Glutes", group: "core" },
  // Lower body
  { id: "left_quad", label: "Left Quad", group: "lower" },
  { id: "right_quad", label: "Right Quad", group: "lower" },
  { id: "left_hamstring", label: "Left Hamstring", group: "lower" },
  { id: "right_hamstring", label: "Right Hamstring", group: "lower" },
  { id: "left_knee", label: "Left Knee", group: "lower" },
  { id: "right_knee", label: "Right Knee", group: "lower" },
  { id: "left_shin", label: "Left Shin", group: "lower" },
  { id: "right_shin", label: "Right Shin", group: "lower" },
  { id: "left_calf", label: "Left Calf", group: "lower" },
  { id: "right_calf", label: "Right Calf", group: "lower" },
  { id: "left_ankle", label: "Left Ankle", group: "lower" },
  { id: "right_ankle", label: "Right Ankle", group: "lower" },
  { id: "left_foot", label: "Left Foot", group: "lower" },
  { id: "right_foot", label: "Right Foot", group: "lower" },
];

// ─── Likert Default Scales ─────────────────────────────────────────────────

export const LIKERT_SCALES = {
  agreement: [
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree",
  ],
  frequency: ["Never", "Rarely", "Sometimes", "Often", "Always"],
  quality: ["Very Poor", "Poor", "Fair", "Good", "Excellent"],
  confidence: [
    "Not at all confident",
    "Slightly confident",
    "Moderately confident",
    "Very confident",
    "Extremely confident",
  ],
  satisfaction: [
    "Very Dissatisfied",
    "Dissatisfied",
    "Neutral",
    "Satisfied",
    "Very Satisfied",
  ],
} as const;

// ─── RPE Descriptions ──────────────────────────────────────────────────────

export const RPE_LABELS: Record<number, string> = {
  1: "Very Light",
  2: "Light",
  3: "Moderate",
  4: "Somewhat Hard",
  5: "Hard",
  6: "Hard",
  7: "Very Hard",
  8: "Very Hard",
  9: "Extremely Hard",
  10: "Maximum Effort",
};

// ─── Days of Week ──────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sun", fullLabel: "Sunday" },
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
] as const;

// ─── Severity Labels (for body map) ────────────────────────────────────────

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Minimal",
  2: "Mild",
  3: "Moderate",
  4: "Severe",
  5: "Extreme",
};
