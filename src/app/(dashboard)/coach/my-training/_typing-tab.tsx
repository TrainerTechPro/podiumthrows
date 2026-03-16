"use client";

import { useState } from "react";
import {
  TYPING_QUIZZES,
  type QuizQuestion,
  type QuizOption,
} from "@/lib/throws/profile-constants";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface CoachTypingData {
  adaptationGroup: number | null;
  adaptationLabel: string | null;
  adaptationConf: number | null;
  transferType: string | null;
  transferLabel: string | null;
  transferConf: number | null;
  selfFeelingAccuracy: string | null;
  selfFeelingLabel: string | null;
  selfFeelingConf: number | null;
  lightImplResponse: string | null;
  lightImplLabel: string | null;
  lightImplConf: number | null;
  recoveryProfile: string | null;
  recoveryLabel: string | null;
  recoveryConf: number | null;
  recommendedMethod: string | null;
  methodReason: string | null;
  complexDuration: string | null;
  sessionsToForm: number | null;
  completedAt: string | null;
}

/* ─── Quiz Runner ──────────────────────────────────────────────────────────── */

const QUIZ_ORDER = [
  "adaptationSpeed",
  "transferType",
  "selfFeeling",
  "lightImpl",
  "recovery",
] as const;

type QuizId = (typeof QUIZ_ORDER)[number];

function QuizRunner({ onComplete }: { onComplete: (data: CoachTypingData) => void }) {
  const [quizIdx, setQuizIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<QuizId, QuizOption["score"][]>>({
    adaptationSpeed: [],
    transferType: [],
    selfFeeling: [],
    lightImpl: [],
    recovery: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const currentQuizId = QUIZ_ORDER[quizIdx];
  const currentQuiz = TYPING_QUIZZES[currentQuizId];
  const questions = currentQuiz.questions as QuizQuestion[];
  const currentQuestion = questions[questionIdx];

  const totalQuestions = QUIZ_ORDER.reduce(
    (sum, id) => sum + (TYPING_QUIZZES[id].questions as QuizQuestion[]).length,
    0
  );
  const answeredSoFar = QUIZ_ORDER.slice(0, quizIdx).reduce(
    (sum, id) => sum + responses[id].length,
    0
  ) + responses[currentQuizId].length;

  function handleAnswer(option: QuizOption) {
    const updated = { ...responses };
    updated[currentQuizId] = [...updated[currentQuizId], option.score];
    setResponses(updated);

    if (questionIdx < questions.length - 1) {
      setQuestionIdx(questionIdx + 1);
    } else if (quizIdx < QUIZ_ORDER.length - 1) {
      setQuizIdx(quizIdx + 1);
      setQuestionIdx(0);
    } else {
      // All quizzes done — submit
      submitResults(updated);
    }
  }

  async function submitResults(finalResponses: Record<QuizId, QuizOption["score"][]>) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/coach/my-training/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          adaptationSpeedResponses: finalResponses.adaptationSpeed,
          transferTypeResponses: finalResponses.transferType,
          selfFeelingResponses: finalResponses.selfFeeling,
          lightImplResponses: finalResponses.lightImpl,
          recoveryResponses: finalResponses.recovery,
        }),
      });
      const data = await res.json();
      if (data.ok) onComplete(data.data);
    } catch {
      alert("Failed to save results");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div className="card py-12 text-center">
        <p className="text-sm text-muted">Computing your Bondarchuk classification...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-spring-up">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{currentQuiz.title}</span>
          <span>{answeredSoFar + 1} of {totalQuestions}</span>
        </div>
        <div className="bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary-500 h-full rounded-full transition-all"
            style={{ width: `${((answeredSoFar) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {currentQuestion.question}
        </p>

        <div className="space-y-2">
          {currentQuestion.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleAnswer(option)}
              className="w-full text-left p-3 rounded-xl border border-[var(--card-border)] hover:border-primary-400 hover:bg-primary-500/5 transition-colors text-sm text-[var(--foreground)]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Results View ─────────────────────────────────────────────────────────── */

function TypingResults({ data }: { data: CoachTypingData }) {
  const classifications = [
    {
      label: "Adaptation Speed",
      value: data.adaptationLabel,
      confidence: data.adaptationConf,
      detail: data.adaptationGroup
        ? `Group ${data.adaptationGroup}`
        : null,
    },
    {
      label: "Transfer Type",
      value: data.transferLabel,
      confidence: data.transferConf,
    },
    {
      label: "Self-Feeling Accuracy",
      value: data.selfFeelingLabel,
      confidence: data.selfFeelingConf,
    },
    {
      label: "Light Implement Response",
      value: data.lightImplLabel,
      confidence: data.lightImplConf,
    },
    {
      label: "Recovery Profile",
      value: data.recoveryLabel,
      confidence: data.recoveryConf,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Classification Cards */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
          Your Bondarchuk Classification
        </h3>

        <div className="space-y-3">
          {classifications.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted">{c.label}</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {c.value ?? "Unknown"}
                  {c.detail && <span className="text-muted font-normal ml-1">({c.detail})</span>}
                </p>
              </div>
              {c.confidence != null && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 bg-surface-100 dark:bg-surface-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary-500 h-full rounded-full"
                      style={{ width: `${c.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted w-8 text-right">
                    {c.confidence}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Method */}
      {data.recommendedMethod && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
            Recommended Training Method
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-500">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)] capitalize">
                {data.recommendedMethod} Method
              </p>
              <p className="text-xs text-muted">{data.methodReason}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            {data.complexDuration && (
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900/40">
                <span className="text-[10px] text-muted uppercase tracking-wider">Complex Duration</span>
                <p className="text-sm font-semibold text-[var(--foreground)]">{data.complexDuration}</p>
              </div>
            )}
            {data.sessionsToForm != null && (
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900/40">
                <span className="text-[10px] text-muted uppercase tracking-wider">Sessions to Form</span>
                <p className="text-sm font-semibold text-[var(--foreground)]">~{data.sessionsToForm}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {data.completedAt && (
        <p className="text-xs text-muted text-center">
          Completed {new Date(data.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

/* ─── Typing Tab ───────────────────────────────────────────────────────────── */

export function TypingTab({
  typingData: initial,
}: {
  typingData: CoachTypingData | null;
}) {
  const [typingData, setTypingData] = useState(initial);
  const [showQuiz, setShowQuiz] = useState(false);

  // State 3: Results view
  if (typingData && !showQuiz) {
    return (
      <div className="space-y-4">
        <TypingResults data={typingData} />
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowQuiz(true)}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // State 2: Quiz flow
  if (showQuiz) {
    return (
      <QuizRunner
        onComplete={(data) => {
          setTypingData(data);
          setShowQuiz(false);
        }}
      />
    );
  }

  // State 1: No data — CTA
  return (
    <div className="card py-12 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-500">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div>
        <h3 className="text-base font-bold text-[var(--foreground)]">
          Bondarchuk Typing Quiz
        </h3>
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          Answer 19 questions about your training responses to discover your adaptation speed,
          transfer type, and recommended training method based on Bondarchuk&apos;s research.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setShowQuiz(true)}
        className="btn-primary"
      >
        Take the Quiz
      </button>
    </div>
  );
}
