"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Save } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

const EVENTS = [
  { value: "", label: "All events / Generic" },
  { value: "SHOT_PUT", label: "Shot put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const CATEGORIES = [
  { value: "CE", label: "CE — Competitive Exercise" },
  { value: "SDE", label: "SDE — Special Developmental" },
  { value: "SPE", label: "SPE — Special Preparatory" },
  { value: "GPE", label: "GPE — General Preparatory" },
] as const;

const DIFFICULTIES = [
  { value: "", label: "Unspecified" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export function DrillTab() {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [event, setEvent] = useState("");
  const [category, setCategory] = useState("CE");
  const [difficulty, setDifficulty] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [implementKg, setImplementKg] = useState("");
  const [cues, setCues] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  function addCue() {
    setCues((c) => [...c, ""]);
  }

  function removeCue(idx: number) {
    setCues((c) => c.filter((_, i) => i !== idx));
  }

  function updateCue(idx: number, value: string) {
    setCues((c) => c.map((cue, i) => (i === idx ? value : cue)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Drill name is required");
      return;
    }
    setSubmitting(true);

    const parsedImplement =
      implementKg === ""
        ? null
        : Number.isFinite(parseFloat(implementKg))
          ? parseFloat(implementKg)
          : null;

    try {
      const res = await fetch("/api/coach/throws/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          videoUrl: videoUrl.trim() || null,
          event: event || null,
          category,
          implementKg: parsedImplement,
          difficulty: difficulty || null,
          cues: cues.map((c) => c.trim()).filter(Boolean),
          athleteTypes: [],
        }),
      });

      const data = await res.json();
      if (res.ok && data?.success) {
        toast.success("Drill saved to library");
        router.push("/coach/library?view=drills");
      } else {
        toast.error(data?.error || "Couldn’t save drill");
      }
    } catch (err) {
      logger.error("[builder/drill] submit error", { error: err });
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg sm:text-xl font-heading font-bold text-[var(--foreground)]">
          Drill Builder
        </h2>
        <p className="text-sm text-muted mt-0.5">
          Add a new drill to your library. Coach-owned, reusable across athletes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input w-full"
              placeholder="e.g. Standing throw — heavy implement"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="What's the focus of this drill, and when do you assign it?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Event
              </label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="input w-full"
              >
                {EVENTS.map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Category <span className="text-danger-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="input w-full"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="input w-full"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Implement weight (kg)
              </label>
              <input
                type="number"
                value={implementKg}
                onChange={(e) => setImplementKg(e.target.value)}
                step="0.01"
                min="0"
                className="input w-full"
                placeholder="e.g. 7.26"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Video URL
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input w-full"
              placeholder="https://… (YouTube, R2, S3, etc.)"
            />
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Coaching cues
            </label>
            <button
              type="button"
              onClick={addCue}
              className="inline-flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 font-medium"
            >
              <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
              Add cue
            </button>
          </div>

          {cues.length === 0 ? (
            <p className="text-xs text-muted">No cues yet — add one above.</p>
          ) : (
            <ul className="space-y-2">
              {cues.map((cue, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cue}
                    onChange={(e) => updateCue(idx, e.target.value)}
                    className="input flex-1"
                    placeholder={idx === 0 ? "e.g. Drive through the back leg" : "Another cue"}
                  />
                  {cues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCue(idx)}
                      className="p-1.5 text-muted hover:text-danger-500 transition-colors rounded-lg"
                      aria-label="Remove cue"
                    >
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 sticky bottom-4">
          <button
            type="button"
            onClick={() => router.push("/coach/library?view=drills")}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Save size={16} strokeWidth={1.75} aria-hidden="true" />
            {submitting ? "Saving…" : "Save to library"}
          </button>
        </div>
      </form>
    </div>
  );
}
