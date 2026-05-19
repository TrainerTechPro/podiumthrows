"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { SaveStatusChip } from "@/components/ui/SaveStatusChip";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { reportApiError } from "@/lib/form-errors";
import { enqueueMutation, useOutboxStatus } from "@/lib/outbox";
import { FormRendererShell } from "@/components/form-renderer/FormRendererShell";
import {
  PrefillToggleBanner,
  PrefillFieldHint,
} from "@/components/form-renderer/PrefillToggleBanner";
import { usePrefill } from "@/lib/forms/use-prefill";
import type { FormBlock, FormDisplayMode, ConditionalRule } from "@/lib/forms/types";

import { logger } from "@/lib/logger";
/* ─── Types ───────────────────────────────────────────────────────────────── */

type Question = {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
};

type Props = {
  questionnaire: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    questions: Question[];
    blocks: unknown[] | null;
    displayMode: string;
    welcomeScreen: unknown | null;
    thankYouScreen: unknown | null;
    conditionalLogic: unknown | null;
    scoringEnabled: boolean;
    draftAnswers: Record<string, unknown> | null;
  };
  /** Server session userId — scopes the IDB draft cache for the legacy path. */
  userId: string;
};

type AnswerMap = Record<string, unknown>;

/* ─── Component ───────────────────────────────────────────────────────────── */

export function QuestionnaireForm({ questionnaire, userId }: Props) {
  const blocks = questionnaire.blocks as FormBlock[] | null;
  const hasBlocks = blocks && blocks.length > 0;

  // Use the new block-based renderer when blocks are present.
  // The shell already has its own server-side draft via SaveResumeBar (PUTs
  // every 30s + on visibility change), so we don't add client-side IDB draft
  // persistence on top — that would be belt-and-suspenders for an
  // already-mature surface.
  if (hasBlocks) {
    return (
      <FormRendererShell
        questionnaireId={questionnaire.id}
        title={questionnaire.title}
        description={questionnaire.description}
        blocks={blocks}
        displayMode={questionnaire.displayMode as FormDisplayMode}
        conditionalLogic={questionnaire.conditionalLogic as ConditionalRule[] | undefined}
        scoringEnabled={questionnaire.scoringEnabled}
        draftAnswers={questionnaire.draftAnswers}
      />
    );
  }

  // Legacy question-based rendering
  return <LegacyQuestionForm questionnaire={questionnaire} userId={userId} />;
}

/* ─── Legacy Question Form ────────────────────────────────────────────────── */

