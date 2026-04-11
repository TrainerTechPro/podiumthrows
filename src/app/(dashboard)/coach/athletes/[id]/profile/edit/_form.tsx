"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
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

function parseNum(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function CoachProfileEditForm({ athleteId, isClaimed, initial }: FormProps) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  // Core info
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [gender, setGender] = useState(initial.gender);
  const [events, setEvents] = useState<string[]>(initial.events);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [heightCm, setHeightCm] = useState(initial.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(initial.weightKg?.toString() ?? "");
  const [classStanding, setClassStanding] = useState(initial.classStanding);
  const [gradYear, setGradYear] = useState(initial.gradYear?.toString() ?? "");
  const [turnDirection, setTurnDirection] = useState(initial.turnDirection);

  // Competition PRs (per event, in meters)
  const [prs, setPrs] = useState<Record<string, string>>(
    Object.fromEntries(
      EVENTS.map((e) => [e, initial.competitionPRs[e]?.toString() ?? ""])
    )
  );

  // Strength Numbers (per lift, in kg)
  const [strength, setStrength] = useState<Record<string, string>>(
    Object.fromEntries(
      LIFT_KEYS.map((l) => [l.key, initial.strengthNumbers[l.key]?.toString() ?? ""])
    )
  );

  const [saving, setSaving] = useState(false);

  function toggleEvent(e: string) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
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
        strengthNumbers: Object.fromEntries(
          LIFT_KEYS.map((l) => [l.key, parseNum(strength[l.key])])
        ),
        competitionPRs: Object.fromEntries(
          EVENTS.map((e) => [e, parseNum(prs[e])])
        ),
      };

      // Core info — only sent if unclaimed
      if (!isClaimed) {
        body.firstName = firstName.trim();
        body.lastName = lastName.trim();
        body.gender = gender;
        body.events = events;
        body.dateOfBirth = dateOfBirth
          ? new Date(dateOfBirth).toISOString()
          : null;
        body.heightCm = parseNum(heightCm);
        body.weightKg = parseNum(weightKg);
        body.classStanding = classStanding || null;
        body.gradYear = gradYear ? parseInt(gradYear, 10) : null;
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
  const labelCls =
    "block text-xs font-semibold uppercase tracking-wider text-muted mb-1";

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
          <div>
            <label className={labelCls}>Gender</label>
            <div className="flex gap-2">
              {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  disabled={isClaimed}
                  onClick={() => setGender(g)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      gender === g
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                >
                  {g.charAt(0) + g.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input
              type="date"
              className={inputCls}
              value={dateOfBirth}
              disabled={isClaimed}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Height (cm)</label>
            <input
              type="number"
              className={inputCls}
              value={heightCm}
              disabled={isClaimed}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Weight (kg)</label>
            <input
              type="number"
              className={inputCls}
              value={weightKg}
              disabled={isClaimed}
              onChange={(e) => setWeightKg(e.target.value)}
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
            <input
              type="number"
              className={inputCls}
              value={gradYear}
              disabled={isClaimed}
              onChange={(e) => setGradYear(e.target.value)}
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
        <p className="text-xs text-[var(--muted)]">
          Best distances for each event (meters)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVENTS.map((e) => (
            <div key={e}>
              <label className={labelCls}>{EVENT_LABELS[e]}</label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={prs[e]}
                onChange={(ev) =>
                  setPrs((p) => ({ ...p, [e]: ev.target.value }))
                }
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
              <input
                type="number"
                step="0.5"
                className={inputCls}
                value={strength[key]}
                onChange={(ev) =>
                  setStrength((p) => ({ ...p, [key]: ev.target.value }))
                }
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
