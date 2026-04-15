"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { AthletesTable } from "./_table";
import type { AthleteRosterItem } from "@/lib/data/coach";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
const GENDERS = ["MALE", "FEMALE"] as const;
const CLASS_YEARS = ["FR", "SO", "JR", "SR", "GRAD", "PRO"] as const;

function formatEventLabel(event: string): string {
  const map: Record<string, string> = {
    SHOT_PUT: "Shot Put",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  return map[event] ?? event;
}

function formatClassLabel(cls: string): string {
  return cls; // FR, SO, JR, SR, GRAD, PRO already short
}

/* ─── Filter Pill ─────────────────────────────────────────────────────────── */

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? "border-primary-500 bg-primary-500/10 text-primary-500"
          : "border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function setToParam(set: Set<string>): string {
  return Array.from(set).join(",");
}

function paramToSet(param: string | null): Set<string> {
  if (!param) return new Set();
  return new Set(param.split(",").filter(Boolean));
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function RosterClient({ data }: { data: AthleteRosterItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Read filter state from URL params
  const selectedEvents = useMemo(() => paramToSet(searchParams.get("events")), [searchParams]);
  const selectedGenders = useMemo(() => paramToSet(searchParams.get("genders")), [searchParams]);
  const selectedClasses = useMemo(() => paramToSet(searchParams.get("classes")), [searchParams]);
  const availabilityFilter = searchParams.get("availability") ?? "";

  // Update a URL param without losing others
  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Preserve tab param if present
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  function toggleSetParam(key: string, current: Set<string>, value: string) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updateParam(key, setToParam(next));
  }

  function clearAllFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("events");
    params.delete("genders");
    params.delete("classes");
    params.delete("availability");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasActiveFilters =
    selectedEvents.size > 0 ||
    selectedGenders.size > 0 ||
    selectedClasses.size > 0 ||
    !!availabilityFilter;

  // Client-side filtering
  const filtered = useMemo(() => {
    return data.filter((athlete) => {
      // Event filter
      if (selectedEvents.size > 0 && !athlete.events.some((e) => selectedEvents.has(e))) {
        return false;
      }

      // Gender filter
      if (selectedGenders.size > 0 && (!athlete.gender || !selectedGenders.has(athlete.gender))) {
        return false;
      }

      // Class year filter
      if (
        selectedClasses.size > 0 &&
        (!athlete.classStanding || !selectedClasses.has(athlete.classStanding))
      ) {
        return false;
      }

      // Availability filter
      if (availabilityFilter === "has") {
        if (athlete.availabilityCount === 0) return false;
      } else if (availabilityFilter === "none") {
        if (athlete.availabilityCount > 0) return false;
      }

      return true;
    });
  }, [data, selectedEvents, selectedGenders, selectedClasses, availabilityFilter]);

  return (
    <div className="space-y-4">
      {/* Filter toggle (mobile) / always-visible bar (desktop) */}
      <div>
        {/* Mobile: collapsible toggle */}
        <div className="flex items-center justify-between sm:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-[var(--foreground)] transition-colors"
            >
              <X size={12} aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {/* Filter bar — always visible on sm+, toggle-controlled on mobile */}
        <div className={`mt-3 sm:mt-0 ${filtersOpen ? "block" : "hidden"} sm:block`}>
          <div className="flex flex-wrap gap-x-6 gap-y-3 items-start p-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            {/* Event */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Event
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EVENTS.map((e) => (
                  <FilterPill
                    key={e}
                    label={formatEventLabel(e)}
                    active={selectedEvents.has(e)}
                    onClick={() => toggleSetParam("events", selectedEvents, e)}
                  />
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Gender
              </span>
              <div className="flex flex-wrap gap-1.5">
                {GENDERS.map((g) => (
                  <FilterPill
                    key={g}
                    label={g === "MALE" ? "Male" : "Female"}
                    active={selectedGenders.has(g)}
                    onClick={() => toggleSetParam("genders", selectedGenders, g)}
                  />
                ))}
              </div>
            </div>

            {/* Class Year */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Class Year
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CLASS_YEARS.map((c) => (
                  <FilterPill
                    key={c}
                    label={formatClassLabel(c)}
                    active={selectedClasses.has(c)}
                    onClick={() => toggleSetParam("classes", selectedClasses, c)}
                  />
                ))}
              </div>
            </div>

            {/* Availability */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Availability
              </span>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill
                  label="Has Availability"
                  active={availabilityFilter === "has"}
                  onClick={() =>
                    updateParam("availability", availabilityFilter === "has" ? "" : "has")
                  }
                />
                <FilterPill
                  label="No Availability"
                  active={availabilityFilter === "none"}
                  onClick={() =>
                    updateParam("availability", availabilityFilter === "none" ? "" : "none")
                  }
                />
              </div>
            </div>

            {/* Clear (desktop) */}
            {hasActiveFilters && (
              <div className="hidden sm:flex items-end pb-0.5 ml-auto">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-[var(--foreground)] transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Active filter count */}
          {hasActiveFilters && (
            <p className="mt-1.5 text-xs text-muted">
              Showing{" "}
              <span className="font-semibold text-[var(--foreground)]">{filtered.length}</span> of{" "}
              <span className="font-semibold text-[var(--foreground)]">{data.length}</span> athletes
            </p>
          )}
        </div>
      </div>

      <AthletesTable data={filtered} />
    </div>
  );
}
