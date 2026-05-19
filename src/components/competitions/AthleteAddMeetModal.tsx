"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { Check } from "lucide-react";

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const PRIORITIES = [
  { value: "A", label: "A Meet" },
  { value: "B", label: "B Meet" },
  { value: "C", label: "C Meet" },
] as const;

type Props = {
  athleteId: string;
  athleteEvents: string[];
  onClose: () => void;
};

export function AthleteAddMeetModal({ athleteId, athleteEvents, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState("B");
  const [event, setEvent] = useState<string>(athleteEvents[0] ?? "SHOT_PUT");
  const [saving, setSaving] = useState(false);

  // Optional v2 context
  const [venueType, setVenueType] = useState("");
  const [format, setFormat] = useState("THREE_PLUS_THREE");
  const [implementWeightKg, setImplementWeightKg] = useState("");
  const [placeFinish, setPlaceFinish] = useState("");
  const [windMps, setWindMps] = useState("");
  const [weather, setWeather] = useState("");

  const pickable = EVENTS.filter((e) => athleteEvents.includes(e.value));
  const canSubmit = name.trim() && date && event;

  function parseOptionalFloat(v: string): number | null {
    if (v === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  function parseOptionalInt(v: string): number | null {
    if (v === "") return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/throws/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          athleteId,
          name: name.trim(),
          date,
          event,
          priority,
          venueType: venueType || null,
          format,
          implementWeightKg: parseOptionalFloat(implementWeightKg),
          placeFinish: parseOptionalInt(placeFinish),
          windMps: parseOptionalFloat(windMps),
          weather: weather.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Couldn’t create meet");
        return;
      }
      toast.success("Meet logged");
      onClose();
      // Navigate straight into the new meet so the athlete can enter throws.
      const newId = json.data?.id as string | undefined;
      if (newId) {
        router.push(`/athlete/competitions/${newId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Log a Meet"
      description="Add a competition you've already thrown at — enter your throws after."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Creating…" : "Create Meet"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Meet Name"
            placeholder="e.g. Mt. SAC Relays"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Priority */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Priority
          </label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  priority === p.value
                    ? "border-primary-500 bg-primary-500/10 text-primary-500"
                    : "border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Event
          </label>
          <div className="flex flex-wrap gap-2">
            {pickable.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setEvent(e.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  event === e.value
                    ? "border-primary-500 bg-primary-500/10 text-primary-500"
                    : "border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                {event === e.value && <Check size={14} strokeWidth={1.75} aria-hidden="true" />}
                {e.label}
              </button>
            ))}
          </div>
          {pickable.length === 0 && (
            <p className="mt-2 text-xs text-muted">
              No events on your profile yet — add one in settings first.
            </p>
          )}
        </div>

        {/* More details — optional v2 context */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-sm font-semibold text-muted uppercase tracking-wider hover:text-[var(--foreground)] transition-colors">
            <span
              className="inline-block transition-transform duration-200 group-open:rotate-90"
              aria-hidden="true"
            >
              ›
            </span>
            More details
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Venue type
                </label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="">— unspecified —</option>
                  <option value="INDOOR">Indoor</option>
                  <option value="OUTDOOR">Outdoor</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="THREE_PLUS_THREE">3+3 (qualify → final)</option>
                  <option value="FOUR_STRAIGHT">4 straight throws</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Implement weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="default for event"
                  value={implementWeightKg}
                  onChange={(e) => setImplementWeightKg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Place finish
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 1"
                  value={placeFinish}
                  onChange={(e) => setPlaceFinish(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Wind (m/s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. +1.2"
                  value={windMps}
                  onChange={(e) => setWindMps(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Weather / conditions
                </label>
                <input
                  type="text"
                  placeholder="70°F sunny, windy, rain…"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
            </div>
          </div>
        </details>
      </div>
    </Modal>
  );
}