function LegacyQuestionForm({ questionnaire, userId }: Props) {
  const router = useRouter();
  const showResumeToast = useDraftResumeToast();
  const outboxStatus = useOutboxStatus();
  const resumeToastFiredRef = useRef(false);

  // Persist answers to IDB so a tab kill mid-fill doesn't lose them. Scoped
  // per questionnaire id so the same athlete filling out two different
  // questionnaires keeps separate drafts.
  const initialAnswers = useMemo<AnswerMap>(
    () => (questionnaire.draftAnswers as AnswerMap) ?? {},
    [questionnaire.draftAnswers]
  );
  const [answers, setAnswersDraft, draftStatus] = useDraftPersistence<AnswerMap>(
    `${userId}:questionnaire:${questionnaire.id}`,
    initialAnswers
  );

  // Repeat-fill prefill: when this athlete has submitted this questionnaire
  // before, prefill matching questions with their last answer. Draft wins
  // over previous; user can toggle off.
  const knownIds = useMemo(
    () => questionnaire.questions.map((q) => q.id),
    [questionnaire.questions]
  );
  const prefill = usePrefill({
    questionnaireId: questionnaire.id,
    knownIds,
    answers,
    setAnswers: setAnswersDraft,
    draftAnswers: initialAnswers,
  });

  // Stable per-attempt id for server-side idempotency.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [queued, setQueued] = useState(false);

  const setAnswers = useCallback(
    (next: AnswerMap | ((prev: AnswerMap) => AnswerMap)) => setAnswersDraft(next),
    [setAnswersDraft]
  );

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMultiChoice(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) || [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }

  /* ── Progress ──────────────────────────────────────────────────────────── */

  const requiredCount = questionnaire.questions.filter((q) => q.required).length;
  const answeredRequired = useMemo(() => {
    return questionnaire.questions.filter((q) => {
      if (!q.required) return false;
      const val = answers[q.id];
      // Treat null/undefined as unanswered; accept 0 and other falsy numbers
      // as answered (CLAUDE.md rule 3 — preserve 0).
      if (val === undefined || val === null) return false;
      if (typeof val === "string" && val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
  }, [answers, questionnaire.questions]);

  const progress = requiredCount > 0 ? Math.round((answeredRequired / requiredCount) * 100) : 100;

  /* ── Submit ────────────────────────────────────────────────────────────── */

  const toast = useToast();

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const url = `/api/athlete/questionnaires/${questionnaire.id}`;
    const payload = {
      answers: questionnaire.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? null,
      })),
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKeyRef.current,
          ...csrfHeaders(),
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      // Network failure — queue for replay with the same idempotency key so
      // the server returns the cached response if the original commit landed
      // before the network died.
      logger.warn("questionnaire submit: network failure, enqueuing to outbox", {
        context: "athlete/questionnaires/[id]/questionnaire-form",
        metadata: {
          err: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
      });
      try {
        await enqueueMutation({
          url,
          method: "POST",
          bodyJson: payload,
          idempotencyKey: idempotencyKeyRef.current,
          metadata: { kind: "questionnaire-response", questionnaireId: questionnaire.id },
        });
        toast.warning("Saved locally", "Will sync when you're back online.");
        await draftStatus.clearDraft();
        setQueued(true);
      } catch (queueErr) {
        logger.error("questionnaire submit: enqueue failed", {
          context: "athlete/questionnaires/[id]/questionnaire-form",
          error: queueErr,
        });
        const msg = "Couldn't save — try again with a connection.";
        setError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
        setShowConfirm(false);
      }
      return;
    }

    try {
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const info = reportApiError({ res, payload: data }, toast, {
          onRetry: handleSubmit,
          silent: true,
        });
        setError(info.message);
        return;
      }

      // Server has the response — drop the persisted draft.
      await draftStatus.clearDraft();
      setSubmitted(true);
      toast.success("Questionnaire submitted");
    } catch (err) {
      logger.error("questionnaire submit failed", {
        context: "athlete/questionnaires/[id]/questionnaire-form",
        error: err,
      });
      const info = reportApiError({ err }, toast, {
        onRetry: handleSubmit,
        silent: true,
      });
      setError(info.message);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  /* ── Resume toast for a recovered draft ────────────────────────────────── */

  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    // "Started filling" = at least one answer is non-empty.
    const startedFilling = Object.values(answers).some((v) => {
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v !== "";
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
    if (!startedFilling) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "questionnaire",
      onDiscard: async () => {
        await clearDraft();
        setAnswersDraft(initialAnswers);
      },
    });
  }, [
    hasDraft,
    lastSavedAt,
    clearDraft,
    answers,
    showResumeToast,
    setAnswersDraft,
    initialAnswers,
  ]);

  /* ── Queued state — submit landed in the outbox ──────────────────────── */

  if (queued) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto">
          <WifiOff size={28} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Saved locally</h2>
        <p className="text-sm text-muted max-w-sm mx-auto">
          Your responses will sync when you&rsquo;re back online.
        </p>
        <Link
          href="/athlete/questionnaires"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors"
        >
          ← Back to Questionnaires
        </Link>
      </div>
    );
  }

  /* ── Success state ──────────────────────────────────────────────────────── */

  if (submitted) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-success-500/15 flex items-center justify-center mx-auto">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-success-500"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Submitted Successfully</h2>
        <p className="text-sm text-muted">Your responses have been recorded. Thank you!</p>
        <Button onClick={() => router.push("/athlete/questionnaires")}>
          ← Back to Questionnaires
        </Button>
      </div>
    );
  }

  /* ── Form ───────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {questionnaire.description && (
        <p className="text-sm text-muted">{questionnaire.description}</p>
      )}

      {/* Save-status chip — quiet by design; only visible while saving, offline,
          or with outbox-pending items. */}
      {(submitting || !outboxStatus.isOnline || outboxStatus.pending > 0) && (
        <div className="flex justify-end">
          <SaveStatusChip
            isSaving={submitting}
            pending={outboxStatus.pending}
            isOnline={outboxStatus.isOnline}
            authNeeded={outboxStatus.authNeeded}
          />
        </div>
      )}

      {/* Progress */}
      {requiredCount > 0 && (
        <ProgressBar
          value={progress}
          label={`${answeredRequired} of ${requiredCount} required answered`}
          showLabel
          size="sm"
          animate
        />
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </div>
      )}

      <PrefillToggleBanner
        prefilledCount={prefill.prefilledIds.size}
        previousCompletedAt={prefill.previousCompletedAt}
        on={prefill.useToggle}
        onChange={prefill.setUseToggle}
      />

      {/* Questions */}
      <div className="space-y-5">
        {questionnaire.questions.map((q, i) => (
          <div key={q.id} className="card p-4 space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              {i + 1}. {q.text}
              {q.required && <span className="text-danger-500 ml-1">*</span>}
            </label>

            {/* Short text */}
            {q.type === "short_text" && (
              <Input
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Your answer…"
              />
            )}

            {/* Long text */}
            {q.type === "long_text" && (
              <textarea
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y min-h-[80px]"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Your answer…"
                rows={3}
              />
            )}

            {/* Number */}
            {q.type === "number" && (
              <Input
                type="number"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="0"
              />
            )}

            {/* Scale 1-5 or 1-10 */}
            {(q.type === "scale_1_5" || q.type === "scale_1_10") && (
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: q.type === "scale_1_5" ? 5 : 10 }, (_, i) => i + 1).map(
                  (n) => {
                    const selected = answers[q.id] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswer(q.id, n)}
                        className={`min-w-[44px] min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors ${
                          selected
                            ? "bg-primary-500 text-white ring-2 ring-primary-500/30"
                            : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* Single choice */}
            {q.type === "single_choice" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, j) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full text-left px-3 py-3 min-h-[44px] rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        selected
                          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                          selected
                            ? "border-primary-500 bg-primary-500"
                            : "border-[var(--card-border)]"
                        }`}
                      />
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Multiple choice */}
            {q.type === "multiple_choice" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, j) => {
                  const current = (answers[q.id] as string[]) || [];
                  const checked = current.includes(opt);
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => toggleMultiChoice(q.id, opt)}
                      className={`w-full text-left px-3 py-3 min-h-[44px] rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        checked
                          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center ${
                          checked
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-[var(--card-border)]"
                        }`}
                      >
                        {checked && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Yes/No */}
            {q.type === "yes_no" && (
              <div className="flex gap-2">
                {["Yes", "No"].map((opt) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={`px-6 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        selected
                          ? opt === "Yes"
                            ? "bg-success-500/15 text-success-600 dark:text-success-400 ring-1 ring-success-500/30"
                            : "bg-danger-500/15 text-danger-600 dark:text-danger-400 ring-1 ring-danger-500/30"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            <PrefillFieldHint
              visible={prefill.prefilledIds.has(q.id)}
              onDismiss={() => prefill.dismissPrefill(q.id)}
            />
          </div>
        ))}
      </div>

      {/* Sticky footer — long questionnaires would otherwise force the
          athlete to scroll past every section to find Submit. Anchored to
          the viewport with safe-area padding so it sits above the iOS
          home-indicator and any nested keyboard. */}
      <div
        className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[var(--surface-overlay)] border-t border-[var(--card-border)] flex items-center justify-between gap-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button variant="ghost" onClick={() => router.push("/athlete/questionnaires")}>
          ← Back
        </Button>
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={requiredCount > 0 && answeredRequired < requiredCount}
        >
          Submit
        </Button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="Submit Responses"
        description="Are you sure you want to submit? Your responses cannot be changed after submission."
        confirmLabel="Save Responses"
        loading={submitting}
      />
    </div>
  );
}
