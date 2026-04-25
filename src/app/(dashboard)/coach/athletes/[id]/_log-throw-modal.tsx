"use client";

import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { formatPreviousBestDate } from "@/lib/utils";

interface LogThrowModalProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  gender: string | null;
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const IMPLEMENT_PRESETS: Record<string, { label: string; kg: number }[]> = {
  SHOT_PUT: [
    { label: "3kg", kg: 3 },
    { label: "4kg", kg: 4 },
    { label: "5kg", kg: 5 },
    { label: "6kg", kg: 6 },
    { label: "7.26kg", kg: 7.26 },
    { label: "8kg", kg: 8 },
    { label: "9kg", kg: 9 },
  ],
  DISCUS: [
    { label: "1kg", kg: 1 },
    { label: "1.5kg", kg: 1.5 },
    { label: "1.75kg", kg: 1.75 },
    { label: "2kg", kg: 2 },
    { label: "2.5kg", kg: 2.5 },
  ],
  HAMMER: [
    { label: "3kg", kg: 3 },
    { label: "4kg", kg: 4 },
    { label: "5kg", kg: 5 },
    { label: "6kg", kg: 6 },
    { label: "7.26kg", kg: 7.26 },
    { label: "8kg", kg: 8 },
    { label: "9kg", kg: 9 },
    { label: "10kg", kg: 10 },
  ],
  JAVELIN: [
    { label: "400g", kg: 0.4 },
    { label: "500g", kg: 0.5 },
    { label: "600g", kg: 0.6 },
    { label: "700g", kg: 0.7 },
    { label: "800g", kg: 0.8 },
  ],
};

export function LogThrowModal({
  athleteId,
  athleteName,
  events,
  gender,
  onClose,
}: LogThrowModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState(events.length === 1 ? events[0] : "");
  const [implementWeight, setImplementWeight] = useState<number | null>(null);
  const [distance, setDistance] = useState("");
  const [isCompetition, setIsCompetition] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [prDetected, setPrDetected] = useState(false);

  const presets = event ? (IMPLEMENT_PRESETS[event] ?? []) : [];

  // For men's hammer, show dual label for 7.26kg
  function getPresetLabel(preset: { label: string; kg: number }) {
    if (event === "HAMMER" && preset.kg === 7.26 && gender === "MALE") {
      return "7.26kg / 16lb";
    }
    if (event === "HAMMER" && preset.kg === 4 && gender === "FEMALE") {
      return "4kg";
    }
    return preset.label;
  }

  async function handleSave(addAnother: boolean) {
    if (!event || implementWeight === null) {
      toastError("Select an event and implement weight");
      return;
    }

    setSaving(true);
    setPrDetected(false);

    try {
      // If video, upload first
      let videoUrl: string | null = null;
      if (videoFile) {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("event", event);
        formData.append("implementWeight", String(implementWeight));
        if (distance) formData.append("distance", distance);

        const uploadRes = await fetch(`/api/coach/athletes/${athleteId}/videos`, {
          method: "POST",
          headers: csrfHeaders(),
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          toastError(uploadData.error || "Video upload failed");
          setSaving(false);
          return;
        }
        videoUrl = uploadData.data.url;
      }

      const body = {
        event,
        implementWeight,
        implementWeightUnit: "kg" as const,
        distance:
          distance === ""
            ? null
            : (() => {
                const n = parseFloat(distance);
                return Number.isFinite(n) ? n : null;
              })(),
        isCompetition,
        notes: notes || null,
        videoUrl,
      };

      const res = await fetch(`/api/coach/athletes/${athleteId}/throws`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Failed to log throw");
        setSaving(false);
        return;
      }

      if (data.data.isPersonalBest) {
        setPrDetected(true);
        // Coach side stays in the editorial register — no overlay, no haptic.
        // Per CLAUDE.md §Dual Product Identity: "Quiet toast only" for coach.
        const previousBest: number | null = data.data.previousBest ?? null;
        const previousBestDate: string | null = data.data.previousBestDate ?? null;
        const distNum = parseFloat(distance);
        const delta =
          previousBest != null && Number.isFinite(distNum)
            ? ` · +${(distNum - previousBest).toFixed(2)}m over previous best${
                previousBestDate ? ` from ${formatPreviousBestDate(previousBestDate)}` : ""
              }`
            : previousBest == null
              ? " · First-ever PR for this implement"
              : "";
        toastSuccess(`New PR for ${athleteName}`, `${distance}m${delta}`);
      } else {
        toastSuccess(`Throw logged for ${athleteName}`);
      }

      if (addAnother) {
        // Clear distance, video, notes — keep event and implement
        setDistance("");
        setNotes("");
        setShowNotes(false);
        setVideoFile(null);
        setPrDetected(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        onClose();
      }
    } catch {
      toastError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Log Throw"
      size="lg"
      footer={
        <>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !event || implementWeight === null}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium
              bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]
              hover:bg-surface-200 dark:hover:bg-surface-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            Save & Add Another
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !event || implementWeight === null}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black
              hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Event selector */}
        {events.length > 1 && (
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Event
            </label>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setEvent(e);
                    setImplementWeight(null);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                    ${
                      event === e
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700"
                    }`}
                  type="button"
                >
                  {EVENT_LABELS[e] || e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Implement weight presets */}
        {event && (
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Implement Weight
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.kg}
                  onClick={() => setImplementWeight(p.kg)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${
                      implementWeight === p.kg
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700"
                    }`}
                  type="button"
                >
                  {getPresetLabel(p)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Distance */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Distance (m)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="e.g. 55.42"
            className="w-full px-4 py-3 rounded-xl text-lg font-mono
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-[var(--foreground)] placeholder:text-[var(--muted)]
              focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Video upload */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Video (optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-[var(--muted)]
              file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0
              file:text-sm file:font-medium file:bg-surface-100 file:dark:bg-surface-800
              file:text-[var(--foreground)] file:cursor-pointer"
          />
          {videoFile && (
            <p className="text-xs text-[var(--muted)] mt-1">
              {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)}MB)
            </p>
          )}
        </div>

        {/* Competition toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
            ${
              isCompetition
                ? "bg-primary-500 border-primary-500"
                : "border-[var(--card-border)] bg-transparent"
            }`}
          >
            {isCompetition && (
              <Check size={14} className="text-black" strokeWidth={2.5} aria-hidden="true" />
            )}
          </div>
          <input
            type="checkbox"
            checked={isCompetition}
            onChange={(e) => setIsCompetition(e.target.checked)}
            className="sr-only"
          />
          <span className="text-sm text-[var(--foreground)]">Competition throw</span>
        </label>

        {/* Notes (collapsible) */}
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          type="button"
        >
          {showNotes ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
          Notes / Cues
        </button>
        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cues that worked, observations..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-[var(--foreground)] placeholder:text-[var(--muted)]
              focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        )}

        {/* PR indicator */}
        {prDetected && (
          <div className="px-4 py-2 rounded-xl bg-primary-500/10 border border-primary-500/30 text-primary-500 text-sm font-medium text-center">
            New Personal Best!
          </div>
        )}
      </div>
    </Modal>
  );
}
