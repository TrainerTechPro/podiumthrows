"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FormRendererShell } from "@/components/form-renderer/FormRendererShell";
import type { FormBlock, FormDisplayMode, ConditionalRule } from "@/lib/forms/types";

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
};

type AnswerMap = Record<string, unknown>;

/* ─── Component ───────────────────────────────────────────────────────────── */

export function QuestionnaireForm({ questionnaire }: Props) {
  const blocks = questionnaire.blocks as FormBlock[] | null;
  const hasBlocks = blocks && blocks.length > 0;

  // Use the new block-based renderer when blocks are present
  if (hasBlocks) {
    return (
      <FormRendererShell
        questionnaireId={questionnaire.id}
        title={questionnaire.title}
        description={questionnaire.description}
        blocks={blocks}
        displayMode={questionnaire.displayMode as FormDisplayMode}
        conditionalLogic={
          questionnaire.conditionalLogic as ConditionalRule[] | undefined
        }
        scoringEnabled={questionnaire.scoringEnabled}
        draftAnswers={questionnaire.draftAnswers}
      />
    );
  }

  // Legacy question-based rendering
  return (
    <LegacyQuestionForm questionnaire={questionnaire} />
  );
}

/* ─── Legacy Question Form ────────────────────────────────────────────────── */

function LegacyQuestionForm({ questionnaire }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
  }, [answers, questionnaire.questions]);

  const progress = requiredCount > 0 ? Math.round((answeredRequired / requiredCount) * 100) : 100;

  /* ── Submit ────────────────────────────────────────────────────────────── */

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const payload = {
      answers: questionnaire.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? null,
      })),
    };

    try {
      const res = await fetch(`/api/athlete/questionnaires/${questionnaire.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  /* ── Success state ──────────────────────────────────────────────────────── */

  if (submitted) {
    return (
      <div className="card p-8 text-center space-y-3">
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
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {questionnaire.questions.map((q, i) => (
          <div key={q.id} className="card p-4 space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              {i + 1}. {q.text}
              {q.required && <span className="text-red-500 ml-1">*</span>}
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y min-h-[80px]"
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
                {Array.from(
                  { length: q.type === "scale_1_5" ? 5 : 10 },
                  (_, i) => i + 1
                ).map((n) => {
                  const selected = answers[q.id] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(q.id, n)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        selected
                          ? "bg-primary-500 text-white ring-2 ring-primary-500/30"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
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
                      className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selected
                          ? opt === "Yes"
                            ? "bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30"
                            : "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/athlete/questionnaires")}
        >
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
        confirmLabel="Submit"
        loading={submitting}
      />
    </div>
  );
}
