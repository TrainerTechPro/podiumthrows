"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { DateInput } from "@/components/ui/DateInput";
import { NumberInput } from "@/components/ui/NumberInput";
import { Radio, RadioGroup } from "@/components/ui/Radio";
import { csrfHeaders } from "@/lib/csrf-client";

interface FormProps {
  athleteId: string;
  isClaimed: boolean;
  initial: {
    firstName: string;
    lastName: string;
    gender: string;
    events: string[];
    dateOfBirth: string;
    heightCm: number | null;
    weightKg: number | null;
    classStanding: string;
    gradYear: number | null;
    turnDirection: string;
    strengthNumbers: Record<string, number | null>;
    competitionPRs: Record<string, number | null>;
  };
}

const EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const LIFT_KEYS = [
  { key: "backSquat", label: "Back Squat" },
  { key: "frontSquat", label: "Front Squat" },
  { key: "powerClean", label: "Power Clean" },
  { key: "snatch", label: "Snatch" },
  { key: "benchPress", label: "Bench Press" },
] as const;

export function CoachProfileEditForm({ athleteId, isClaimed, initial }: FormProps) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  // Core info
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [gender, setGender] = useState(initial.gender);
  const [events, setEvents] = useState<string[]>(initial.events);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [heightCm, setHeightCm] = useState<number | null>(initial.heightCm);
  const [weightKg, setWeightKg] = useState<number | null>(initial.weightKg);
  const [classStanding, setClassStanding] = useState(initial.classStanding);
  const [gradYear, setGradYear] = useState<number | null>(initial.gradYear);
  const [turnDirection, setTurnDirection] = useState(initial.turnDirection);

  // Competition PRs (per event, in meters)
  const [prs, setPrs] = useState<Record<string, number | null>>(
    Object.fromEntries(EVENTS.map((e) => [e, initial.competitionPRs[e] ?? null]))
  );

  // Strength Numbers (per lift, in kg)
  const [strength, setStrength] = useState<Record<string, number | null>>(
    Object.fromEntries(LIFT_KEYS.map((l) => [l.key, initial.strengthNumbers[l.key] ?? null]))
  );

  const [saving, setSaving] = useState(false);

  function toggleEvent(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function handleSave() {
    if (!isClaimed && events.length === 0) {
      toastError("Athlete must have at least one event");
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        // Coaching fields always editable
        strengthNumbers: { ...strength },
        competitionPRs: { ...prs },
      };

      // Core info — only sent if unclaimed
      if (!isClaimed) {
        body.firstName = firstName.trim();
        body.lastName = lastName.trim();
        body.gender = gender;
        body.events = events;
        body.dateOfBirth = dateOfBirth ? new Date(dateOfBirth).toISOString() : null;
        body.heightCm = heightCm;
        body.weightKg = weightKg;
        body.classStanding = classStanding || null;
        body.gradYear = gradYear;
        body.turnDirection = turnDirection || null;
      }

      const res = await fetch(`/api/coach/athletes/${athleteId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Failed to save profile");
        return;
      }

      toastSuccess("Profile saved");
      router.push(`/coach/athletes/${athleteId}`);
      router.refresh();
    } catch {
      toastError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-muted mb-1";

  return (
    <div className="space-y-6">
      {/* Section: Core Info */}
      <section className="card p-5 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Core Info</h2>
          {isClaimed && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <Lock size={12} aria-hidden="true" />
              Athlete-managed
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input
              className={inputCls}
              value={firstName}
              disabled={isClaimed}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input
              className={inputCls}
              value={lastName}
              disabled={isClaimed}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <RadioGroup
            value={gender}
            onChange={setGender}
            disabled={isClaimed}
            label={<span className={labelCls.replace("block ", "")}>Gender</span>}
          >
            <div className="flex gap-2">
              {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                <Radio
                  key={g}
                  value={g}
                  hideVisual
                  className={`px-3 py-2 rounded-lg transition-colors flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      gender === g
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                  label={
                    <span className="block text-center w-full text-sm font-medium">
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </span>
                  }
                />
              ))}
            </div>
          </RadioGroup>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <DateInput
              value={dateOfBirth || null}
              onChange={(next) => setDateOfBirth(next ?? "")}
              disabled={isClaimed}
              inputClassName={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Height (cm)</label>
            <NumberInput
              inputClassName={inputCls}
              value={heightCm}
              disabled={isClaimed}
              onChange={setHeightCm}
              step={0.1}
              min={0}
            />
          </div>
          <div>
            <label className={labelCls}>Weight (kg)</label>
            <NumberInput
              inputClassName={inputCls}
              value={weightKg}
              disabled={isClaimed}
              onChange={setWeightKg}
              step={0.1}
              min={0}
            />
          </div>
          <div>
            <label className={labelCls}>Class Standing</label>
            <input
              className={inputCls}
              value={classStanding}
              disabled={isClaimed}
              placeholder="FR / SO / JR / SR / GRAD / PRO"
              onChange={(e) => setClassStanding(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Grad Year</label>
            <NumberInput
              inputClassName={inputCls}
              value={gradYear}
              disabled={isClaimed}
              onChange={setGradYear}
              step={1}
              min={1900}
              max={2100}
            />
          </div>
          <div>
            <label className={labelCls}>Turn Direction</label>
            <div className="flex gap-2">
              {(["LEFT", "RIGHT"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={isClaimed}
                  onClick={() => setTurnDirection(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      turnDirection === d
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Events</label>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((e) => (
              <button
                key={e}
                type="button"
                disabled={isClaimed}
                onClick={() => toggleEvent(e)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    events.includes(e)
                      ? "bg-primary-500 text-black"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                  }`}
              >
                {EVENT_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Competition PRs */}
      <section className="card p-5 space-y-4">
        <h2 className="font-heading text-lg font-semibold">Competition PRs</h2>
        <p className="text-xs text-[var(--muted)]">Best distances for each event (meters)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVENTS.map((e) => (
            <div key={e}>
              <label className={labelCls}>{EVENT_LABELS[e]}</label>
              <NumberInput
                inputClassName={inputCls}
                value={prs[e]}
                onChange={(next) => setPrs((p) => ({ ...p, [e]: next }))}
                step={0.01}
                min={0}
                placeholder="e.g. 18.42"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Section: Strength Numbers */}
      <section className="card p-5 space-y-4">
        <h2 className="font-heading text-lg font-semibold">Strength Numbers</h2>
        <p className="text-xs text-[var(--muted)]">1RM for each lift (kg)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LIFT_KEYS.map(({ key, label }) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <NumberInput
                inputClassName={inputCls}
                value={strength[key]}
                onChange={(next) => setStrength((p) => ({ ...p, [key]: next }))}
                step={0.5}
                min={0}
                placeholder="kg"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Save button */}
      <div className="sticky bottom-0 bg-[var(--background)] py-4 border-t border-[var(--card-border)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-3 rounded-xl text-sm font-semibold
            bg-primary-500 text-black hover:bg-primary-400
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
