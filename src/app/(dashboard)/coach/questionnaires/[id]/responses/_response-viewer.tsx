"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BLOCK_REGISTRY } from "@/lib/forms/block-registry";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type Answer = {
  questionId?: string;
  questionText?: string;
  blockId?: string;
  blockLabel?: string;
  blockType?: string;
  answer: unknown;
  score?: number;
};

type Scores = {
  blockScores: Array<{
    blockId: string;
    blockLabel: string;
    blockType: string;
    answer: unknown;
    score?: number;
  }>;
  compositeScore: number | null;
  maxPossibleScore: number;
};

type Response = {
  id: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  answers: Answer[];
  scores: Scores | null;
  durationSeconds: number | null;
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
  scoringEnabled: boolean;
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "—";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return JSON.stringify(answer);
  return String(answer);
}

function scoreColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.4) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBgColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "bg-emerald-500";
  if (pct >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

/* ── Composite Score Badge ─────────────────────────────────────────────────── */

function CompositeScoreBadge({ scores }: { scores: Scores }) {
  if (scores.compositeScore === null) return null;
  const pct = scores.maxPossibleScore > 0
    ? (scores.compositeScore / scores.maxPossibleScore) * 100
    : 0;
  const variant: "success" | "warning" | "danger" =
    pct >= 70 ? "success" : pct >= 40 ? "warning" : "danger";

  return (
    <Badge variant={variant} className="text-xs">
      Score: {scores.compositeScore.toFixed(1)} / {scores.maxPossibleScore}
    </Badge>
  );
}

/* ── Individual Response Card ──────────────────────────────────────────────── */

function ResponseCard({
  response,
  questions,
  questionnaireType,
  scoringEnabled,
}: {
  response: Response;
  questions: Question[];
  questionnaireType: string;
  scoringEnabled: boolean;
}) {
  const isPARQ =
    questionnaireType === "ONBOARDING" || questionnaireType === "ASSESSMENT";

  // Determine if answers are block-based
  const isBlockBased = response.answers.some((a) => a.blockId);

  // Merge block scores into answers for display
  const scoreMap = new Map<string, number>();
  if (response.scores?.blockScores) {
    for (const bs of response.scores.blockScores) {
      if (bs.score !== undefined) {
        scoreMap.set(bs.blockId, bs.score);
      }
    }
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-[var(--foreground)]">
          {response.athleteName}
        </h3>
        <div className="flex items-center gap-2">
          {response.scores && <CompositeScoreBadge scores={response.scores} />}
          {response.durationSeconds && (
            <span className="text-xs text-muted">
              {formatDuration(response.durationSeconds)}
            </span>
          )}
          <span className="text-xs text-muted">
            {new Date(response.completedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Score bar */}
      {response.scores && response.scores.compositeScore !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Composite Score</span>
            <span>
              {response.scores.compositeScore.toFixed(1)} /{" "}
              {response.scores.maxPossibleScore}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreBgColor(
                response.scores.compositeScore,
                response.scores.maxPossibleScore
              )}`}
              style={{
                width: `${Math.min(
                  (response.scores.compositeScore /
                    response.scores.maxPossibleScore) *
                    100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Answers */}
      {isBlockBased
        ? response.answers.map((a, i) => {
            const blockScore = a.blockId ? scoreMap.get(a.blockId) : undefined;
            const meta = a.blockType
              ? BLOCK_REGISTRY[a.blockType as keyof typeof BLOCK_REGISTRY]
              : null;

            return (
              <div
                key={i}
                className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted flex items-center gap-1.5">
                    <span>
                      {i + 1}. {a.blockLabel || "Unknown"}
                    </span>
                    {meta && (
                      <span className="text-[10px] opacity-60">
                        ({meta.label})
                      </span>
                    )}
                  </div>
                  {scoringEnabled && blockScore !== undefined && (
                    <span
                      className={`text-xs font-medium ${scoreColor(
                        blockScore,
                        response.scores?.maxPossibleScore
                          ? response.scores.maxPossibleScore /
                            response.scores.blockScores.length
                          : 10
                      )}`}
                    >
                      {blockScore.toFixed(1)} pts
                    </span>
                  )}
                </div>
                <div className="text-sm text-[var(--foreground)] font-medium">
                  {formatAnswer(a.answer)}
                </div>
              </div>
            );
          })
        : response.answers.map((a, i) => {
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
                  {formatAnswer(a.answer)}
                  {isYesFlagged && <Badge variant="danger">Flag</Badge>}
                </div>
              </div>
            );
          })}
    </div>
  );
}

/* ── Summary Tab ───────────────────────────────────────────────────────────── */

function SummaryView({
  responses,
  questions,
  questionnaireType,
  scoringEnabled,
}: Props) {
  const isPARQ =
    questionnaireType === "ONBOARDING" || questionnaireType === "ASSESSMENT";
  const isBlockBased = responses.some((r) =>
    r.answers.some((a) => a.blockId)
  );

  // Composite score summary
  const scoredResponses = responses.filter(
    (r) => r.scores?.compositeScore != null
  );
  const avgComposite =
    scoredResponses.length > 0
      ? scoredResponses.reduce(
          (sum, r) => sum + (r.scores!.compositeScore ?? 0),
          0
        ) / scoredResponses.length
      : null;
  const maxPossible = scoredResponses[0]?.scores?.maxPossibleScore ?? 0;

  // Aggregate by block or question
  function getBlockSummary() {
    if (!isBlockBased) return null;

    // Collect all unique block IDs from answers
    const blockIds: Array<{ id: string; label: string; type: string }> = [];
    const seen = new Set<string>();
    for (const r of responses) {
      for (const a of r.answers) {
        if (a.blockId && !seen.has(a.blockId)) {
          seen.add(a.blockId);
          blockIds.push({
            id: a.blockId,
            label: a.blockLabel || "Unknown",
            type: a.blockType || "short_text",
          });
        }
      }
    }

    return blockIds.map((block) => {
      const answersForBlock = responses
        .map((r) => r.answers.find((a) => a.blockId === block.id))
        .filter(Boolean) as Answer[];

      // Numeric types
      const numericTypes = [
        "number",
        "scale_1_5",
        "scale_1_10",
        "rpe",
        "slider",
        "distance",
      ];
      if (numericTypes.includes(block.type)) {
        const values = answersForBlock
          .map((a) => Number(a.answer))
          .filter((v) => !isNaN(v));
        const avg =
          values.length > 0
            ? values.reduce((s, v) => s + v, 0) / values.length
            : 0;
        return {
          block,
          type: "numeric" as const,
          avg: Math.round(avg * 10) / 10,
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          total: values.length,
        };
      }

      if (block.type === "yes_no") {
        const yesCount = answersForBlock.filter(
          (a) => String(a.answer).toLowerCase() === "yes"
        ).length;
        return {
          block,
          type: "yes_no" as const,
          yesCount,
          noCount: answersForBlock.length - yesCount,
          total: answersForBlock.length,
          yesPercent:
            answersForBlock.length > 0
              ? Math.round((yesCount / answersForBlock.length) * 100)
              : 0,
        };
      }

      return {
        block,
        type: "text" as const,
        total: answersForBlock.length,
        responses: answersForBlock.map((a) => formatAnswer(a.answer)),
      };
    });
  }

  function getQuestionSummary() {
    return questions.map((q) => {
      const answersForQ = responses
        .map((r) => r.answers.find((a) => a.questionId === q.id))
        .filter(Boolean) as Answer[];

      if (q.type === "yes_no") {
        const yesCount = answersForQ.filter(
          (a) => String(a.answer).toLowerCase() === "yes"
        ).length;
        return {
          question: q,
          type: "yes_no" as const,
          yesCount,
          noCount: answersForQ.length - yesCount,
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

      return {
        question: q,
        type: "text" as const,
        total: answersForQ.length,
        responses: answersForQ.map((a) => formatAnswer(a.answer)),
      };
    });
  }

  const blockSummary = getBlockSummary();
  const questionSummary = isBlockBased ? null : getQuestionSummary();

  return (
    <div className="card p-4 space-y-4">
      <h3 className="font-semibold text-[var(--foreground)]">
        Aggregate Summary ({responses.length} response
        {responses.length !== 1 ? "s" : ""})
      </h3>

      {/* Composite score summary */}
      {scoringEnabled && avgComposite !== null && (
        <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Average Composite Score
            </span>
            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {avgComposite.toFixed(1)} / {maxPossible}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBgColor(avgComposite, maxPossible)}`}
              style={{
                width: `${Math.min((avgComposite / maxPossible) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Block-based summary */}
      {blockSummary?.map((item, i) => (
        <div
          key={item.block.id}
          className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1"
        >
          <div className="text-xs text-muted flex items-center gap-1.5">
            <span>
              {i + 1}. {item.block.label}
            </span>
            <span className="text-[10px] opacity-60">
              ({BLOCK_REGISTRY[item.block.type as keyof typeof BLOCK_REGISTRY]
                ?.label ?? item.block.type})
            </span>
          </div>

          {item.type === "yes_no" && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[var(--foreground)]">
                Yes: {item.yesCount} ({item.yesPercent}%)
              </span>
              <span className="text-[var(--foreground)]">
                No: {item.noCount} ({100 - item.yesPercent}%)
              </span>
              <div className="flex-1 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500"
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
              <span className="text-muted text-xs">({item.total} answered)</span>
            </div>
          )}

          {item.type === "text" && (
            <div className="text-sm text-muted">
              {item.total} response{item.total !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      ))}

      {/* Legacy question summary */}
      {questionSummary?.map((item, i) => (
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
                <Badge variant="danger">{item.yesCount} flagged</Badge>
              )}
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
              <span className="text-muted text-xs">({item.total} answered)</span>
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
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */

export function ResponseViewer({
  responses,
  questions,
  questionnaireType,
  scoringEnabled,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    responses[0]?.id ?? null
  );
  const [tab, setTab] = useState<"individual" | "summary">("individual");

  const selected = responses.find((r) => r.id === selectedId);

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
                <div className="flex items-center justify-between">
                  <span>{r.athleteName}</span>
                  {r.scores?.compositeScore != null && (
                    <span
                      className={`text-xs font-semibold ${scoreColor(
                        r.scores.compositeScore,
                        r.scores.maxPossibleScore
                      )}`}
                    >
                      {r.scores.compositeScore.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted">
                  {new Date(r.completedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>

          {/* Selected response */}
          {selected ? (
            <ResponseCard
              response={selected}
              questions={questions}
              questionnaireType={questionnaireType}
              scoringEnabled={scoringEnabled}
            />
          ) : (
            <div className="card p-8 text-center text-muted text-sm">
              Select an athlete to view their response.
            </div>
          )}
        </div>
      ) : (
        <SummaryView
          responses={responses}
          questions={questions}
          questionnaireType={questionnaireType}
          scoringEnabled={scoringEnabled}
        />
      )}
    </div>
  );
}
