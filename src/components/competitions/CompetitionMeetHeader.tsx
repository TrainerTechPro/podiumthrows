"use client";
import { useState } from "react";
import { Check } from "lucide-react";

export type MeetHeaderValue = {
  id: string;
  name: string;
  date: string;
  event: string;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
  venueType: "INDOOR" | "OUTDOOR" | null;
  weather: string | null;
  windMps: number | null;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
};

type Props = {
  value: MeetHeaderValue;
  onChange: (patch: Partial<MeetHeaderValue>) => Promise<void>;
  canMakeFinals: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function CompetitionMeetHeader({ value, onChange, canMakeFinals }: Props) {
  const [dirty, setDirty] = useState<Partial<MeetHeaderValue>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const merged = { ...value, ...dirty };
  const hasDirty = Object.keys(dirty).length > 0;

  const handleField = <K extends keyof MeetHeaderValue>(key: K, v: MeetHeaderValue[K]) => {
    setDirty((d) => ({ ...d, [key]: v }));
  };

  // Save immediately, merging any pending text-field edits. Used for
  // decisive controls (select/checkbox/date) where there is no
  // "still typing" ambiguity, and for the explicit Save button.
  const commit = async (patch: Partial<MeetHeaderValue> = {}) => {
    const combined = { ...dirty, ...patch };
    if (Object.keys(combined).length === 0) return;
    setSaveState("saving");
    try {
      await onChange(combined);
      setDirty({});
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      // Keep dirty so user doesn't lose their edits; the onChange caller
      // surfaces the error toast.
      setSaveState("error");
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    // Don't save when focus moves between fields inside the same card.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (!hasDirty) return;
    void commit();
  };

  return (
    <div className="card space-y-3 p-4" onBlur={handleBlur}>
      <div className="flex items-center gap-3">
        <input
          value={merged.name}
          onChange={(e) => handleField("name", e.target.value)}
          className="flex-1 bg-transparent font-heading text-xl"
          aria-label="Meet name"
        />
        <input
          type="date"
          value={merged.date}
          onChange={(e) => void commit({ date: e.target.value })}
          className="rounded bg-surface-800 px-2 py-1 text-sm"
          aria-label="Meet date"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">Place</span>
          <input
            type="number"
            min={1}
            value={merged.placeFinish ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              handleField(
                "placeFinish",
                v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null
              );
            }}
            className="w-16 rounded bg-surface-800 px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Status</span>
          <select
            value={merged.meetStatus}
            onChange={(e) =>
              void commit({ meetStatus: e.target.value as MeetHeaderValue["meetStatus"] })
            }
            className="rounded bg-surface-800 px-2 py-1"
          >
            {(["COMPLETED", "DNS", "DNF", "DQ"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Venue</span>
          <select
            value={merged.venueType ?? ""}
            onChange={(e) =>
              void commit({
                venueType: (e.target.value || null) as MeetHeaderValue["venueType"],
              })
            }
            className="rounded bg-surface-800 px-2 py-1"
          >
            <option value="">—</option>
            <option value="INDOOR">Indoor</option>
            <option value="OUTDOOR">Outdoor</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Wind (m/s)</span>
          <input
            type="number"
            step="0.1"
            value={merged.windMps ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              handleField(
                "windMps",
                v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null
              );
            }}
            className="w-20 rounded bg-surface-800 px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 items-center gap-2">
          <span className="text-muted">Weather</span>
          <input
            value={merged.weather ?? ""}
            onChange={(e) => handleField("weather", e.target.value || null)}
            placeholder="e.g. 70°F sunny"
            className="flex-1 rounded bg-surface-800 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Format</span>
          <select
            value={merged.format}
            onChange={(e) => void commit({ format: e.target.value as MeetHeaderValue["format"] })}
            className="rounded bg-surface-800 px-2 py-1"
          >
            <option value="THREE_PLUS_THREE">3 + 3</option>
            <option value="FOUR_STRAIGHT">4 straight</option>
          </select>
        </label>
        {merged.format === "THREE_PLUS_THREE" && canMakeFinals && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={merged.madeFinals ?? false}
              onChange={(e) => void commit({ madeFinals: e.target.checked })}
            />
            <span>Made finals</span>
          </label>
        )}
      </div>

      {/* Save affordance. Stays out of the way when nothing is pending;
          appears the moment a text/number field is edited so coaches on
          mobile always have an explicit way to commit. */}
      {(hasDirty || saveState !== "idle") && (
        <div className="flex items-center justify-end gap-3 border-t border-[var(--card-border)] pt-3">
          {saveState === "saving" && <span className="text-xs text-muted">Saving…</span>}
          {saveState === "saved" && !hasDirty && (
            <span className="flex items-center gap-1 text-xs text-success-500">
              <Check size={12} strokeWidth={1.75} aria-hidden="true" />
              Saved
            </span>
          )}
          {saveState === "error" && hasDirty && (
            <span className="text-xs text-danger-500">Couldn&apos;t save — try again</span>
          )}
          {hasDirty && (
            <button
              type="button"
              onClick={() => void commit()}
              disabled={saveState === "saving"}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Save changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
