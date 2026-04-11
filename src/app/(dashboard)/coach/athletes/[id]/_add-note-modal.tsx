"use client";

import { useState } from "react";
import { X, Lock, Globe } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

interface AddNoteModalProps {
  athleteId: string;
  athleteName: string;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "MENTAL", label: "Mental" },
  { value: "INJURY", label: "Injury" },
] as const;

export function AddNoteModal({ athleteId, athleteName, onClose }: AddNoteModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) {
      toastError("Note content is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/coach/athletes/${athleteId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ content: content.trim(), category, isPrivate }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Failed to save note");
        return;
      }

      toastSuccess(`Note added for ${athleteName}`);
      onClose();
    } catch {
      toastError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full md:max-w-lg bg-surface-50 dark:bg-surface-900
        rounded-t-2xl md:rounded-2xl border border-[var(--card-border)]
        max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-heading text-lg font-semibold">Add Note</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]" type="button">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Notes about ${athleteName}...`}
            rows={5}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-[var(--foreground)] placeholder:text-[var(--muted)]
              focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />

          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${category === c.value
                      ? "bg-primary-500 text-black"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                  type="button"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-sm transition-colors hover:bg-surface-200 dark:hover:bg-surface-700"
            type="button"
          >
            {isPrivate ? (
              <>
                <Lock size={16} strokeWidth={1.75} className="text-[var(--muted)]" aria-hidden="true" />
                <span className="text-[var(--foreground)]">Private — coach only</span>
              </>
            ) : (
              <>
                <Globe size={16} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
                <span className="text-[var(--foreground)]">Shared with athlete</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 border-t border-[var(--card-border)]">
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
