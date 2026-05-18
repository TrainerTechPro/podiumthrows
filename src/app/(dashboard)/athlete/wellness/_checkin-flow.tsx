"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { csrfHeaders } from "@/lib/csrf-client";
import { serializeSorenessArea } from "@/lib/readiness/parse-soreness";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { SaveStatusChip } from "@/components/ui/SaveStatusChip";
import { useToast } from "@/components/ui/Toast";
import { enqueueMutation, useOutboxStatus } from "@/lib/outbox";
import type { CheckinData, WhoopSnapshot, OuraSnapshot, StepProps } from "./_steps/types";
import { SleepStep } from "./_steps/sleep-step";
import { SorenessStep } from "./_steps/soreness-step";
import { StressEnergyStep } from "./_steps/stress-energy-step";
import { QuickChecksStep } from "./_steps/quick-checks-step";
import { NotesStep } from "./_steps/notes-step";
import { SummaryStep } from "./_steps/summary-step";

import { logger } from "@/lib/logger";
/* ─── Phase Types ────────────────────────────────────────────────────────── */

type Phase =
  | "sleep"
  | "soreness"
  | "stress"
  | "checks"
  | "notes"
  | "submitting"
  | "error"
  | "queued"
  | "summary";

const STEP_ORDER: Phase[] = ["sleep", "soreness", "stress", "checks", "notes"];

/** Phases worth persisting to IDB for resume. Excludes transient/UI states. */
const PERSISTED_PHASES = new Set<Phase>(STEP_ORDER);

