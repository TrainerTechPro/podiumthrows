"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";
import type {
  FormBlock,
  FormDisplayMode,
  ConditionalRule,
  ScoringConfig,
  WelcomeScreenBlock,
  ThankYouScreenBlock,
} from "@/lib/forms/types";
import { INPUT_BLOCK_TYPES } from "@/lib/forms/types";
import { getVisibleBlockIds } from "@/lib/forms/conditional-engine";
import { validateAnswer } from "@/lib/forms/validation";
import { WelcomeScreen } from "@/components/form-blocks/WelcomeScreen";
import { ThankYouScreen } from "@/components/form-blocks/ThankYouScreen";
import { AllAtOnceRenderer } from "./AllAtOnceRenderer";
import { OnePerPageRenderer } from "./OnePerPageRenderer";
import { SectionedRenderer } from "./SectionedRenderer";
import { SaveResumeBar } from "./SaveResumeBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface FormRendererShellProps {
  questionnaireId: string;
  title: string;
  description?: string | null;
  blocks: FormBlock[];
  displayMode: FormDisplayMode;
  conditionalLogic?: ConditionalRule[];
  scoringEnabled?: boolean;
  scoringRules?: ScoringConfig | null;
  draftAnswers?: Record<string, unknown> | null;
  /** Callback after successful submission */
  onComplete?: () => void;
}

type Phase = "welcome" | "form" | "thankyou" | "submitted";

export function FormRendererShell({
  questionnaireId,
  title,
  description,
  blocks,
  displayMode,
  conditionalLogic,
  draftAnswers,
  onComplete,
}: FormRendererShellProps) {
  const router = useRouter();

  // Find welcome/thankyou screens
  const welcomeBlock = blocks.find(
    (b) => b.type === "welcome_screen"
  ) as WelcomeScreenBlock | undefined;
  const thankYouBlock = blocks.find(
    (b) => b.type === "thank_you_screen"
  ) as ThankYouScreenBlock | undefined;

  // Phase management
  const [phase, setPhase] = useState<Phase>(
    welcomeBlock ? "welcome" : "form"
  );

  // Answer state (load from draft if available)
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    draftAnswers ?? {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedAt = useMemo(() => Date.now(), []);

  // Visible blocks (filtered by conditional logic)
  const visibleBlockIds = useMemo(() => {
    if (!conditionalLogic?.length) return blocks.map((b) => b.id);
    return getVisibleBlockIds(blocks, conditionalLogic, answers);
  }, [blocks, conditionalLogic, answers]);

  // Required input blocks that are visible
  const visibleInputBlocks = useMemo(() => {
    const visibleSet = new Set(visibleBlockIds);
    return blocks.filter(
      (b) => visibleSet.has(b.id) && INPUT_BLOCK_TYPES.includes(b.type)
    );
  }, [blocks, visibleBlockIds]);

  const requiredVisible = visibleInputBlocks.filter((b) => b.required);
  const allRequiredAnswered = requiredVisible.every((b) => {
    const val = answers[b.id];
    return val !== undefined && val !== null && val !== "";
  });

  // Handle answer change
  const handleAnswer = useCallback((blockId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [blockId]: value }));
    // Clear error for this block
    setErrors((prev) => {
      if (!prev[blockId]) return prev;
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
  }, []);

  // Validate all visible required blocks
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    for (const block of visibleInputBlocks) {
      const err = validateAnswer(block, answers[block.id]);
      if (err) {
        newErrors[block.id] = err;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleInputBlocks, answers]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setShowConfirm(true);
  }, [validate]);

  const confirmSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    const payload = {
      answers,
      durationSeconds,
    };

    try {
      const res = await fetch(
        `/api/athlete/questionnaires/${questionnaireId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Failed to submit");
        return;
      }

      if (thankYouBlock) {
        setPhase("thankyou");
      } else {
        setPhase("submitted");
      }
      onComplete?.();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }, [
    answers,
    questionnaireId,
    startedAt,
    thankYouBlock,
    onComplete,
  ]);

  const goBack = useCallback(() => {
    router.push("/athlete/questionnaires");
  }, [router]);

  // ─── Welcome Phase ──────────────────────────────────────────────────────
  if (phase === "welcome" && welcomeBlock) {
    return (
      <WelcomeScreen
        block={welcomeBlock}
        onStart={() => setPhase("form")}
      />
    );
  }

  // ─── Thank You Phase ────────────────────────────────────────────────────
  if (phase === "thankyou" && thankYouBlock) {
    return (
      <ThankYouScreen
        block={thankYouBlock}
        onDone={goBack}
      />
    );
  }

  // ─── Submitted (no thank-you screen) ────────────────────────────────────
  if (phase === "submitted") {
    return (
      <div className="card p-8 text-center space-y-3 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-green-500"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Submitted Successfully
        </h2>
        <p className="text-sm text-muted">
          Your responses have been recorded. Thank you!
        </p>
        <button
          onClick={goBack}
          className="px-6 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors"
        >
          Back to Questionnaires
        </button>
      </div>
    );
  }

  // ─── Form Phase ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted mt-1">{description}</p>
        )}
      </div>

      {submitError && (
        <div className="px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-sm text-danger-600 dark:text-danger-400">
          {submitError}
        </div>
      )}

      {/* Renderer by mode */}
      {displayMode === "ALL_AT_ONCE" && (
        <AllAtOnceRenderer
          blocks={blocks}
          visibleBlockIds={visibleBlockIds}
          answers={answers}
          errors={errors}
          conditionalLogic={conditionalLogic}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          onBack={goBack}
          canSubmit={allRequiredAnswered}
          submitting={submitting}
        />
      )}

      {displayMode === "ONE_PER_PAGE" && (
        <OnePerPageRenderer
          blocks={blocks}
          visibleBlockIds={visibleBlockIds}
          answers={answers}
          errors={errors}
          conditionalLogic={conditionalLogic}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          onBack={goBack}
          canSubmit={allRequiredAnswered}
          submitting={submitting}
        />
      )}

      {displayMode === "SECTIONED" && (
        <SectionedRenderer
          blocks={blocks}
          visibleBlockIds={visibleBlockIds}
          answers={answers}
          errors={errors}
          conditionalLogic={conditionalLogic}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          onBack={goBack}
          canSubmit={allRequiredAnswered}
          submitting={submitting}
        />
      )}

      {/* Auto-save */}
      <SaveResumeBar
        questionnaireId={questionnaireId}
        answers={answers}
        enabled={phase === "form"}
      />

      {/* Submit confirmation */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSubmit}
        title="Submit Responses"
        description="Are you sure you want to submit? Your responses cannot be changed after submission."
        confirmLabel="Submit"
        loading={submitting}
      />
    </div>
  );
}
