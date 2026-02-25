"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "scale_1_5"
  | "scale_1_10"
  | "single_choice"
  | "multiple_choice"
  | "yes_no";

type Question = {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
};

type QuestionnaireData = {
  title: string;
  description: string;
  type: string;
  questions: Question[];
};

type Props = {
  initialData?: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    questions: Question[];
  };
};

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TYPE_OPTIONS = [
  { value: "ONBOARDING", label: "PAR-Q / Onboarding" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "CHECK_IN", label: "Readiness Check-in" },
  { value: "CUSTOM", label: "Custom" },
];

const QUESTION_TYPE_OPTIONS = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "scale_1_5", label: "Scale (1-5)" },
  { value: "scale_1_10", label: "Scale (1-10)" },
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "yes_no", label: "Yes / No" },
];

const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_QUESTION: () => Question = () => ({
  id: generateId(),
  text: "",
  type: "short_text",
  options: undefined,
  required: false,
});

const EMPTY_FORM: QuestionnaireData = {
  title: "",
  description: "",
  type: "CUSTOM",
  questions: [EMPTY_QUESTION()],
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function QuestionnaireBuilder({ initialData }: Props) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [form, setForm] = useState<QuestionnaireData>(
    initialData
      ? {
          title: initialData.title,
          description: initialData.description ?? "",
          type: initialData.type,
          questions:
            initialData.questions.length > 0
              ? initialData.questions
              : [EMPTY_QUESTION()],
        }
      : { ...EMPTY_FORM, questions: [EMPTY_QUESTION()] }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  /* ── Question helpers ─────────────────────────────────────────────────── */

  function addQuestion() {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, EMPTY_QUESTION()],
    }));
  }

  function updateQuestion(index: number, updates: Partial<Question>) {
    setForm((prev) => {
      const questions = [...prev.questions];
      questions[index] = { ...questions[index], ...updates };

      // If switching to a choice type, ensure options exist
      if (
        (updates.type === "single_choice" || updates.type === "multiple_choice") &&
        (!questions[index].options || questions[index].options!.length === 0)
      ) {
        questions[index].options = ["", ""];
      }
      // If switching away from choice type, remove options
      if (
        updates.type &&
        updates.type !== "single_choice" &&
        updates.type !== "multiple_choice"
      ) {
        questions[index].options = undefined;
      }

      return { ...prev, questions };
    });
  }

  function removeQuestion(index: number) {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    setForm((prev) => {
      const questions = [...prev.questions];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= questions.length) return prev;
      [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
      return { ...prev, questions };
    });
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setForm((prev) => {
      const questions = [...prev.questions];
      const options = [...(questions[qIndex].options || [])];
      options[oIndex] = value;
      questions[qIndex] = { ...questions[qIndex], options };
      return { ...prev, questions };
    });
  }

  function addOption(qIndex: number) {
    setForm((prev) => {
      const questions = [...prev.questions];
      questions[qIndex] = {
        ...questions[qIndex],
        options: [...(questions[qIndex].options || []), ""],
      };
      return { ...prev, questions };
    });
  }

  function removeOption(qIndex: number, oIndex: number) {
    setForm((prev) => {
      const questions = [...prev.questions];
      questions[qIndex] = {
        ...questions[qIndex],
        options: (questions[qIndex].options || []).filter((_, i) => i !== oIndex),
      };
      return { ...prev, questions };
    });
  }

  /* ── Save ──────────────────────────────────────────────────────────────── */

  const handleSave = useCallback(
    async (status: "draft" | "published") => {
      setError(null);
      setSaving(true);

      try {
        const payload = {
          title: form.title,
          description: form.description || null,
          type: form.type,
          questions: form.questions.map((q) => ({
            id: q.id,
            text: q.text.trim(),
            type: q.type,
            ...(q.options ? { options: q.options.filter((o) => o.trim()) } : {}),
            required: q.required,
          })),
          status,
        };

        const url = isEdit
          ? `/api/coach/questionnaires/${initialData!.id}`
          : "/api/coach/questionnaires";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to save questionnaire");
          return;
        }

        router.push("/coach/questionnaires");
        router.refresh();
      } catch {
        setError("Something went wrong");
      } finally {
        setSaving(false);
      }
    },
    [form, isEdit, initialData, router]
  );

  /* ── Preview mode ──────────────────────────────────────────────────────── */

  if (preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
            Preview
          </h2>
          <Button variant="ghost" onClick={() => setPreview(false)}>
            ← Back to Editor
          </Button>
        </div>

        <div className="card p-6 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)]">
              {form.title || "Untitled Questionnaire"}
            </h3>
            {form.description && (
              <p className="text-sm text-muted mt-1">{form.description}</p>
            )}
          </div>

          {form.questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                {i + 1}. {q.text || "Untitled question"}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {q.type === "short_text" && (
                <input
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-muted"
                  placeholder="Short answer…"
                />
              )}
              {q.type === "long_text" && (
                <textarea
                  disabled
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-muted resize-none"
                  placeholder="Long answer…"
                />
              )}
              {q.type === "number" && (
                <input
                  disabled
                  type="number"
                  className="w-full max-w-[200px] px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-muted"
                  placeholder="0"
                />
              )}
              {(q.type === "scale_1_5" || q.type === "scale_1_10") && (
                <div className="flex gap-2">
                  {Array.from(
                    { length: q.type === "scale_1_5" ? 5 : 10 },
                    (_, i) => i + 1
                  ).map((n) => (
                    <span
                      key={n}
                      className="w-9 h-9 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-center text-sm text-muted"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {q.type === "single_choice" &&
                q.options?.map((opt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-[var(--card-border)]" />
                    <span className="text-sm text-muted">{opt || `Option ${j + 1}`}</span>
                  </div>
                ))}
              {q.type === "multiple_choice" &&
                q.options?.map((opt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded border-2 border-[var(--card-border)]" />
                    <span className="text-sm text-muted">{opt || `Option ${j + 1}`}</span>
                  </div>
                ))}
              {q.type === "yes_no" && (
                <div className="flex gap-2">
                  <span className="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-muted">
                    Yes
                  </span>
                  <span className="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-muted">
                    No
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Editor ────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Title + Description */}
      <div className="card p-4 space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="e.g., PAR-Q Health Screening"
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y min-h-[60px]"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Brief description of this questionnaire…"
            rows={2}
          />
        </div>
        <Select
          label="Type"
          required
          options={TYPE_OPTIONS}
          value={form.type}
          onChange={(v) => setForm((p) => ({ ...p, type: v ?? "CUSTOM" }))}
        />
      </div>

      {/* Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Questions ({form.questions.length})
          </h2>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Preview →
          </button>
        </div>

        {form.questions.map((q, qIdx) => (
          <div key={q.id} className="card p-4 space-y-3">
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-muted mt-2.5 shrink-0 w-5 text-center">
                {qIdx + 1}
              </span>
              <div className="flex-1 space-y-3">
                <Input
                  value={q.text}
                  onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                  placeholder="Question text…"
                />

                <div className="grid sm:grid-cols-2 gap-3">
                  <Select
                    options={QUESTION_TYPE_OPTIONS}
                    value={q.type}
                    onChange={(v) =>
                      updateQuestion(qIdx, { type: (v ?? "short_text") as QuestionType })
                    }
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          updateQuestion(qIdx, { required: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
                      />
                      Required
                    </label>
                    <Badge variant="neutral">
                      {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                    </Badge>
                  </div>
                </div>

                {/* Options for choice types */}
                {(q.type === "single_choice" || q.type === "multiple_choice") && (
                  <div className="space-y-2 pl-1">
                    <label className="text-xs font-medium text-muted">
                      Options
                    </label>
                    {(q.options || []).map((opt, oIdx) => (
                      <div key={oIdx} className="flex gap-2 items-center">
                        <span className="w-3 h-3 rounded-full border border-[var(--card-border)] shrink-0" />
                        <Input
                          value={opt}
                          onChange={(e) =>
                            updateOption(qIdx, oIdx, e.target.value)
                          }
                          placeholder={`Option ${oIdx + 1}`}
                        />
                        {(q.options?.length ?? 0) > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIdx, oIdx)}
                            className="px-2 text-muted hover:text-red-500 transition-colors shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(qIdx)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      + Add option
                    </button>
                  </div>
                )}
              </div>

              {/* Reorder & delete buttons */}
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveQuestion(qIdx, "up")}
                  disabled={qIdx === 0}
                  className="p-1 text-muted hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                  title="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(qIdx, "down")}
                  disabled={qIdx === form.questions.length - 1}
                  className="p-1 text-muted hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                  title="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {form.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="p-1 text-muted hover:text-red-500 transition-colors"
                    title="Delete question"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[var(--card-border)] text-sm text-muted hover:text-[var(--foreground)] hover:border-primary-500/30 transition-colors"
        >
          + Add Question
        </button>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/coach/questionnaires")}
          disabled={saving}
        >
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => handleSave("draft")}
            loading={saving}
          >
            Save as Draft
          </Button>
          <Button onClick={() => handleSave("published")} loading={saving}>
            {isEdit && initialData?.status === "published"
              ? "Save Changes"
              : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