/** Persisted shape: form data + which step the athlete was on. */
interface PersistedCheckin {
  data: CheckinData;
  phase: Phase;
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface CheckinFlowProps {
  /** From the server session — scopes the IDB draft cache. */
  userId: string;
  whoopData?: WhoopSnapshot | null;
  ouraData?: OuraSnapshot | null;
  previousScore?: number | null;
  /**
   * Master Profile lifestyle baselines. Used as a second-tier prefill —
   * wearable data wins when present, then these baselines, then hardcoded
   * defaults. Null when the athlete hasn't filled in lifestyle yet.
   */
  baselineSleepHours?: number | null;
  baselineStress?: number | null;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function CheckinFlow({
  userId,
  whoopData,
  ouraData,
  previousScore,
  baselineSleepHours,
  baselineStress,
}: CheckinFlowProps) {
  const router = useRouter();
  const toast = useToast();
  const showResumeToast = useDraftResumeToast();
  const outboxStatus = useOutboxStatus();
  const resumeToastFiredRef = useRef(false);

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

  /* ── Persisted form state (data + current step) ─────────────────────── */
  // Persist {data, phase} so a tab kill mid-checkin restores BOTH the
  // entered values AND the wizard step the athlete was on. The wearable
  // prefills become the initial baseline; once the athlete starts editing,
  // their values win on resume.
  const [persisted, setPersisted, draftStatus] = useDraftPersistence<PersistedCheckin>(
    `${userId}:wellness:checkin`,
    {
      data: {
        sleepQuality: prefillSleepQuality ?? 7,
        // Three-tier prefill: wearable data → lifestyle baseline → hardcoded.
        // The check-in tracks today; once the athlete edits, their value wins
        // on resume (see useDraftPersistence).
        sleepHours: prefillSleepHours ?? baselineSleepHours ?? 8,
        soreness: 7,
        sorenessArea: [],
        stressLevel: baselineStress ?? 5,
        energyMood: 7,
        hydration: "ADEQUATE",
        injuryStatus: "NONE",
        injuryNotes: "",
        notes: "",
        ouraSleepScore: ouraData?.sleepScore ?? null,
      },
      phase: "sleep",
    }
  );

  // Stable per-attempt id for server-side idempotency — generated once per
  // mount, reused across direct submit + outbox replay. Lives outside the
  // persisted draft (a new attempt after explicit Discard gets a fresh key).
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const data = persisted.data;
  const persistedPhase = persisted.phase;
  const setData = useCallback(
    (updater: (prev: CheckinData) => CheckinData) => {
      setPersisted((prev) => ({ ...prev, data: updater(prev.data) }));
    },
    [setPersisted]
  );
  const setStepPhase = useCallback(
    (next: Phase) => {
      // Only persist step-order phases; submitting/error/queued/summary are
      // transient UI and should never resurrect on reload.
      if (PERSISTED_PHASES.has(next)) {
        setPersisted((prev) => ({ ...prev, phase: next }));
      }
    },
    [setPersisted]
  );

  /* ── Transient UI state (not persisted) ─────────────────────────────── */
  const [transientPhase, setTransientPhase] = useState<Phase | null>(null);
  const phase: Phase = transientPhase ?? persistedPhase;
  const setPhase = useCallback(
    (next: Phase) => {
      if (PERSISTED_PHASES.has(next)) {
        setStepPhase(next);
        setTransientPhase(null);
      } else {
        setTransientPhase(next);
      }
    },
    [setStepPhase]
  );
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
  }, [phase, setPhase]);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(phase as Phase);
    if (idx > 0) {
      setDirection("back");
      setPhase(STEP_ORDER[idx - 1]);
    }
  }, [phase, setPhase]);

  /* ── Submit handler ─────────────────────────────────────────────────── */
  // Synchronous in-flight flag prevents rapid Retry taps from firing
  // concurrent POSTs before the `phase` state re-render hides the button.
  const inFlightRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase("submitting");

    const body = {
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
    };

    let res: Response;
    try {
      res = await fetch("/api/athlete/readiness", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      // Genuine network failure — queue for replay. The same idempotencyKey
      // protects against duplicate writes when the original POST silently
      // committed before the network died.
      logger.warn("wellness check-in: network failure, enqueuing to outbox", {
        context: "athlete/wellness/checkin-flow",
        metadata: { err: networkErr instanceof Error ? networkErr.message : String(networkErr) },
      });
      try {
        await enqueueMutation({
          url: "/api/athlete/readiness",
          method: "POST",
          bodyJson: body,
          idempotencyKey: idempotencyKeyRef.current,
          metadata: { kind: "wellness-checkin" },
        });
        toast.warning("Saved locally", "Will sync to your coach when you're back online.");
        // Trust the outbox and clear the draft. Wellness has natural daily
        // idempotency on the server (unique-per-day check returns 409), so
        // the worst-case "outbox eventually drops + user re-enters" is
        // recoverable from memory in 60 seconds.
        await draftStatus.clearDraft();
        setPhase("queued");
      } catch (queueErr) {
        // Both the network AND IDB failed — surface as error so the user
        // can manually retry.
        logger.error("wellness check-in: enqueue failed", {
          context: "athlete/wellness/checkin-flow",
          error: queueErr,
        });
        setErrorMsg("Couldn't save your check-in. Tap retry once you have a connection.");
        setPhase("error");
      } finally {
        inFlightRef.current = false;
      }
      return;
    }

    try {
      if (res.status === 409) {
        setErrorMsg("You already checked in today!");
        setPhase("error");
        return;
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || `Check-in failed (${res.status})`);
      }

      // Persisted draft is no longer needed — the server has the row.
      await draftStatus.clearDraft();
      setScore(payload.data.overallScore);
      setStreak(payload.data.streak ?? 0);
      setPhase("summary");
    } catch (err) {
      logger.error("wellness check-in submit failed", {
        context: "athlete/wellness/checkin-flow",
        error: err,
      });
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : "Your check-in didn't save. Tap retry to try again."
      );
      setPhase("error");
    } finally {
      inFlightRef.current = false;
    }
  }, [data, whoopData, ouraData, draftStatus, toast, setPhase]);

  /* ── Handle notes "Submit" (last step triggers submit) ──────────────── */
  const handleNotesNext = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  /* ── Resume toast for a recovered draft ────────────────────────────── */
  // One-shot per page load. Fires when the persisted draft has any user-
  // edited content (we use `notes` or any non-default soreness area as a
  // proxy for "actually started filling this in" — sliders default to a
  // value so we can't easily distinguish "untouched" from "intentional 7").
  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    const startedFilling =
      data.sorenessArea.length > 0 ||
      data.notes.trim() !== "" ||
      data.injuryNotes.trim() !== "" ||
      persistedPhase !== "sleep";
    if (!startedFilling) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "check-in",
      // Form is already loaded with the draft — no extra Continue action needed.
      onDiscard: async () => {
        await clearDraft();
        // Reset to a fresh starting point. The wearable prefills re-apply
        // because they live outside the persisted state.
        setPersisted({
          data: {
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
          },
          phase: "sleep",
        });
      },
    });
  }, [
    hasDraft,
    lastSavedAt,
    clearDraft,
    data,
    persistedPhase,
    showResumeToast,
    setPersisted,
    prefillSleepQuality,
    prefillSleepHours,
    ouraData,
  ]);

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
        <div className="w-14 h-14 rounded-full bg-danger-500/10 flex items-center justify-center">
          <AlertCircle
            size={28}
            strokeWidth={1.75}
            className="text-danger-500"
            aria-hidden="true"
          />
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

  // Queued state — submit didn't reach the server (offline / network failure)
  // but the payload is in the outbox with an X-Idempotency-Key. The
  // background drain will replay it; the server-side daily-uniqueness check
  // protects against duplicates if the original commit silently landed.
  if (phase === "queued") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
        <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center">
          <CheckCircle2
            size={28}
            strokeWidth={1.75}
            className="text-primary-500"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">Saved locally</h3>
          <p className="text-sm text-muted max-w-xs">
            Your check-in will sync to your coach as soon as you&rsquo;re back online.
          </p>
        </div>
        <Link
          href="/athlete/dashboard"
          className="text-sm font-semibold text-primary-500 hover:text-primary-400 transition-colors"
        >
          Back to home
        </Link>
      </div>
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
      {/* Save-status chip — small, top-right, reads from outbox + draft state.
          Quiet by design: visible only when there's a pending save or the
          user is offline. */}
      <div className="absolute top-0 right-0 z-10 pointer-events-none">
        <SaveStatusChip
          // We only render this branch for STEP_ORDER phases (the early
          // returns above handle submitting/error/queued/summary), so
          // isSaving is always false here. The chip surfaces offline +
          // outbox-pending state, which is the value worth showing on
          // step screens — submit-in-flight has its own dedicated UI.
          isSaving={false}
          pending={outboxStatus.pending}
          isOnline={outboxStatus.isOnline}
          authNeeded={outboxStatus.authNeeded}
        />
      </div>
      <div key={phase} className={animationClass}>
        {activeStep}
      </div>
    </div>
  );
}
