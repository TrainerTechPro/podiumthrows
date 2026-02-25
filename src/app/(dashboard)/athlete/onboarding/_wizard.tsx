"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Step = "events" | "physical" | "done";

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Prefer not to say" },
];

/* ─── Step Indicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={[
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
              i < current
                ? "bg-primary-500 text-white"
                : i === current
                ? "bg-primary-500 text-white ring-4 ring-primary-500/20"
                : "bg-surface-200 dark:bg-surface-700 text-muted",
            ].join(" ")}
          >
            {i < current ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span
            className={[
              "text-sm hidden sm:block",
              i === current ? "font-semibold text-[var(--foreground)]" : "text-muted",
            ].join(" ")}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={[
                "h-px flex-1 min-w-[24px] mx-1 transition-colors",
                i < current ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Wizard ─────────────────────────────────────────────────────────────── */

export function OnboardingWizard({
  firstName,
}: {
  firstName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("events");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [gender, setGender] = useState("MALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const steps = ["Your Events", "Physical Profile"];
  const stepIndex = step === "events" ? 0 : step === "physical" ? 1 : 2;

  function toggleEvent(value: string) {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  function handleEventsNext() {
    if (selectedEvents.length === 0) {
      setError("Please select at least one event.");
      return;
    }
    setError(null);
    setStep("physical");
  }

  async function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          firstName,
          lastName: "", // preserved from existing record
          events: selectedEvents,
          gender,
          dateOfBirth: dateOfBirth || null,
          heightCm: heightCm ? parseFloat(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
        };

        // First get current profile so we have the right firstName/lastName
        const profileRes = await fetch("/api/athlete/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          payload.firstName = profile.firstName;
          payload.lastName = profile.lastName;
        }

        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Something went wrong.");
          return;
        }

        setStep("done");
        setTimeout(() => {
          router.push("/athlete/dashboard");
          router.refresh();
        }, 1500);
      } catch {
        setError("Failed to save profile. Please try again.");
      }
    });
  }

  /* ─── Done state ─────────────────────────────────────────────────────── */
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
          You&apos;re all set, {firstName}!
        </h2>
        <p className="text-sm text-muted">Taking you to your dashboard…</p>
      </div>
    );
  }

  /* ─── Step: Events ───────────────────────────────────────────────────── */
  if (step === "events") {
    return (
      <div>
        <StepIndicator current={stepIndex} steps={steps} />
        <h2 className="text-xl font-bold font-heading text-[var(--foreground)] mb-1">
          Which events do you compete in?
        </h2>
        <p className="text-sm text-muted mb-6">Select all that apply.</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {EVENTS.map((ev) => {
            const active = selectedEvents.includes(ev.value);
            return (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={[
                  "px-4 py-4 rounded-xl border-2 text-left transition-all",
                  active
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-300 dark:hover:border-primary-700",
                ].join(" ")}
              >
                <p className={["font-semibold text-sm", active ? "" : "text-[var(--foreground)]"].join(" ")}>
                  {ev.label}
                </p>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

        <button
          onClick={handleEventsNext}
          className="btn btn-primary w-full"
        >
          Continue
        </button>
      </div>
    );
  }

  /* ─── Step: Physical Profile ─────────────────────────────────────────── */
  return (
    <div>
      <StepIndicator current={stepIndex} steps={steps} />
      <h2 className="text-xl font-bold font-heading text-[var(--foreground)] mb-1">
        Tell us about yourself
      </h2>
      <p className="text-sm text-muted mb-6">
        This helps your coach personalise your programme. All fields are optional.
      </p>

      <div className="space-y-4">
        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Gender
          </label>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                className={[
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                  gender === g.value
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Date of birth <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="input w-full"
          />
        </div>

        {/* Height / Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Height (cm) <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              id="height"
              type="number"
              min={100}
              max={250}
              step={0.1}
              placeholder="e.g. 185"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Weight (kg) <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              id="weight"
              type="number"
              min={30}
              max={200}
              step={0.1}
              placeholder="e.g. 110"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-4">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={() => setStep("events")}
          className="btn btn-secondary flex-1"
          disabled={isPending}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="btn btn-primary flex-1"
        >
          {isPending ? "Saving…" : "Complete Setup"}
        </button>
      </div>
    </div>
  );
}
