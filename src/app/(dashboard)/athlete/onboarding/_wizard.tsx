"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, localToday } from "@/lib/utils";
import { Avatar, Button, ProgressBar } from "@/components";

/* ─── Constants ─────────────────────────────────────────────────────────── */

type WizardStep = "welcome" | "events" | "pbs" | "physical" | "done";

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put", icon: "🏋️" },
  { value: "DISCUS", label: "Discus", icon: "🥏" },
  { value: "HAMMER", label: "Hammer", icon: "🔨" },
  { value: "JAVELIN", label: "Javelin", icon: "🎯" },
] as const;

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Prefer not to say" },
] as const;

const STEP_LABELS = ["Events", "Competition PBs", "Physical Profile"];

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface OnboardingWizardProps {
  firstName: string;
  coachFirstName: string;
  coachLastName: string;
  coachAvatarUrl: string | null;
}

/* ─── Step Indicator ────────────────────────────────────────────────────── */

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
              i < current
                ? "bg-primary-500 text-white"
                : i === current
                ? "bg-primary-500 text-white ring-4 ring-primary-500/20"
                : "bg-surface-200 dark:bg-surface-700 text-muted"
            )}
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
            className={cn(
              "text-sm hidden sm:block",
              i === current ? "font-semibold text-[var(--foreground)]" : "text-muted"
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px flex-1 min-w-[24px] mx-1 transition-colors",
                i < current ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Wizard ────────────────────────────────────────────────────────────── */

export function OnboardingWizard({
  firstName,
  coachFirstName,
  coachLastName,
  coachAvatarUrl,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>("welcome");
  const [error, setError] = useState<string | null>(null);

  // Form state — Step 1: Events
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Form state — Step 2: Competition PBs
  const [pbs, setPbs] = useState<Record<string, string>>({});

  // Form state — Step 3: Physical Profile
  const [gender, setGender] = useState("MALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const coachFullName = `${coachFirstName} ${coachLastName}`;

  // Step index for the indicator (welcome & done not counted)
  const stepIndex =
    step === "events" ? 0 : step === "pbs" ? 1 : step === "physical" ? 2 : 0;

  /* ─── Event toggling ──────────────────────────────────────────────── */

  function toggleEvent(value: string) {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
    // Clear PB for deselected event
    setPbs((prev) => {
      const next = { ...prev };
      if (selectedEvents.includes(value)) {
        delete next[value];
      }
      return next;
    });
  }

  /* ─── PB update ───────────────────────────────────────────────────── */

  function updatePb(event: string, value: string) {
    setPbs((prev) => ({ ...prev, [event]: value }));
  }

  /* ─── Navigation ──────────────────────────────────────────────────── */

  function goToEvents() {
    setError(null);
    setStep("events");
  }

  function goToPbs() {
    if (selectedEvents.length === 0) {
      setError("Please select at least one event.");
      return;
    }
    setError(null);
    setStep("pbs");
  }

  function goToPhysical() {
    setError(null);
    setStep("physical");
  }

  /* ─── Submit ──────────────────────────────────────────────────────── */

  async function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        // Fetch current profile for firstName/lastName
        const profileRes = await fetch("/api/athlete/profile");
        let currentFirstName = firstName;
        let currentLastName = "";
        if (profileRes.ok) {
          const profile = await profileRes.json();
          currentFirstName = profile.firstName;
          currentLastName = profile.lastName;
        }

        // Build competition PBs array
        const competitionPBs = selectedEvents
          .filter((ev) => pbs[ev] && parseFloat(pbs[ev]) > 0)
          .map((ev) => ({
            event: ev,
            distance: parseFloat(pbs[ev]),
          }));

        const payload = {
          firstName: currentFirstName,
          lastName: currentLastName,
          events: selectedEvents,
          gender,
          dateOfBirth: dateOfBirth || null,
          heightCm: heightCm ? parseFloat(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          competitionPBs: competitionPBs.length > 0 ? competitionPBs : undefined,
          completeOnboarding: true,
        };

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
        }, 2000);
      } catch {
        setError("Failed to save profile. Please try again.");
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                            */
  /* ═══════════════════════════════════════════════════════════════════ */

  /* ─── Welcome Panel ───────────────────────────────────────────────── */

  if (step === "welcome") {
    return (
      <div className="card overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-amber-600 px-6 py-10 sm:px-8 sm:py-12 text-center">
          <div className="mx-auto mb-4">
            <Avatar
              name={coachFullName}
              src={coachAvatarUrl}
              size="xl"
              className="mx-auto ring-4 ring-white/20"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Welcome to Podium Throws
          </h1>
          <p className="text-white/80 mt-2 text-sm sm:text-base max-w-sm mx-auto">
            Coach {coachFirstName} {coachLastName} invited you to join their team.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-8 sm:px-8 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-[var(--foreground)] font-medium">
              Let&apos;s set up your athlete profile in 3 quick steps.
            </p>
            <p className="text-sm text-muted max-w-sm mx-auto">
              This helps your coach build a personalised training programme tailored to your events and abilities.
            </p>
          </div>

          {/* Steps preview */}
          <div className="flex flex-col gap-3 max-w-xs mx-auto text-left">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{i + 1}</span>
                </div>
                <span className="text-sm text-[var(--foreground)]">{label}</span>
              </div>
            ))}
          </div>

          <Button variant="primary" size="lg" onClick={goToEvents} className="min-w-[200px]">
            Get Started
          </Button>

          <p className="text-xs text-muted">Takes about 2 minutes</p>
        </div>
      </div>
    );
  }

  /* ─── Done State ──────────────────────────────────────────────────── */

  if (step === "done") {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center animate-in zoom-in duration-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              You&apos;re all set, {firstName}!
            </h2>
            <p className="text-sm text-muted">
              Taking you to your dashboard…
            </p>
          </div>
          <ProgressBar value={100} variant="primary" size="sm" animate className="max-w-[200px]" />
        </div>
      </div>
    );
  }

  /* ─── Steps (events / pbs / physical) ─────────────────────────────── */

  return (
    <div className="card p-6 sm:p-8">
      <StepIndicator current={stepIndex} steps={STEP_LABELS} />

      {/* ── Step 1: Events ──────────────────────────────────────────── */}
      {step === "events" && (
        <div>
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
                  className={cn(
                    "px-4 py-4 rounded-xl border-2 text-left transition-all",
                    active
                      ? "border-primary-500 bg-primary-500/8 shadow-sm"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-300 dark:hover:border-primary-700"
                  )}
                >
                  <span className="text-lg mb-1 block">{ev.icon}</span>
                  <p
                    className={cn(
                      "font-semibold text-sm",
                      active
                        ? "text-primary-700 dark:text-primary-300"
                        : "text-[var(--foreground)]"
                    )}
                  >
                    {ev.label}
                  </p>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("welcome")} className="flex-1">
              Back
            </Button>
            <Button variant="primary" onClick={goToPbs} className="flex-1">
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Competition PBs ─────────────────────────────────── */}
      {step === "pbs" && (
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] mb-1">
            Your competition personal bests
          </h2>
          <p className="text-sm text-muted mb-6">
            Enter your best competition marks so your coach has a baseline. Leave blank if you&apos;re not sure.
          </p>

          <div className="space-y-4 mb-6">
            {selectedEvents.map((eventValue) => {
              const event = EVENTS.find((e) => e.value === eventValue);
              if (!event) return null;
              return (
                <div key={eventValue}>
                  <label
                    htmlFor={`pb-${eventValue}`}
                    className="block text-sm font-medium text-[var(--foreground)] mb-1"
                  >
                    {event.icon} {event.label} PB
                    <span className="text-muted font-normal ml-1">(metres)</span>
                  </label>
                  <input
                    id={`pb-${eventValue}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="e.g. 14.52"
                    value={pbs[eventValue] ?? ""}
                    onChange={(e) => updatePb(eventValue, e.target.value)}
                    className="input w-full"
                  />
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={goToEvents} className="flex-1">
              Back
            </Button>
            <Button variant="primary" onClick={goToPhysical} className="flex-1">
              Continue
            </Button>
          </div>

          <button
            onClick={goToPhysical}
            className="w-full text-center text-xs text-muted hover:text-[var(--foreground)] transition-colors mt-3"
          >
            Skip — I&apos;ll add these later
          </button>
        </div>
      )}

      {/* ── Step 3: Physical Profile ────────────────────────────────── */}
      {step === "physical" && (
        <div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)] mb-1">
            Tell us about yourself
          </h2>
          <p className="text-sm text-muted mb-6">
            This helps your coach personalise your programme. Only gender is required.
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
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors",
                      gender === g.value
                        ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                        : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label
                htmlFor="dob"
                className="block text-sm font-medium text-[var(--foreground)] mb-1"
              >
                Date of birth{" "}
                <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={localToday()}
                className="input w-full"
              />
            </div>

            {/* Height / Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="height"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1"
                >
                  Height (cm){" "}
                  <span className="text-muted font-normal">(optional)</span>
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
                <label
                  htmlFor="weight"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1"
                >
                  Weight (kg){" "}
                  <span className="text-muted font-normal">(optional)</span>
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

          {error && (
            <p className="text-sm text-danger-600 dark:text-danger-400 mt-4">{error}</p>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setStep("pbs")}
              disabled={isPending}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isPending}
              className="flex-1"
            >
              {isPending ? "Saving…" : "Complete Setup"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
