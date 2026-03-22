"use client";

import { Plus, Trash2, Trophy } from "lucide-react";
import type { WizardFormState, CompetitionEntry } from "../_wizard";

interface StepCompetitionsProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}

const PRIORITIES = [
  { value: "A" as const, label: "A — Major", description: "Peak performance target" },
  { value: "B" as const, label: "B — Important", description: "Competitive but not primary" },
  { value: "C" as const, label: "C — Tune-up", description: "Training competition" },
];

export function StepCompetitions({ form, update, errors: _errors }: StepCompetitionsProps) {
  function addCompetition() {
    const next: CompetitionEntry[] = [
      ...form.competitions,
      { date: "", name: "", priority: "B" },
    ];
    update("competitions", next);
  }

  function updateCompetition(index: number, field: keyof CompetitionEntry, value: string) {
    const next = form.competitions.map((comp, i) =>
      i === index ? { ...comp, [field]: value } : comp
    );
    update("competitions", next);
  }

  function removeCompetition(index: number) {
    const next = form.competitions.filter((_, i) => i !== index);
    update("competitions", next);
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Competition Schedule
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Add upcoming competitions so the program can taper and peak accordingly.
          This step is optional.
        </p>
      </div>

      {form.competitions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[var(--muted-bg)] flex items-center justify-center mx-auto mb-3">
            <Trophy size={24} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
          </div>
          <p className="text-sm text-surface-700 dark:text-surface-300 mb-4">
            No competitions added yet
          </p>
          <button
            type="button"
            onClick={addCompetition}
            className="btn-primary px-4 py-2 text-sm"
          >
            <Plus size={16} strokeWidth={1.75} className="inline mr-1" aria-hidden="true" />
            Add Competition
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {form.competitions.map((comp, i) => (
              <div
                key={i}
                className="card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Competition {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCompetition(i)}
                    className="p-1 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label={`Remove competition ${i + 1}`}
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Date */}
                  <div>
                    <label className="label" htmlFor={`comp-date-${i}`}>
                      Date
                    </label>
                    <input
                      id={`comp-date-${i}`}
                      type="date"
                      className="input w-full"
                      value={comp.date}
                      onChange={(e) => updateCompetition(i, "date", e.target.value)}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="label" htmlFor={`comp-name-${i}`}>
                      Meet Name
                    </label>
                    <input
                      id={`comp-name-${i}`}
                      type="text"
                      className="input w-full"
                      placeholder="e.g. Conference Championships"
                      value={comp.name}
                      onChange={(e) => updateCompetition(i, "name", e.target.value)}
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="label" htmlFor={`comp-priority-${i}`}>
                    Priority
                  </label>
                  <select
                    id={`comp-priority-${i}`}
                    className="input w-full"
                    value={comp.priority}
                    onChange={(e) => updateCompetition(i, "priority", e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label} — {p.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Add another */}
          <button
            type="button"
            onClick={addCompetition}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--card-border)] text-sm font-medium text-surface-700 dark:text-surface-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <Plus size={16} strokeWidth={1.75} className="inline mr-1" aria-hidden="true" />
            Add Another Competition
          </button>
        </>
      )}

      <p className="text-caption text-surface-700 dark:text-surface-300">
        A-priority competitions trigger full taper protocols. B-priority gets partial taper.
        C-priority meets are training opportunities with no deload.
      </p>
    </div>
  );
}
