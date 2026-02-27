"use client";

import { useState } from "react";
import { FORM_TEMPLATES } from "@/lib/forms/templates";
import type { FormTemplateDefinition } from "@/lib/forms/types";
import { Badge } from "@/components/ui/Badge";

const DISPLAY_MODE_LABELS: Record<string, string> = {
  ALL_AT_ONCE: "All at Once",
  ONE_PER_PAGE: "One per Page",
  SECTIONED: "Sectioned",
};

interface TemplatePickerModalProps {
  onSelect: (template: FormTemplateDefinition) => void;
  onBlank: () => void;
  onClose: () => void;
}

export function TemplatePickerModal({
  onSelect,
  onBlank,
  onClose,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = FORM_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--background)] rounded-2xl border border-[var(--card-border)] shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--card-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
              Choose a Template
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted hover:text-[var(--foreground)] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            autoFocus
          />
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Blank option */}
          <button
            type="button"
            onClick={onBlank}
            className="w-full mb-4 p-4 rounded-xl border-2 border-dashed border-[var(--card-border)] hover:border-primary-500/30 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center text-muted group-hover:text-primary-500">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  Start from Scratch
                </div>
                <div className="text-xs text-muted">
                  Build a custom questionnaire from a blank canvas.
                </div>
              </div>
            </div>
          </button>

          {/* Templates */}
          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => onSelect(template)}
                className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:ring-2 hover:ring-primary-500/30 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary-500"
                    >
                      <path d={template.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {template.name}
                    </div>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="neutral" className="text-[10px]">
                        {template.blocks.length} blocks
                      </Badge>
                      <Badge variant="neutral" className="text-[10px]">
                        {DISPLAY_MODE_LABELS[template.displayMode]}
                      </Badge>
                      {template.scoringEnabled && (
                        <Badge variant="info" className="text-[10px]">
                          Scoring
                        </Badge>
                      )}
                      {template.suggestedRecurrence && (
                        <Badge variant="success" className="text-[10px]">
                          Recurring
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && search && (
            <p className="text-sm text-muted text-center py-8">
              No templates match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
