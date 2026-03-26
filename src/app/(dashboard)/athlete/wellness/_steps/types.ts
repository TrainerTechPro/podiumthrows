import type { SoreArea } from "@/components/ui/InteractiveBodyMap";

/* ─── Check-in Data ──────────────────────────────────────────────────────── */

export interface CheckinData {
  sleepQuality: number;
  sleepHours: number;
  soreness: number;
  sorenessArea: SoreArea[];
  stressLevel: number;
  energyMood: number;
  hydration: "POOR" | "ADEQUATE" | "GOOD";
  injuryStatus: "NONE" | "MONITORING" | "ACTIVE";
  injuryNotes: string;
  notes: string;
  ouraSleepScore: number | null;
}

/* ─── Wearable Snapshots ─────────────────────────────────────────────────── */

export interface WhoopSnapshot {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  strain: number | null;
}

export interface OuraSnapshot {
  readinessScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  sleepScore: number | null;
  sleepDurationSec: number | null;
  activityScore: number | null;
}

/* ─── Step Props ─────────────────────────────────────────────────────────── */

export interface StepProps {
  data: CheckinData;
  onChange: (updates: Partial<CheckinData>) => void;
  onNext: () => void;
  onBack: () => void;
  whoopData?: WhoopSnapshot | null;
  ouraData?: OuraSnapshot | null;
  isFirst?: boolean;
}
