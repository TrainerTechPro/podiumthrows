"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { localToday } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { WIRE_LENGTH_OPTIONS, DEFAULT_DRILL_BY_EVENT, LBS_TO_KG } from "@/lib/throws";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put", icon: "🟠" },
  { value: "DISCUS", label: "Discus", icon: "🟣" },
  { value: "HAMMER", label: "Hammer", icon: "🔴" },
  { value: "JAVELIN", label: "Javelin", icon: "🟢" },
] as const;

const FOCUS_OPTIONS = [
  "Technique",
  "Power",
  "Speed",
  "Volume",
  "Competition Sim",
  "Recovery / Light",
];

const DRILLS_BY_EVENT: Record<string, string[]> = {
  SHOT_PUT: [
    "Full Throw",
    "Standing Throw",
    "Power Position",
    "Half Turn",
    "Glide (Full)",
    "Spin / Rotational",
    "South African Drill",
    "Reverse Stand",
    "Hip Pop Drill",
    "A-Drill",
    "Wrist Flips",
    "Other",
  ],
  DISCUS: [
    "Full Throw",
    "Standing Throw",
    "Power Position",
    "Half Turn",
    "South African Drill",
    "Wind-up Drill",
    "1.5 Turn",
    "Bowling Drill",
    "Non-Reverse",
    "Other",
  ],
  HAMMER: [
    "Winds Only",
    "Standing Throw",
    "1 Turn",
    "2 Turns",
    "3 Turns",
    "Full Throw (4 Turns)",
    "Full Throw (3 Turns)",
    "Power Throw",
    "Drill Throws",
    "Other",
  ],
  JAVELIN: [
    "Full Throw",
    "Standing Throw",
    "3-Step Approach",
    "5-Step Approach",
    "Full Approach",
    "Cross-over Drill",
    "Block Drill",
    "Run-through",
    "Into the Ground",
    "Other",
  ],
};

const FEELING_OPTIONS = [
  { value: "GREAT", label: "Great", color: "bg-green-500" },
  { value: "GOOD", label: "Good", color: "bg-green-400" },
  { value: "OK", label: "OK", color: "bg-yellow-400" },
  { value: "POOR", label: "Poor", color: "bg-orange-400" },
  { value: "BAD", label: "Bad", color: "bg-red-500" },
];

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface DrillEntry {
  id: string;
  drillType: string;
  implementWeight: string;
  implementUnit: "kg" | "lbs";
  wireLength: string;
  throwCount: string;
  bestMark: string;
  notes: string;
}

type Step = "event" | "readiness" | "drills" | "feedback" | "done";

/* ─── Scale Selector ───────────────────────────────────────────────────────── */

