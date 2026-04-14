"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { csrfHeaders } from "@/lib/csrf-client";
import { serializeSorenessArea } from "@/lib/readiness/parse-soreness";
import type { CheckinData, WhoopSnapshot, OuraSnapshot, StepProps } from "./_steps/types";
import { SleepStep } from "./_steps/sleep-step";
import { SorenessStep } from "./_steps/soreness-step";
import { StressEnergyStep } from "./_steps/stress-energy-step";
import { QuickChecksStep } from "./_steps/quick-checks-step";
import { NotesStep } from "./_steps/notes-step";
import { SummaryStep } from "./_steps/summary-step";

/* ─── Phase Types ────────────────────────────────────────────────────────── */

type Phase =
  | "sleep"
  | "soreness"
  | "stress"
  | "checks"
  | "notes"
  | "submitting"
  | "error"
  | "summary";

const STEP_ORDER: Phase[] = ["sleep", "soreness", "stress", "checks", "notes"];

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface CheckinFlowProps {
  whoopData?: WhoopSnapshot | null;
  ouraData?: OuraSnapshot | null;
  previousScore?: number | null;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function CheckinFlow({ whoopData, ouraData, previousScore }: CheckinFlowProps) {
  const router = useRouter();

  /* ── Pre-fill from wearable data (WHOOP preferred) ──────────────────── */
  const prefillSleepQuality =
    whoopData?.sleepPerformance != null
      ? Math.max(1, Math.min(10, Math.round(whoopData.sleepPerformance / 10)))
      : ouraData?.sleepScore != null
        ? Math.max(1, Math.min(10, Math.round(ouraData.sleepScore / 10)))
        : null;

  const prefillSleepHours =
    whoopData?.sleepDurationMs != null
      ? Math.round((whoopData.sleepDurationMs / 3_600_000) * 2) / 2
      : ouraData?.sleepDurationSec != null
        ? Math.round((ouraData.sleepDurationSec / 3600) * 2) / 2
        : null;

  /* ── Form state ─────────────────────────────────────────────────────── */
  const [data, setData] = useState<CheckinData>({
    sleepQuality: prefillSleepQuality ?? 7,
    sleepHours: prefillSleepHours ?? 8,
    soreness: 7,
    sorenessArea: [],
    stressLevel: 5,
    energyMood: 7,
    hydration: "ADEQUATE",
    injuryStatus: "NONE",
    injuryNotes: "",
    notes: "",
    ouraSleepScore: ouraData?.sleepScore ?? null,
  });

  /* ── Phase & direction ──────────────────────────────────────────────── */
  const [phase, setPhase] = useState<Phase>("sleep");
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  /* ── Summary state ──────────────────────────────────────────────────── */
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  /* ── Navigation helpers ─────────────────────────────────────────────── */
  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(phase as Phase);
    if (idx < STEP_ORDER.length - 1) {
      setDirection("forward");
      setPhase(STEP_ORDER[idx + 1]);
    }
  }, [phase]);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(phase as Phase);
    if (idx > 0) {
      setDirection("back");
      setPhase(STEP_ORDER[idx - 1]);
    }
  }, [phase]);

  /* ── Submit handler ─────────────────────────────────────────────────── */
  // Synchronous in-flight flag prevents rapid Retry taps from firing
  // concurrent POSTs before the `phase` state re-render hides the button.
  const inFlightRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase("submitting");
    try {
      const res = await fetch("/api/athlete/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          sleepQuality: data.sleepQuality,
          sleepHours: data.sleepHours,
          soreness: data.soreness,
          sorenessArea: serializeSorenessArea(data.sorenessArea),
          stressLevel: data.stressLevel,
          energyMood: data.energyMood,
          hydration: data.hydration,
          injuryStatus: data.injuryStatus,
          injuryNotes: data.injuryNotes?.trim() || null,
          notes: data.notes?.trim() || null,
          ouraSleepScore: data.ouraSleepScore ?? undefined,
          // Wearable biometric fields
          hrvMs: whoopData?.hrvMs ?? ouraData?.hrvMs ?? undefined,
          restingHR: whoopData?.restingHR ?? ouraData?.restingHR ?? undefined,
          spo2: whoopData?.spo2 ?? ouraData?.spo2 ?? undefined,
          whoopStrain: whoopData?.strain ?? undefined,
          ouraReadiness: ouraData?.readinessScore ?? undefined,
          ouraActivityScore: ouraData?.activityScore ?? undefined,
          source: whoopData ? "WHOOP_ASSISTED" : ouraData ? "OURA_ASSISTED" : "MANUAL",
        }),
      });

      if (res.status === 409) {
        setErrorMsg("You already checked in today!");
        setPhase("error");
        return;
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Check-in failed (${res.status})`);
      }

      setScore(payload.data.overallScore);
      setStreak(payload.data.streak ?? 0);
      setPhase("summary");
    } catch (err) {
      console.error("wellness check-in submit failed", err);
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : "Your check-in didn't save. Tap retry to try again."
      );
      setPhase("error");
    } finally {
      inFlightRef.current = false;
    }
  }, [data, whoopData, ouraData]);

  /* ── Handle notes "Submit" (last step triggers submit) ──────────────── */
  const handleNotesNext = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  /* ── StepProps builder ──────────────────────────────────────────────── */
  const stepProps: StepProps = {
    data,
    onChange: (updates) => setData((prev) => ({ ...prev, ...updates })),
    onNext: goNext,
    onBack: goBack,
    whoopData,
    ouraData,
    isFirst: phase === "sleep",
  };

  /* ── Render active step ─────────────────────────────────────────────── */

  // Submitting state
  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-sm text-muted">Submitting your check-in...</p>
      </div>
    );
  }

  // Error state
  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle size={28} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">
            Check-in Failed
          </h3>
          <p className="text-sm text-muted max-w-xs">{errorMsg}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            className="rounded-xl min-h-[48px] text-sm font-bold text-black"
            onClick={handleSubmit}
            leftIcon={<RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Retry
          </Button>
          <Link
            href="/athlete/wellness"
            className="text-sm font-medium text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Back to Wellness
          </Link>
        </div>
      </div>
    );
  }

  // Summary state
  if (phase === "summary") {
    return (
      <SummaryStep
        score={score}
        streak={streak}
        data={data}
        ouraData={ouraData}
        onDone={() => router.refresh()}
      />
    );
  }

  // Step rendering with transition animation
  const animationClass =
    direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left";

  let activeStep: React.ReactNode;
  switch (phase) {
    case "sleep":
      activeStep = <SleepStep {...stepProps} />;
      break;
    case "soreness":
      activeStep = <SorenessStep {...stepProps} />;
      break;
    case "stress":
      activeStep = <StressEnergyStep {...stepProps} previousScore={previousScore ?? undefined} />;
      break;
    case "checks":
      activeStep = <QuickChecksStep {...stepProps} />;
      break;
    case "notes":
      activeStep = <NotesStep {...stepProps} onNext={handleNotesNext} />;
      break;
  }

  return (
    <div className="relative overflow-hidden">
      <div key={phase} className={animationClass}>
        {activeStep}
      </div>
    </div>
  );
}
