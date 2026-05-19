"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, RotateCw } from "lucide-react";
import { cn, localToday } from "@/lib/utils";
import { Button } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import type { ProfileData } from "./_types";
import { CLASS_STANDINGS, EVENTS_LIST, GENDERS_LIST } from "./_types";

import { logger } from "@/lib/logger";
/* ─── Component ──────────────────────────────────────────────────────────── */

export function TabCore({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  /* ── Form state ──────────────────────────────────────────────────────── */

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [classStanding, setClassStanding] = useState(profile.classStanding ?? "");
  const [gradYear, setGradYear] = useState(profile.gradYear?.toString() ?? "");
  const [turnDirection, setTurnDirection] = useState(profile.turnDirection ?? "");
  const [events, setEvents] = useState<string[]>([...profile.events]);
  const [gender, setGender] = useState(profile.gender);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? "");
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? "");

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }

  /* ── Save ─────────────────────────────────────────────────────────────── */

  function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      toastError("Validation Error", "First and last name are required.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          classStanding: classStanding || null,
          gradYear: gradYear ? parseInt(gradYear, 10) : null,
          turnDirection: turnDirection || null,
          events,
          gender,
          dateOfBirth: dateOfBirth || null,
          heightCm: heightCm ? parseFloat(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
        };

        const res = await fetch("/api/athlete/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toastError("Save failed", data?.error ?? "Couldn't save profile — try again.");
          return;
        }

        success("Profile Updated", "Your core info has been saved.");
        router.refresh();
      } catch (err) {
        logger.error("core profile save failed", {
          context: "athlete/profile/tab-core",
          error: err,
        });
        toastError("Network Error", "Could not reach the server.");
      }
    });
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  const today = localToday();

  return (
    <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-8">
      <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">Core Info</h2>

      {/* ── Name ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Name</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="core-first-name"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              First Name
            </label>
            <input
              id="core-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input w-full"
              placeholder="First name"
            />
          </div>
          <div>
            <label
              htmlFor="core-last-name"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Last Name
            </label>
            <input
              id="core-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input w-full"
              placeholder="Last name"
            />
          </div>
        </div>
      </section>

      {/* ── Class Standing + Grad Year ────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Class Standing
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {CLASS_STANDINGS.map((cs) => (
              <button
                key={cs.value}
                type="button"
                onClick={() => setClassStanding(classStanding === cs.value ? "" : cs.value)}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors",
                  classStanding === cs.value
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {cs.label}
              </button>
            ))}
          </div>
          <div className="w-28">
            <label
              htmlFor="core-grad-year"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Grad Year
            </label>
            <Input
              id="core-grad-year"
              type="number"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              className="w-full"
              placeholder="2027"
              min={2020}
              max={2040}
            />
          </div>
        </div>
      </section>

      {/* ── Turn Direction ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Turn Direction
        </h3>
        <div className="flex gap-2">
          {(
            [
              { value: "LEFT", label: "Left", Icon: RotateCcw },
              { value: "RIGHT", label: "Right", Icon: RotateCw },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTurnDirection(turnDirection === value ? "" : value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                turnDirection === value
                  ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Events ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Events</h3>
        <div className="grid grid-cols-2 gap-2">
          {EVENTS_LIST.map((ev) => {
            const selected = events.includes(ev.value);
            return (
              <button
                key={ev.value}
                type="button"
                onClick={() => toggleEvent(ev.value)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-center",
                  selected
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {ev.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Gender ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Gender</h3>
        <div className="flex flex-wrap gap-2">
          {GENDERS_LIST.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGender(g.value)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                gender === g.value
                  ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Date of Birth ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Date of Birth</h3>
        <div className="max-w-xs">
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={today}
            className="input w-full"
          />
        </div>
      </section>

      {/* ── Height / Weight ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Body Measurements
        </h3>
        <p className="text-xs text-muted">Used in body composition and load calculations.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="core-height"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Height
            </label>
            <Input
              id="core-height"
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full"
              placeholder="cm"
              min={100}
              max={250}
              step={0.1}
            />
          </div>
          <div>
            <label
              htmlFor="core-weight"
              className="block text-sm font-medium text-[var(--foreground)] mb-1"
            >
              Weight
            </label>
            <Input
              id="core-weight"
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full"
              placeholder="kg"
              min={30}
              max={250}
              step={0.1}
            />
          </div>
        </div>
      </section>

      {/* ── Save Button ────────────────────────────────────────────────── */}
      <div className="pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Saving changes…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