function ScaleSelector({
  value,
  onChange,
  max = 5,
  labels,
}: {
  value: number | null;
  onChange: (v: number) => void;
  max?: number;
  labels?: string[];
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
            value === n
              ? "bg-primary-500 text-white shadow-sm scale-110"
              : "bg-surface-100 dark:bg-surface-800 text-muted hover:bg-surface-200 dark:hover:bg-surface-700"
          }`}
          title={labels?.[n - 1]}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ─── Step Progress ────────────────────────────────────────────────────────── */

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const activeSteps = steps.filter((s): s is Step => s !== "done");
  const currentIdx = activeSteps.indexOf(current);

  return (
    <div className="flex items-center gap-1">
      {activeSteps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= currentIdx ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"
            }`}
          />
          {i < activeSteps.length - 1 && (
            <div
              className={`w-6 h-0.5 transition-colors ${
                i < currentIdx ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Wizard ──────────────────────────────────────────────────────────── */

interface WizardProps {
  /** API endpoint for saving (e.g. "/api/athlete/log-session" or "/api/coach/log-session") */
  apiEndpoint?: string;
  /** Where to navigate after "View Sessions" (e.g. "/athlete/sessions" or "/coach/my-training") */
  sessionsPath?: string;
  /** Only show these events (empty/undefined = show all) */
  allowedEvents?: string[];
  /** Limited mode: skip readiness & feedback steps (for coach logging on behalf of athlete) */
  limitedMode?: boolean;
  /** If set, load session data and use PUT to update instead of POST */
  editSessionId?: string;
}

export function LogSessionWizard({
  apiEndpoint = "/api/athlete/log-session",
  sessionsPath = "/athlete/sessions",
  allowedEvents,
  limitedMode = false,
  editSessionId,
}: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("event");
  const [isEditing, setIsEditing] = useState(!!editSessionId);
  const [editLoading, setEditLoading] = useState(!!editSessionId);

  // Dynamic step order based on limitedMode
  const steps: Step[] = limitedMode
    ? ["event", "drills", "done"]
    : ["event", "readiness", "drills", "feedback", "done"];

  // Filter events based on allowedEvents prop
  const filteredEvents = allowedEvents?.length
    ? EVENTS.filter((e) => allowedEvents.includes(e.value))
    : EVENTS;

  function handleClose() {
    if (step === "done" || confirm("Discard this session?")) {
      router.push(sessionsPath);
    }
  }

  // Step 1: Event + Focus
  const [event, setEvent] = useState(filteredEvents.length === 1 ? filteredEvents[0].value : "");
  const [focus, setFocus] = useState("");
  const [date, setDate] = useState(localToday());

  // Step 2: Readiness
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [sorenessLevel, setSorenessLevel] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);

  // Step 3: Drills
  const [drills, setDrills] = useState<DrillEntry[]>([]);
  const [distanceUnit, setDistanceUnit] = useState<"meters" | "feet">("meters");

  // Step 4: Post-session feedback
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [sessionFeeling, setSessionFeeling] = useState("");
  const [techniqueRating, setTechniqueRating] = useState<number | null>(null);
  const [mentalFocus, setMentalFocus] = useState<number | null>(null);
  const [bestPart, setBestPart] = useState("");
  const [improvementArea, setImprovementArea] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  const [pastDrills, setPastDrills] = useState<string[]>([]);
  const [showAllDrills, setShowAllDrills] = useState<Record<string, boolean>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Response data for done step
  const [responsePRs, setResponsePRs] = useState<
    { event: string; implement: string; distance: number; previousBest?: number }[]
  >([]);
  const [responseWarnings, setResponseWarnings] = useState<
    { type: string; message: string; severity: string }[]
  >([]);

  // Load existing session data when editing
  useEffect(() => {
    if (!editSessionId) return;
    setEditLoading(true);
    fetch(`${apiEndpoint}/${editSessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !data.data) return;
        const s = data.data;
        setEvent(s.event || "");
        setDate(s.date || localToday());
        setFocus(s.focus || "");
        setSessionNotes(s.notes || "");
        setSleepQuality(s.sleepQuality ?? null);
        setSorenessLevel(s.sorenessLevel ?? null);
        setEnergyLevel(s.energyLevel ?? null);
        setSessionRpe(s.sessionRpe ?? null);
        setSessionFeeling(s.sessionFeeling || "");
        setTechniqueRating(s.techniqueRating ?? null);
        setMentalFocus(s.mentalFocus ?? null);
        setBestPart(s.bestPart || "");
        setImprovementArea(s.improvementArea || "");
        if (s.drillLogs?.length) {
          setDrills(
            s.drillLogs.map((d: any) => ({
              id: d.id || crypto.randomUUID(),
              drillType: d.drillType || "",
              implementWeight: d.implementWeightOriginal != null ? String(d.implementWeightOriginal) : d.implementWeight != null ? String(d.implementWeight) : "",
              implementUnit: (d.implementWeightUnit === "lbs" ? "lbs" : "kg") as "kg" | "lbs",
              wireLength: d.wireLength || "FULL",
              throwCount: d.throwCount != null ? String(d.throwCount) : "",
              bestMark: d.bestMark != null ? String(d.bestMark) : "",
              notes: d.notes || "",
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editSessionId, apiEndpoint]);

  useEffect(() => {
    if (!event) { setPastDrills([]); return; }
    fetch(`/api/throws/past-drills?event=${event}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPastDrills(d.data); })
      .catch(() => {});
  }, [event]);

  function addDrill() {
    setDrills((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        drillType: DEFAULT_DRILL_BY_EVENT[event] || "",
        implementWeight: "",
        implementUnit: "kg" as const,
        wireLength: "FULL",
        throwCount: "",
        bestMark: "",
        notes: "",
      },
    ]);
  }

  function updateDrill(id: string, field: keyof DrillEntry, value: string) {
    setDrills((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  }

  function removeDrill(id: string) {
    setDrills((prev) => prev.filter((d) => d.id !== id));
  }

  function nextStep() {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function prevStep() {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    try {
      const url = isEditing ? `${apiEndpoint}/${editSessionId}` : apiEndpoint;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          event,
          date,
          focus: focus || undefined,
          notes: sessionNotes.trim() || undefined,
          ...(limitedMode
            ? {}
            : {
                sleepQuality,
                sorenessLevel,
                energyLevel,
                sessionRpe,
                sessionFeeling: sessionFeeling || undefined,
                techniqueRating,
                mentalFocus,
                bestPart: bestPart.trim() || undefined,
                improvementArea: improvementArea.trim() || undefined,
              }),
          drills: drills
            .filter((d) => d.drillType)
            .map((d) => {
              const raw = d.bestMark ? parseFloat(d.bestMark) : undefined;
              const best = raw && distanceUnit === "feet" ? raw * 0.3048 : raw;
              const implWeight = d.implementWeight
                ? (d.implementUnit === "lbs" ? parseFloat(d.implementWeight) * LBS_TO_KG : parseFloat(d.implementWeight))
                : undefined;
              return {
                drillType: d.drillType,
                implementWeight: implWeight,
                implementWeightUnit: d.implementUnit,
                implementWeightOriginal: d.implementWeight ? parseFloat(d.implementWeight) : undefined,
                wireLength: event === "HAMMER" ? d.wireLength : undefined,
                throwCount: parseInt(d.throwCount, 10) || 0,
                bestMark: best,
                notes: d.notes.trim() || undefined,
              };
            }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save session");

      // Capture PR and warning data from response
      if (data.prs?.length) setResponsePRs(data.prs);
      if (data.warnings?.length) setResponseWarnings(data.warnings);

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Close button (shared across steps) ── */
  const closeButton = step !== "done" && (
    <button
      type="button"
      onClick={handleClose}
      className="absolute top-0 right-0 p-3 text-muted hover:text-[var(--foreground)] transition-colors"
      aria-label="Close"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );

  /* ── Loading state for edit mode ── */
  if (editLoading) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4 animate-spring-up">
        <div className="w-10 h-10 mx-auto border-3 border-surface-300 dark:border-surface-700 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-sm text-muted">Loading session...</p>
      </div>
    );
  }

  /* ── STEP: Event Selection ── */
  if (step === "event") {
    return (
      <div className="relative max-w-lg mx-auto space-y-6 animate-spring-up">
        {closeButton}
        <div className="text-center space-y-2">
          <StepIndicator current={step} steps={steps} />
          <h2 className="font-heading font-bold text-xl text-[var(--foreground)]">
            {isEditing ? "Edit session" : "What are you throwing today?"}
          </h2>
        </div>

        {/* Event buttons */}
        <div className="grid grid-cols-2 gap-3">
          {filteredEvents.map((ev) => (
            <button
              key={ev.value}
              type="button"
              onClick={() => setEvent(ev.value)}
              className={`card p-4 sm:p-5 text-center transition-all ${
                event === ev.value
                  ? "ring-2 ring-primary-500 bg-primary-500/5"
                  : "hover:bg-surface-50 dark:hover:bg-surface-900"
              }`}
            >
              <span className="text-2xl block mb-1">{ev.icon}</span>
              <span className="font-heading font-semibold text-sm text-[var(--foreground)]">
                {ev.label}
              </span>
            </button>
          ))}
        </div>

        {/* Focus */}
        <div>
          <label className="label">Focus of the day (optional)</label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFocus(focus === f ? "" : f)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  focus === f
                    ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                    : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="session-date" className="label">Date</label>
          <input
            id="session-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>

        <button
          type="button"
          onClick={nextStep}
          disabled={!event}
          className="btn-primary w-full"
        >
          Next
        </button>
      </div>
    );
  }

  /* ── STEP: Readiness Check ── */
  if (step === "readiness") {
    return (
      <div className="relative max-w-lg mx-auto space-y-6 animate-spring-up">
        {closeButton}
        <div className="text-center space-y-2">
          <StepIndicator current={step} steps={steps} />
          <h2 className="font-heading font-bold text-xl text-[var(--foreground)]">
            Quick readiness check
          </h2>
          <p className="text-sm text-muted">How are you feeling before this session?</p>
        </div>

        <div className="card p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Sleep Quality</label>
              <span className="text-[10px] text-muted uppercase tracking-wider">1 = poor, 5 = great</span>
            </div>
            <ScaleSelector value={sleepQuality} onChange={setSleepQuality} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Soreness</label>
              <span className="text-[10px] text-muted uppercase tracking-wider">1 = none, 5 = severe</span>
            </div>
            <ScaleSelector value={sorenessLevel} onChange={setSorenessLevel} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Energy Level</label>
              <span className="text-[10px] text-muted uppercase tracking-wider">1 = low, 5 = high</span>
            </div>
            <ScaleSelector value={energyLevel} onChange={setEnergyLevel} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={prevStep} className="btn-secondary flex-1">
            Back
          </button>
          <button type="button" onClick={nextStep} className="btn-primary flex-1">
            Next
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: Drill Logging ── */
  if (step === "drills") {
    const eventDrills = DRILLS_BY_EVENT[event] || [];

    return (
      <div className="relative max-w-2xl mx-auto space-y-5 animate-spring-up">
        {closeButton}
        <div className="text-center space-y-2">
          <StepIndicator current={step} steps={steps} />
          <h2 className="font-heading font-bold text-xl text-[var(--foreground)]">
            Log your drills
          </h2>
          <p className="text-sm text-muted">Add each drill variation you did today</p>
        </div>

        {/* Drill entries */}
        <div className="space-y-3">
          {drills.map((drill, idx) => (
            <div key={drill.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Drill {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeDrill(drill.id)}
                  className="text-xs text-muted hover:text-danger-500 transition-colors"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Drill type */}
                <div className="col-span-2">
                  <label className="label">Drill</label>
                  {pastDrills.length > 0 && !showAllDrills[drill.id] ? (
                    <div className="flex flex-wrap gap-1.5">
                      {pastDrills.map((dt) => (
                        <button
                          key={dt}
                          type="button"
                          onClick={() => updateDrill(drill.id, "drillType", dt)}
                          className={`px-3 py-2 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-semibold rounded-lg transition-colors ${
                            drill.drillType === dt
                              ? "bg-primary-500 text-white"
                              : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                          }`}
                        >
                          {dt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowAllDrills((prev) => ({ ...prev, [drill.id]: true }))}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-dashed border-surface-300 dark:border-surface-700 text-muted hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-400 transition-colors"
                      >
                        + New Drill
                      </button>
                    </div>
                  ) : (
                    <select
                      value={drill.drillType}
                      onChange={(e) => updateDrill(drill.id, "drillType", e.target.value)}
                      className="input"
                    >
                      <option value="">Select drill...</option>
                      {eventDrills.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Reps / throw count */}
                <div>
                  <label className="label">Reps</label>
                  <input
                    type="number"
                    min="0"
                    value={drill.throwCount}
                    onChange={(e) => updateDrill(drill.id, "throwCount", e.target.value)}
                    className="input"
                    placeholder="10"
                  />
                </div>

                {/* Implement weight */}
                <div>
                  <label className="label">Weight</label>
                  <div className="flex items-center gap-2 sm:gap-1">
                    <input
                      type="text"
                      value={drill.implementWeight}
                      onChange={(e) => updateDrill(drill.id, "implementWeight", e.target.value)}
                      className="input flex-1"
                      placeholder="7.26"
                    />
                    <button
                      type="button"
                      onClick={() => updateDrill(drill.id, "implementUnit", drill.implementUnit === "kg" ? "lbs" : "kg")}
                      className="shrink-0 px-2 py-1.5 text-xs sm:px-1.5 sm:py-1 sm:text-[10px] font-bold border border-[var(--card-border)] rounded text-muted hover:border-primary-400 hover:text-primary-500 transition-colors"
                    >
                      {drill.implementUnit}
                    </button>
                  </div>
                </div>
              </div>

              {/* Wire length (hammer only) */}
              {event === "HAMMER" && (
                <div>
                  <label className="label">Wire</label>
                  <div className="flex gap-1.5">
                    {WIRE_LENGTH_OPTIONS.map((wl) => (
                      <button
                        key={wl.value}
                        type="button"
                        onClick={() => updateDrill(drill.id, "wireLength", wl.value)}
                        className={`px-3 py-2 text-xs sm:px-2 sm:py-1 sm:text-[10px] font-bold rounded-lg transition-colors ${
                          drill.wireLength === wl.value
                            ? "bg-purple-600 text-white"
                            : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                        }`}
                      >
                        {wl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Best distance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Best Distance (optional)</label>
                    <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
                      {(["meters", "feet"] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => setDistanceUnit(unit)}
                          className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                            distanceUnit === unit
                              ? "bg-primary-500 text-white"
                              : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
                          }`}
                        >
                          {unit === "meters" ? "m" : "ft"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={drill.bestMark}
                    onChange={(e) => updateDrill(drill.id, "bestMark", e.target.value)}
                    className="input"
                    placeholder={distanceUnit === "meters" ? "18.50" : "60.70"}
                  />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <input
                    type="text"
                    value={drill.notes}
                    onChange={(e) => updateDrill(drill.id, "notes", e.target.value)}
                    className="input"
                    placeholder="Timing felt off..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add drill button */}
        <button
          type="button"
          onClick={addDrill}
          className="w-full py-3 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-700 text-sm font-semibold text-muted hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          + Add Drill
        </button>

        {error && (
          <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={prevStep} className="btn-secondary flex-1">
            Back
          </button>
          <button
            type="button"
            onClick={limitedMode ? handleSubmit : nextStep}
            disabled={drills.length === 0 || !drills.some((d) => d.drillType) || submitting}
            className="btn-primary flex-1"
          >
            {limitedMode ? (submitting ? "Saving..." : isEditing ? "Update Session" : "Save Session") : "Next"}
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: Post-Session Feedback ── */
  if (step === "feedback") {
    return (
      <div className="relative max-w-lg mx-auto space-y-6 animate-spring-up">
        {closeButton}
        <div className="text-center space-y-2">
          <StepIndicator current={step} steps={steps} />
          <h2 className="font-heading font-bold text-xl text-[var(--foreground)]">
            Session review
          </h2>
          <p className="text-sm text-muted">How did the session go?</p>
        </div>

        <div className="card p-5 space-y-5">
          {/* RPE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Session RPE</label>
              <span className="text-[10px] text-muted uppercase tracking-wider">1 = easy, 10 = max</span>
            </div>
            <ScaleSelector value={sessionRpe} onChange={setSessionRpe} max={10} />
          </div>

          {/* Feeling */}
          <div>
            <label className="label">How did it feel?</label>
            <div className="flex flex-wrap gap-2">
              {FEELING_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSessionFeeling(sessionFeeling === f.value ? "" : f.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    sessionFeeling === f.value
                      ? `${f.color} text-white shadow-sm`
                      : "bg-surface-100 dark:bg-surface-800 text-muted hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Technique + Mental */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Technique</label>
                <span className="text-[10px] text-muted">1-5</span>
              </div>
              <ScaleSelector value={techniqueRating} onChange={setTechniqueRating} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Mental Focus</label>
                <span className="text-[10px] text-muted">1-5</span>
              </div>
              <ScaleSelector value={mentalFocus} onChange={setMentalFocus} />
            </div>
          </div>

          {/* Text feedback */}
          <div>
            <label className="label">What went well?</label>
            <input
              type="text"
              value={bestPart}
              onChange={(e) => setBestPart(e.target.value)}
              className="input"
              placeholder="e.g., Block timing was consistent"
            />
          </div>

          <div>
            <label className="label">What needs improvement?</label>
            <input
              type="text"
              value={improvementArea}
              onChange={(e) => setImprovementArea(e.target.value)}
              className="input"
              placeholder="e.g., Left leg strike position"
            />
          </div>

          <div>
            <label className="label">Session notes (optional)</label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="input min-h-[60px] resize-y"
              placeholder="Any other thoughts about this session..."
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={prevStep} className="btn-secondary flex-1">
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? "Saving..." : isEditing ? "Update Session" : "Save Session"}
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: Done ── */
  if (step === "done") {
    const totalThrows = drills.reduce(
      (sum, d) => sum + (parseInt(d.throwCount, 10) || 0),
      0
    );
    const bestDist = drills
      .map((d) => parseFloat(d.bestMark))
      .filter((n) => !isNaN(n) && n > 0);
    const sessionBest = bestDist.length > 0 ? Math.max(...bestDist) : null;
    const eventName = EVENTS.find((e) => e.value === event)?.label ?? event;

    return (
      <div className="max-w-lg mx-auto text-center space-y-6 animate-spring-up">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="font-heading font-bold text-xl text-[var(--foreground)]">
            {isEditing ? "Session Updated!" : "Session logged"}
          </h2>
          <p className="text-sm text-muted mt-1">
            {eventName} &middot; {drills.filter((d) => d.drillType).length} drill{drills.filter((d) => d.drillType).length !== 1 ? "s" : ""} &middot; {totalThrows} throws
            {sessionBest && <> &middot; best: {sessionBest.toFixed(2)}m</>}
          </p>
        </div>

        {/* PR celebrations */}
        {responsePRs.length > 0 && (
          <div className="space-y-2 w-full max-w-sm">
            {responsePRs.map((pr, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500 shrink-0">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    New PR! {pr.distance.toFixed(2)}m
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {pr.implement}
                    {pr.previousBest != null && <> (was {pr.previousBest.toFixed(2)}m)</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bondarchuk warnings */}
        {responseWarnings.length > 0 && (
          <div className="space-y-2 w-full max-w-sm">
            {responseWarnings.map((w, i) => (
              <div
                key={i}
                className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-xs text-amber-800 dark:text-amber-300 text-left">{w.message}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.push(sessionsPath)}
            className="btn-secondary"
          >
            View Sessions
          </button>
          <button
            type="button"
            onClick={() => {
              // Reset everything
              setIsEditing(false);
              setStep("event");
              setEvent("");
              setFocus("");
              setDate(localToday());
              setSleepQuality(null);
              setSorenessLevel(null);
              setEnergyLevel(null);
              setDrills([]);
              setSessionRpe(null);
              setSessionFeeling("");
              setTechniqueRating(null);
              setMentalFocus(null);
              setBestPart("");
              setImprovementArea("");
              setSessionNotes("");
              setResponsePRs([]);
              setResponseWarnings([]);
            }}
            className="btn-primary"
          >
            Log Another
          </button>
        </div>
      </div>
    );
  }

  return null;
}
