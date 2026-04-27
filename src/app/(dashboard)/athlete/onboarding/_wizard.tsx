"use client";

import { useReducer, useEffect, useCallback, useTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import type { ThrowEvent } from "@/lib/throws/constants";
import {
  initialState,
  onboardingReducer,
  currentStepNumber,
  canAdvance,
  distanceToMeters,
  weightToKg,
  type OnboardingMode,
  type OnboardingState,
  type ClassStanding,
  type TurnDirection,
} from "./_state";
import { OnboardingProgress } from "./_progress";
import { Step1Event } from "./_steps/Step1Event";
import { Step2Profile } from "./_steps/Step2Profile";
import { Step3PR } from "./_steps/Step3PR";
import { Step4FirstLog } from "./_steps/Step4FirstLog";
import { Step5Celebrate } from "./_steps/Step5Celebrate";

interface OnboardingWizardProps {
  userId: string;
  firstName: string;
  coachFirstName: string;
  hasCoach: boolean;
  prefill: {
    event: ThrowEvent | null;
    classStanding: ClassStanding | null;
    turnDirection: TurnDirection | null;
    gradYear: number | null;
  };
}

/**
 * Five-step onboarding wizard. Replaces the legacy 6-step flow.
 *
 *   Step 1 — Welcome + Event picker (always visible)
 *   Step 2 — Profile basics (signup mode only — invite skips)
 *   Step 3 — Recent PR (signup mode only — invite skips)
 *   Step 4 — First throw log (always visible)
 *   Step 5 — Celebration → auto-route to dashboard
 *
 * Invite mode (?from=invite) shows 3 dots + Steps 1, 4, 5. Coach has
 * already filled events/gender via proxy invite, so the profile + PR
 * capture screens are noise. The coach name shows up at Step 4.
 *
 * Submit happens at Step 4: PATCH /api/athlete/profile (events,
 * classStanding, turnDirection, completeOnboarding=true, optional
 * competitionPBs from Step 3) + POST /api/athlete/throws (the first
 * logged throw). On success → Step 5 fires PRCelebration + haptic + toast,
 * auto-routes to /athlete/dashboard after 1500ms.
 */
export function OnboardingWizard({
  userId,
  firstName,
  coachFirstName,
  hasCoach,
  prefill,
}: OnboardingWizardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const mode: OnboardingMode = searchParams.get("from") === "invite" ? "invite" : "signup";

  const [state, dispatch] = useReducer(onboardingReducer, mode, initialState);

  // Draft persistence — keyed per user, per mode.
  const draftKey = userId ? `onboarding:v2:${userId}:${mode}` : null;
  const [draft, setDraft] = useDraftPersistence<Partial<OnboardingState>>(draftKey, {});

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const merged: Partial<OnboardingState> = {
      event: prefill.event,
      classStanding: prefill.classStanding,
      turnDirection: prefill.turnDirection,
      ...draft, // draft wins for fields the athlete touched mid-flow
    };

    dispatch({ type: "HYDRATE", payload: merged });
  }, [draft, prefill]);

  // Persist relevant fields to draft on change (debounced inside the hook).
  useEffect(() => {
    if (!state.hydrated) return;
    setDraft({
      event: state.event,
      classStanding: state.classStanding,
      trainingLevel: state.trainingLevel,
      turnDirection: state.turnDirection,
      prImplementWeight: state.prImplementWeight,
      prImplementUnit: state.prImplementUnit,
      prDistance: state.prDistance,
      prDistanceUnit: state.prDistanceUnit,
      prDate: state.prDate,
      firstThrowDistance: state.firstThrowDistance,
      firstThrowDistanceUnit: state.firstThrowDistanceUnit,
      firstThrowImplementWeight: state.firstThrowImplementWeight,
      firstThrowImplementUnit: state.firstThrowImplementUnit,
      firstThrowRpe: state.firstThrowRpe,
    });
  }, [state, setDraft]);

  /* ─── Submit at Step 4 → log throw + complete profile ─── */

  const handleSubmit = useCallback(async () => {
    if (!state.event) return;
    const distanceM = distanceToMeters(state.firstThrowDistance, state.firstThrowDistanceUnit);
    if (distanceM == null || distanceM <= 0) {
      dispatch({ type: "SUBMIT_ERROR", error: "Add a distance to log your throw." });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    try {
      const prDistanceM = distanceToMeters(state.prDistance, state.prDistanceUnit);
      const competitionPBs =
        prDistanceM != null && prDistanceM > 0
          ? [{ event: state.event, distance: prDistanceM }]
          : undefined;

      const profilePayload: Record<string, unknown> = {
        events: [state.event],
        classStanding: state.classStanding,
        turnDirection: state.turnDirection,
        completeOnboarding: true,
      };
      if (competitionPBs) profilePayload.competitionPBs = competitionPBs;

      const profileRes = await fetch("/api/athlete/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(profilePayload),
      });
      const profileData = await profileRes.json().catch(() => null);
      if (!profileRes.ok || !profileData?.success) {
        const msg = profileData?.error ?? `Couldn't save profile (${profileRes.status}).`;
        dispatch({ type: "SUBMIT_ERROR", error: msg });
        toast.error(msg);
        return;
      }

      const implementKg =
        weightToKg(state.firstThrowImplementWeight, state.firstThrowImplementUnit) ?? null;

      const throwPayload: Record<string, unknown> = {
        event: state.event,
        distance: distanceM,
        rpe: state.firstThrowRpe,
      };
      if (implementKg != null) {
        throwPayload.implementKg = implementKg;
        throwPayload.implementWeightUnit = state.firstThrowImplementUnit === "lb" ? "lbs" : "kg";
        const implementOriginal = parseFloat(state.firstThrowImplementWeight);
        if (Number.isFinite(implementOriginal)) {
          throwPayload.implementWeightOriginal = implementOriginal;
        }
      }

      const throwRes = await fetch("/api/athlete/throws", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(throwPayload),
      });
      const throwData = await throwRes.json().catch(() => null);
      if (!throwRes.ok || !throwData?.success) {
        // Profile saved but throw failed — surface the warning, advance anyway
        // so the athlete sees the celebration. Dashboard will reflect the
        // saved profile; they can re-log the throw if needed.
        const msg =
          throwData?.error ??
          `Saved your profile, but couldn't log the throw (${throwRes.status}).`;
        toast.warning(msg);
        logger.warn("[onboarding] throw POST failed after profile success", {
          context: "athlete/onboarding",
          metadata: { status: throwRes.status, error: throwData?.error },
        });
      }

      dispatch({ type: "ADVANCE" });
    } catch (err) {
      logger.error("[onboarding] submit failed", {
        context: "athlete/onboarding",
        error: err,
      });
      dispatch({ type: "SUBMIT_ERROR", error: "Network error. Please try again." });
      toast.error("Network error. Please try again.");
    }
  }, [state, toast]);

  /* ─── Navigation ─── */

  const handlePrimaryAction = useCallback(() => {
    const step = currentStepNumber(state);
    if (step === 4) {
      void handleSubmit();
      return;
    }
    if (canAdvance(state)) {
      startTransition(() => dispatch({ type: "ADVANCE" }));
    }
  }, [state, handleSubmit]);

  const handleBack = useCallback(() => {
    if (state.currentIndex === 0) {
      router.push("/athlete/dashboard");
      return;
    }
    dispatch({ type: "BACK" });
  }, [state.currentIndex, router]);

  const handleSkipStep = useCallback(() => {
    if (canAdvance(state)) {
      dispatch({ type: "ADVANCE" });
    }
  }, [state]);

  const handlePickEvent = useCallback((event: ThrowEvent) => {
    dispatch({ type: "SET_EVENT", event });
    setTimeout(() => dispatch({ type: "ADVANCE" }), 250);
  }, []);

  const handleChangeEvent = useCallback(() => {
    dispatch({ type: "GO_TO", index: 0 });
  }, []);

  /* ─── Render ─── */

  const step = currentStepNumber(state);
  const showBack = state.currentIndex > 0 && step !== 5;
  const showPrimaryButton = step !== 1 && step !== 5;
  const primaryLabel =
    step === 2
      ? "Looks good"
      : step === 3
        ? "Set my PR"
        : step === 4
          ? state.submitting
            ? "Logging…"
            : "Log it"
          : "Continue";

  const showSecondarySkip = step === 2 || step === 3 || step === 4;
  const secondaryLabel =
    step === 2
      ? "Skip for now"
      : step === 3
        ? "I haven't competed yet"
        : "Skip — I'll log my first one later";

  const primaryDisabled = step === 4 ? !canAdvance(state) || state.submitting : !canAdvance(state);

  return (
    <div className="min-h-[100dvh] flex flex-col px-4 sm:px-6 max-w-md mx-auto w-full">
      <header className="flex items-center gap-3 pt-3 pb-2">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="h-9 w-9 -ml-2 inline-flex items-center justify-center rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : (
          <span className="h-9 w-9 -ml-2" aria-hidden="true" />
        )}
        <div className="flex-1">
          <OnboardingProgress total={state.visibleSteps.length} current={state.currentIndex} />
        </div>
        <span className="h-9 w-9" aria-hidden="true" />
      </header>

      <main className="flex-1 py-6">
        {step === 1 && (
          <Step1Event
            firstName={firstName}
            event={state.event}
            mode={mode}
            onPick={handlePickEvent}
          />
        )}
        {step === 2 && (
          <Step2Profile
            classStanding={state.classStanding}
            trainingLevel={state.trainingLevel}
            turnDirection={state.turnDirection}
            onClassStanding={(v) => dispatch({ type: "SET_CLASS_STANDING", value: v })}
            onTrainingLevel={(v) => dispatch({ type: "SET_TRAINING_LEVEL", value: v })}
            onTurnDirection={(v) => dispatch({ type: "SET_TURN_DIRECTION", value: v })}
          />
        )}
        {step === 3 && (
          <Step3PR
            prImplementWeight={state.prImplementWeight}
            prImplementUnit={state.prImplementUnit}
            prDistance={state.prDistance}
            prDistanceUnit={state.prDistanceUnit}
            prDate={state.prDate}
            onChange={(patch) => dispatch({ type: "SET_PR", patch })}
          />
        )}
        {step === 4 && state.event && (
          <Step4FirstLog
            mode={mode}
            coachFirstName={coachFirstName}
            event={state.event}
            firstThrowDistance={state.firstThrowDistance}
            firstThrowDistanceUnit={state.firstThrowDistanceUnit}
            firstThrowImplementWeight={state.firstThrowImplementWeight}
            firstThrowImplementUnit={state.firstThrowImplementUnit}
            firstThrowRpe={state.firstThrowRpe}
            onChange={(patch) => dispatch({ type: "SET_FIRST_THROW", patch })}
            onChangeEvent={handleChangeEvent}
          />
        )}
        {step === 5 && (
          <Step5Celebrate
            mode={mode}
            hasCoach={hasCoach}
            distanceMeters={distanceToMeters(
              state.firstThrowDistance,
              state.firstThrowDistanceUnit
            )}
            displayUnit={state.firstThrowDistanceUnit}
          />
        )}

        {state.error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 px-4 py-3 text-sm text-danger-700 dark:text-danger-400"
          >
            {state.error}
          </div>
        )}
      </main>

      {(showPrimaryButton || showSecondarySkip) && (
        <footer
          className="sticky bottom-0 bg-[var(--surface-overlay)] border-t border-[var(--card-border)] px-0 py-3 space-y-2"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {showPrimaryButton && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              className="w-full h-12 text-base"
            >
              {primaryLabel}
            </Button>
          )}
          {showSecondarySkip && (
            <button
              type="button"
              onClick={handleSkipStep}
              disabled={state.submitting}
              className="w-full h-10 text-sm font-medium text-muted hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
            >
              {secondaryLabel}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
