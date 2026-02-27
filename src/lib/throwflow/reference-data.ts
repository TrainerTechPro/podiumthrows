// ThrowFlow - Benchmark & Reference Data
// Elite-level performance baselines for radar chart comparisons

import { ThrowEvent, PhaseScore } from "./types";

// "Perfect 10" elite profile per event - used for radar chart overlay
export const ELITE_PROFILES: Record<ThrowEvent, PhaseScore[]> = {
  SHOT_PUT: [
    { name: "Setup/Stance", score: 10, notes: "Balanced, weight centered over support leg" },
    { name: "Wind-up/Glide", score: 10, notes: "Efficient acceleration across the ring" },
    { name: "Power Position", score: 10, notes: "Full torque separation, blocked left side" },
    { name: "Delivery/Release", score: 10, notes: "Optimal 38-42° release angle, max velocity" },
    { name: "Recovery/Reverse", score: 10, notes: "Controlled reverse, stays in ring" },
  ],
  DISCUS: [
    { name: "Entry/Wind-up", score: 10, notes: "Smooth entry with long discus arm" },
    { name: "Back Swing", score: 10, notes: "Full shoulder-hip separation" },
    { name: "Rotation/Turn", score: 10, notes: "Fast feet, low center of gravity" },
    { name: "Power Position", score: 10, notes: "Wrapped position, wide base" },
    { name: "Delivery/Release", score: 10, notes: "Long pull, clockwise spin, 35-37° angle" },
    { name: "Recovery", score: 10, notes: "Controlled reverse within the ring" },
  ],
  HAMMER: [
    { name: "Entry/Winds", score: 10, notes: "3-4 smooth winds, increasing orbit radius" },
    { name: "Turns (1st)", score: 10, notes: "Heel-ball transition, accelerating orbit" },
    { name: "Turns (2nd)", score: 10, notes: "Increasing velocity, stable axis" },
    { name: "Turns (3rd/4th)", score: 10, notes: "Peak velocity, low point at 0°" },
    { name: "Delivery/Release", score: 10, notes: "44° release angle, max angular velocity" },
    { name: "Recovery", score: 10, notes: "Controlled follow-through" },
  ],
  JAVELIN: [
    { name: "Approach Run", score: 10, notes: "Progressive acceleration, 10-12 stride approach" },
    { name: "Cross-over Steps", score: 10, notes: "Smooth transition, withdrawal of javelin" },
    { name: "Block/Plant", score: 10, notes: "Strong brace, hip leads shoulder" },
    { name: "Delivery/Release", score: 10, notes: "Over-the-top pull, 34-36° angle" },
    { name: "Recovery", score: 10, notes: "Safe deceleration behind the foul line" },
  ],
};

// Implement weight standards (for reference/validation)
export const IMPLEMENT_WEIGHTS: Record<ThrowEvent, { male: number; female: number; unit: string }> = {
  SHOT_PUT: { male: 7.26, female: 4.0, unit: "kg" },
  DISCUS: { male: 2.0, female: 1.0, unit: "kg" },
  HAMMER: { male: 7.26, female: 4.0, unit: "kg" },
  JAVELIN: { male: 0.8, female: 0.6, unit: "kg" },
};

// Optimal release angles by event
export const OPTIMAL_RELEASE_ANGLES: Record<ThrowEvent, { min: number; max: number; ideal: number }> = {
  SHOT_PUT: { min: 35, max: 42, ideal: 38 },
  DISCUS: { min: 33, max: 38, ideal: 35 },
  HAMMER: { min: 42, max: 46, ideal: 44 },
  JAVELIN: { min: 32, max: 38, ideal: 34 },
};

// Common corrective drills by event
export const CORRECTIVE_DRILLS: Record<ThrowEvent, Array<{ name: string; targetIssues: string[]; description: string }>> = {
  SHOT_PUT: [
    { name: "Wall Drill", targetIssues: ["Low release", "Arm push"], description: "Stand facing wall, practice punch-release motion to train proper release trajectory." },
    { name: "Stand-Power Punch", targetIssues: ["Weak finish", "Short put"], description: "From power position, focus on hip turn and explosive extension." },
    { name: "Glide Rhythm Drill", targetIssues: ["Slow glide", "Balance loss"], description: "Practice glide without implement focusing on A-B foot timing." },
    { name: "Reverse Stand Throw", targetIssues: ["No reverse", "Falling forward"], description: "Exaggerate reverse after release to train follow-through pattern." },
    { name: "Mirror Drill", targetIssues: ["Early arm strike", "Sequencing"], description: "In front of mirror, rehearse strike sequence: legs → hips → trunk → arm." },
    { name: "South African Drill", targetIssues: ["Hip timing", "Power position entry"], description: "Modified glide focusing on hip engagement at power position." },
  ],
  DISCUS: [
    { name: "Bowling Drill", targetIssues: ["Short arm", "Early release"], description: "Low release sweeping motion to feel long pull path." },
    { name: "Pivot Drill", targetIssues: ["Slow feet", "Balance"], description: "Half turn focusing on fast heel-to-toe transition at center of ring." },
    { name: "Standing Power Throw", targetIssues: ["Weak block", "No hip lead"], description: "From power position, turn hips before arm follows." },
    { name: "Full Turn with Hold", targetIssues: ["Spin control", "Drifting"], description: "Complete rotation and hold finish in balanced position." },
    { name: "Wheel Drill", targetIssues: ["Rotation speed", "Timing"], description: "Continuous pivoting without release to build rotational speed." },
  ],
  HAMMER: [
    { name: "Wind Drill", targetIssues: ["Inconsistent winds", "Orbit control"], description: "Practice 5+ winds focusing on consistent orbit radius and plane." },
    { name: "Single Turn Drill", targetIssues: ["First turn", "Acceleration"], description: "One turn and release, focus on heel-ball and hammer acceleration." },
    { name: "Two-Turn Release", targetIssues: ["Turn consistency", "Balance"], description: "Two turns and release, building speed progressively." },
    { name: "Low Point Drill", targetIssues: ["High low point", "Late pull"], description: "Focus on pulling the low point to 0° (front of circle)." },
    { name: "Entry Tempo Drill", targetIssues: ["Rush entry", "Setup"], description: "Slow, controlled winds into first turn to establish rhythm." },
  ],
  JAVELIN: [
    { name: "3-Step Throw", targetIssues: ["Approach timing", "Withdrawal"], description: "Short approach focusing on javelin withdrawal and block step." },
    { name: "Standing Block Drill", targetIssues: ["Soft block", "Hip leak"], description: "From plant, practice strong bracing leg block." },
    { name: "Cross-Step Drill", targetIssues: ["Cross-step timing", "Balance"], description: "Isolated cross-over steps to improve transition rhythm." },
    { name: "Pull-Through Drill", targetIssues: ["Low elbow", "Arm path"], description: "Stationary drill focusing on high elbow over-the-top release." },
    { name: "Run-Through Drill", targetIssues: ["Deceleration", "Approach speed"], description: "Full approach without release to train speed maintenance." },
  ],
};

// Severity color mapping
export const SEVERITY_COLORS = {
  HIGH: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200" },
  MEDIUM: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200" },
  LOW: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200" },
};
