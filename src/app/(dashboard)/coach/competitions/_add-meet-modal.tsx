"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DateInput";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthletePickerItem } from "@/lib/data/coach";
import { Check } from "lucide-react";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const PRIORITIES = [
  { value: "A", label: "A Meet", description: "Championship / peak meet" },
  { value: "B", label: "B Meet", description: "Standard competition" },
  { value: "C", label: "C Meet", description: "Unscored / practice meet" },
] as const;

/* ─── Component ─────────────────────────────────────────────────────────── */

export function AddMeetModal({
  athletes,
  onClose,
  onCreated,
}: {
  athletes: AthletePickerItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { success, error: showError } = useToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState("B");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // v2 optional fields
  const [venueType, setVenueType] = useState("");
  const [format, setFormat] = useState("THREE_PLUS_THREE");
  const [implementWeightKg, setImplementWeightKg] = useState("");
  const [placeFinish, setPlaceFinish] = useState("");
  const [windMps, setWindMps] = useState("");
  const [weather, setWeather] = useState("");

  // Filter athletes who have at least one selected event
  const eligibleAthletes = athletes.filter((a) => a.events.some((e) => selectedEvents.has(e)));

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
    // Clear athlete selections when events change
    setSelectedAthletes(new Set());
  }

  function toggleAthlete(id: string) {
    setSelectedAthletes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllAthletes() {
    setSelectedAthletes(new Set(eligibleAthletes.map((a) => a.id)));
  }

  async function handleSubmit() {
    if (!name.trim() || !date || selectedEvents.size === 0 || selectedAthletes.size === 0) return;

    setSaving(true);
    try {
      // Build entries: each selected athlete × each of their events that match selected events
      const entries: { athleteId: string; event: string }[] = [];
      for (const athleteId of selectedAthletes) {
        const athlete = athletes.find((a) => a.id === athleteId);
        if (!athlete) continue;
        for (const event of athlete.events) {
          if (selectedEvents.has(event)) {
            entries.push({ athleteId, event });
          }
        }
      }

      const res = await fetch("/api/coach/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          date,
          priority,
          entries,
          venueType: venueType || null,
          format,
          implementWeightKg:
            implementWeightKg === "" || implementWeightKg == null
              ? null
              : (() => {
                  const n = parseFloat(implementWeightKg);
                  return Number.isFinite(n) ? n : null;
                })(),
          placeFinish:
            placeFinish === "" || placeFinish == null
              ? null
              : (() => {
                  const n = parseInt(placeFinish, 10);
                  return Number.isFinite(n) ? n : null;
                })(),
          windMps:
            windMps === "" || windMps == null
              ? null
              : (() => {
                  const n = parseFloat(windMps);
                  return Number.isFinite(n) ? n : null;
                })(),
          weather: weather.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn’t create meet");
      }

      success("Meet Created", `${entries.length} entries for ${name.trim()}`);
      onCreated();
    } catch (err) {
      showError("Couldn’t add meet", err instanceof Error ? err.message : "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = name.trim() && date && selectedEvents.size > 0 && selectedAthletes.size > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Meet"
      description="Create a competition and select which athletes are competing."
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
        {/* Meet Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Meet Name"
            placeholder="e.g. SEC Outdoor Championships"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <DateInput label="Date" value={date || null} onChange={(next) => setDate(next ?? "")} />
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

        {/* Events */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Events
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => toggleEvent(e.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  selectedEvents.has(e.value)
                    ? "border-primary-500 bg-primary-500/10 text-primary-500"
                    : "border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                {selectedEvents.has(e.value) && (
                  <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                )}
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Athletes */}
        {selectedEvents.size > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-muted uppercase tracking-wider">
                Athletes ({eligibleAthletes.length} eligible)
              </label>
              {eligibleAthletes.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllAthletes}
                  className="text-xs text-primary-500 hover:underline"
                >
                  Select All
                </button>
              )}
            </div>

            {eligibleAthletes.length === 0 ? (
              <p className="text-sm text-muted py-4">
                No athletes on your roster have the selected event(s).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                {eligibleAthletes.map((a) => {
                  const checked = selectedAthletes.has(a.id);
                  const athleteEvents = a.events.filter((e) => selectedEvents.has(e));
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAthlete(a.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors border ${
                        checked
                          ? "border-primary-500 bg-primary-500/10"
                          : "border-[var(--card-border)] hover:bg-surface-100 dark:hover:bg-surface-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? "border-primary-500 bg-primary-500"
                            : "border-surface-300 dark:border-surface-600"
                        }`}
                      >
                        {checked && (
                          <Check
                            size={12}
                            strokeWidth={3}
                            className="text-white"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {athleteEvents
                            .map((e) =>
                              e
                                .replace(/_/g, " ")
                                .toLowerCase()
                                .replace(/\b\w/g, (c) => c.toUpperCase())
                            )
                            .join(", ")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* More details — v2 optional fields */}
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
            {/* Venue type + Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
                  Venue type
                </label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
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
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
                >
                  <option value="THREE_PLUS_THREE">3+3 (qualify → final)</option>
                  <option value="FOUR_STRAIGHT">4 straight throws</option>
                </select>
              </div>
            </div>

            {/* Implement weight + Place finish */}
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
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
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
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Wind + Weather */}
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
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm font-mono placeholder:text-muted placeholder:font-body focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
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
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--surface-overlay)] text-[var(--foreground)] text-sm placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
                />
              </div>
            </div>
          </div>
        </details>
      </div>
    </Modal>
  );
}
