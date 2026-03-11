"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, localToday } from "@/lib/utils";
import type { AthleteProfileFull } from "@/lib/data/athlete";

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export function AthleteSettingsForm({ profile }: { profile: AthleteProfileFull }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(profile.events);
  const [gender, setGender] = useState(profile.gender);
  const [dateOfBirth, setDateOfBirth] = useState(
    profile.dateOfBirth ? profile.dateOfBirth.split("T")[0] : ""
  );
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? "");

  function toggleEvent(value: string) {
    setSelectedEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            events: selectedEvents,
            gender,
            dateOfBirth: dateOfBirth || null,
            heightCm: heightCm ? parseFloat(heightCm) : null,
            weightKg: weightKg ? parseFloat(weightKg) : null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to save.");
          return;
        }

        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } catch {
        setError("An error occurred. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Personal Info */}
      <div className="card px-5 py-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Personal Info
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-2">Gender</p>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
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

        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Date of Birth
          </label>
          <input
            id="dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={localToday()}
            className="input w-full sm:w-52"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Height (cm)
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
              Weight (kg)
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

      {/* Events */}
      <div className="card px-5 py-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Events</h3>
        <p className="text-sm text-muted">Select all events you compete in.</p>
        <div className="grid grid-cols-2 gap-3">
          {EVENTS.map((ev) => {
            const active = selectedEvents.includes(ev.value);
            return (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={cn(
                  "px-4 py-3 rounded-xl border-2 text-left transition-all",
                  active
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-300 dark:hover:border-primary-700"
                )}
              >
                <p className={cn("font-semibold text-sm", !active && "text-[var(--foreground)]")}>
                  {ev.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Profile updated successfully.
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="btn btn-primary"
      >
        {isPending ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
