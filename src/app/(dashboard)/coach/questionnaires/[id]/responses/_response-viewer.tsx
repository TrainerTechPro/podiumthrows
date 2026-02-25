"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Answer = {
  questionId: string;
  questionText: string;
  answer: unknown;
};

type Response = {
  id: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  answers: Answer[];
  completedAt: string;
};

type Question = {
  id: string;
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
};

type Props = {
  responses: Response[];
  questions: Question[];
  questionnaireType: string;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ResponseViewer({ responses, questions, questionnaireType }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    responses[0]?.id ?? null
  );
  const [tab, setTab] = useState<"individual" | "summary">("individual");

  const selected = responses.find((r) => r.id === selectedId);

  const isPARQ =
    questionnaireType === "ONBOARDING" || questionnaireType === "ASSESSMENT";

  /* ── Summary calculations ──────────────────────────────────────────────── */

  function getSummary() {
    return questions.map((q) => {
      const answersForQ = responses
        .map((r) => r.answers.find((a) => a.questionId === q.id))
        .filter(Boolean) as Answer[];

      if (q.type === "yes_no") {
        const yesCount = answersForQ.filter(
          (a) => String(a.answer).toLowerCase() === "yes"
        ).length;
        const noCount = answersForQ.filter(
          (a) => String(a.answer).toLowerCase() === "no"
        ).length;
        return {
          question: q,
          type: "yes_no" as const,
          yesCount,
          noCount,
          total: answersForQ.length,
          yesPercent:
            answersForQ.length > 0
              ? Math.round((yesCount / answersForQ.length) * 100)
              : 0,
        };
      }

      if (
        q.type === "scale_1_5" ||
        q.type === "scale_1_10" ||
        q.type === "number"
      ) {
        const values = answersForQ
          .map((a) => Number(a.answer))
          .filter((v) => !isNaN(v));
        const avg =
          values.length > 0
            ? values.reduce((s, v) => s + v, 0) / values.length
            : 0;
        return {
          question: q,
          type: "numeric" as const,
          avg: Math.round(avg * 10) / 10,
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          total: values.length,
        };
      }

      // Text or choice — show response count
      return {
        question: q,
        type: "text" as const,
        total: answersForQ.length,
        responses: answersForQ.map((a) => String(a.answer)),
      };
    });
  }

  if (responses.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted text-sm">No responses yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl w-fit">
        <button
          onClick={() => setTab("individual")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "individual"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          }`}
        >
          Individual
        </button>
        <button
          onClick={() => setTab("summary")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "summary"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          }`}
        >
          Summary
        </button>
      </div>

      {tab === "individual" ? (
        <div className="grid lg:grid-cols-[240px_1fr] gap-4">
          {/* Athlete list */}
          <div className="card p-2 space-y-1 lg:max-h-[600px] lg:overflow-y-auto">
            {responses.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === r.id
                    ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium"
                    : "text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                <div>{r.athleteName}</div>
                <div className="text-[10px] text-muted">
                  {new Date(r.completedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>

          {/* Selected response */}
          {selected ? (
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--foreground)]">
                  {selected.athleteName}
                </h3>
                <span className="text-xs text-muted">
                  {new Date(selected.completedAt).toLocaleString()}
                </span>
              </div>

              {selected.answers.map((a, i) => {
                const q = questions.find((q) => q.id === a.questionId);
                const isYesFlagged =
                  isPARQ &&
                  q?.type === "yes_no" &&
                  String(a.answer).toLowerCase() === "yes";

                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      isYesFlagged
                        ? "bg-red-500/10 border border-red-500/20"
                        : "bg-surface-50 dark:bg-surface-800/50"
                    }`}
                  >
                    <div className="text-xs text-muted mb-1">
                      {i + 1}. {a.questionText}
                    </div>
                    <div className="text-sm text-[var(--foreground)] font-medium flex items-center gap-2">
                      {Array.isArray(a.answer)
                        ? (a.answer as string[]).join(", ")
                        : String(a.answer)}
                      {isYesFlagged && (
                        <Badge variant="danger">⚠ Flag</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-8 text-center text-muted text-sm">
              Select an athlete to view their response.
            </div>
          )}
        </div>
      ) : (
        /* Summary tab */
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-[var(--foreground)]">
            Aggregate Summary ({responses.length} response
            {responses.length !== 1 ? "s" : ""})
          </h3>

          {getSummary().map((item, i) => (
            <div
              key={item.question.id}
              className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1"
            >
              <div className="text-xs text-muted">
                {i + 1}. {item.question.text}
              </div>

              {item.type === "yes_no" && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--foreground)]">
                    Yes: {item.yesCount} ({item.yesPercent}%)
                  </span>
                  <span className="text-[var(--foreground)]">
                    No: {item.noCount} ({100 - item.yesPercent}%)
                  </span>
                  {isPARQ && item.yesPercent > 0 && (
                    <Badge variant="danger">
                      {item.yesCount} flagged
                    </Badge>
                  )}
                  {/* Bar */}
                  <div className="flex-1 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isPARQ ? "bg-red-500" : "bg-primary-500"
                      }`}
                      style={{ width: `${item.yesPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {item.type === "numeric" && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[var(--foreground)]">
                    Avg: <strong>{item.avg}</strong>
                  </span>
                  <span className="text-muted">
                    Min: {item.min} — Max: {item.max}
                  </span>
                  <span className="text-muted text-xs">
                    ({item.total} answered)
                  </span>
                </div>
              )}

              {item.type === "text" && (
                <div className="text-sm text-muted">
                  {item.total} response{item.total !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
