"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Slider Field ───────────────────────────────────────────────────────── */

function SliderField({
  id,
  label,
  hint,
  value,
  onChange,
  lowLabel = "Low",
  highLabel = "High",
  colorize = true,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
  colorize?: boolean;
}) {
  const color = colorize
    ? value >= 8
      ? "text-emerald-600 dark:text-emerald-400"
      : value >= 5
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400"
    : "text-primary-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
          {label}
          {hint && <span className="text-muted font-normal ml-1 text-xs">({hint})</span>}
        </label>
        <span className={cn("text-sm font-bold tabular-nums", color)}>{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary-500"
      />
      <div className="flex justify-between text-[10px] text-muted mt-0.5">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/* ─── Form ───────────────────────────────────────────────────────────────── */

export function CheckInForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Form state
  const [sleepQuality, setSleepQuality] = useState(7);
  const [sleepHours, setSleepHours] = useState(8);
  const [soreness, setSoreness] = useState(7);
  const [sorenessArea, setSorenessArea] = useState<string | null>(null);
  const [stressLevel, setStressLevel] = useState(5);
  const [energyMood, setEnergyMood] = useState(7);
  const [hydration, setHydration] = useState<"POOR" | "ADEQUATE" | "GOOD">("ADEQUATE");
  const [injuryStatus, setInjuryStatus] = useState<"NONE" | "MONITORING" | "ACTIVE">("NONE");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            sleepQuality,
            sleepHours,
            soreness,
            sorenessArea,
            stressLevel,
            energyMood,
            hydration,
            injuryStatus,
            injuryNotes: injuryNotes.trim() || null,
            notes: notes.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Something went wrong.");
          return;
        }

        setDone(true);
        setTimeout(() => {
          router.push("/athlete/wellness");
          router.refresh();
        }, 1200);
      } catch {
        setError("Failed to submit check-in. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">Check-in recorded!</h3>
        <p className="text-sm text-muted">Taking you back to your wellness log…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleep */}
      <div className="card px-5 py-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Sleep</h3>
        <SliderField
          id="sleep-quality"
          label="Sleep Quality"
          hint="1 = terrible, 10 = excellent"
          value={sleepQuality}
          onChange={setSleepQuality}
          lowLabel="Terrible"
          highLabel="Excellent"
        />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="sleep-hours" className="text-sm font-medium text-[var(--foreground)]">
              Hours Slept
            </label>
            <span className="text-sm font-bold tabular-nums text-primary-500">{sleepHours}h</span>
          </div>
          <input
            id="sleep-hours"
            type="range"
            min={3}
            max={12}
            step={0.5}
            value={sleepHours}
            onChange={(e) => setSleepHours(parseFloat(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-[10px] text-muted mt-0.5">
            <span>3h</span>
            <span>12h</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="card px-5 py-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Body</h3>
        <SliderField
          id="soreness"
          label="Muscle Soreness"
          hint="1 = very sore, 10 = no soreness"
          value={soreness}
          onChange={setSoreness}
          lowLabel="Very sore"
          highLabel="None"
        />
        {soreness <= 5 && (
          <div>
            <p className="text-sm font-medium text-[var(--foreground)] mb-2">
              Where? <span className="text-muted font-normal">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "upper_body", label: "Upper Body" },
                { value: "lower_body", label: "Lower Body" },
                { value: "full_body",  label: "Full Body"  },
                { value: null,         label: "Not sure"   },
              ] as const).map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setSorenessArea(opt.value)}
                  className={cn(
                    "py-2 px-3 rounded-lg border text-sm font-medium transition-colors text-left",
                    sorenessArea === opt.value
                      ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hydration */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">Hydration</p>
          <div className="flex gap-2">
            {(["POOR", "ADEQUATE", "GOOD"] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHydration(h)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors capitalize",
                  hydration === h
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {h.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mind */}
      <div className="card px-5 py-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Mind</h3>
        <SliderField
          id="stress"
          label="Stress Level"
          hint="1 = very stressed, 10 = calm"
          value={stressLevel}
          onChange={setStressLevel}
          lowLabel="Very stressed"
          highLabel="Calm"
        />
        <SliderField
          id="energy"
          label="Energy & Mood"
          hint="1 = exhausted, 10 = energised"
          value={energyMood}
          onChange={setEnergyMood}
          lowLabel="Exhausted"
          highLabel="Energised"
        />
      </div>

      {/* Injury */}
      <div className="card px-5 py-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Injury Status</h3>
        <div className="flex gap-2">
          {([
            { value: "NONE",       label: "None",       color: "text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-500/8" },
            { value: "MONITORING", label: "Monitoring", color: "text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-500/8" },
            { value: "ACTIVE",     label: "Active",     color: "text-red-600 dark:text-red-400 border-red-500 bg-red-500/8" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInjuryStatus(opt.value)}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                injuryStatus === opt.value
                  ? opt.color
                  : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {injuryStatus !== "NONE" && (
          <div>
            <label htmlFor="injury-notes" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Injury Notes <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="injury-notes"
              rows={2}
              placeholder="Describe the injury or area…"
              value={injuryNotes}
              onChange={(e) => setInjuryNotes(e.target.value)}
              className="input w-full resize-none"
            />
          </div>
        )}
      </div>

      {/* General notes */}
      <div className="card px-5 py-5">
        <label htmlFor="notes" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Additional Notes <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Anything else your coach should know?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input w-full resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="btn btn-primary w-full"
      >
        {isPending ? "Submitting…" : "Submit Check-In"}
      </button>
    </div>
  );
}
