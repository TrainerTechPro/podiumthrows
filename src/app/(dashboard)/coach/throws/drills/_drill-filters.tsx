"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const CATEGORY_OPTIONS = [
  { value: "CE", label: "Competitive (CE)" },
  { value: "SDE", label: "Special Developmental (SDE)" },
  { value: "SPE", label: "Special Preparatory (SPE)" },
  { value: "GPE", label: "General Preparatory (GPE)" },
];

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const TYPE_OPTIONS = [
  { value: "EXPLOSIVE", label: "Explosive" },
  { value: "SPEED_STRENGTH", label: "Speed Strength" },
  { value: "STRENGTH_SPEED", label: "Strength Speed" },
  { value: "STRENGTH", label: "Strength" },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export function DrillFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(`/coach/throws/drills${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Select
          options={EVENT_OPTIONS}
          value={searchParams.get("event") ?? null}
          onChange={(v) => updateFilter("event", v)}
          placeholder="Event"
          clearable
        />
        <Select
          options={CATEGORY_OPTIONS}
          value={searchParams.get("category") ?? null}
          onChange={(v) => updateFilter("category", v)}
          placeholder="Category"
          clearable
        />
        <Select
          options={DIFFICULTY_OPTIONS}
          value={searchParams.get("difficulty") ?? null}
          onChange={(v) => updateFilter("difficulty", v)}
          placeholder="Difficulty"
          clearable
        />
        <Select
          options={TYPE_OPTIONS}
          value={searchParams.get("athleteType") ?? null}
          onChange={(v) => updateFilter("athleteType", v)}
          placeholder="Athlete Type"
          clearable
        />
        <Input
          placeholder="Search drills…"
          value={searchParams.get("search") ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            // Debounce by just pushing immediately for now
            updateFilter("search", val || null);
          }}
        />
      </div>
    </div>
  );
}
