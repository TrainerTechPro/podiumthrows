"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components";
import { Input } from "@/components/ui/Input";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import type { EquipmentData, ImplementEntry, ImplementType, ProfileData } from "./_types";
import { EVENT_TO_IMPLEMENT_TYPE, EVENTS_LIST, STANDARD_IMPLEMENT_WEIGHTS } from "./_types";

const ACCESS_OPTIONS = [
  { value: "FULL", label: "Full" },
  { value: "LIMITED", label: "Limited" },
  { value: "NONE", label: "None" },
] as const;

const FACILITY_FLAGS = [
  { key: "hasCage", label: "Throwing cage" },
  { key: "hasRing", label: "Throwing ring/circle" },
  { key: "hasFieldAccess", label: "Field / runway" },
  { key: "hasGym", label: "Weight room" },
] as const;

function formatKg(kg: number): string {
  // Strip trailing zeroes — 7.26 → "7.26", 8.0 → "8".
  return Number.isInteger(kg) ? String(kg) : kg.toString();
}

export function TabEquipment({
  profile,
  equipment,
}: {
  profile: ProfileData;
  equipment: EquipmentData;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  // Split incoming implements into standard (per-event) selections + a
  // preserved tail (e.g. weight-throw entries) so the round-trip doesn't
  // drop anything the program engine cares about.
  const { initialSelected, preservedExtras } = useMemo(() => {
    const selected: Record<ImplementType, Set<number>> = {
      shot: new Set(),
      disc: new Set(),
      hammer: new Set(),
      jav: new Set(),
      weight: new Set(),
    };
    const extras: ImplementEntry[] = [];
    for (const entry of equipment.implements) {
      if (entry.type in selected && entry.type !== "weight") {
        selected[entry.type].add(entry.weightKg);
      } else {
        extras.push(entry);
      }
    }
    return { initialSelected: selected, preservedExtras: extras };
  }, [equipment.implements]);

  const [selected, setSelected] = useState(initialSelected);
  const [facility, setFacility] = useState(equipment.facility ?? "");
  const [weightRoomAccess, setWeightRoomAccess] = useState<EquipmentData["weightRoomAccess"]>(
    equipment.weightRoomAccess
  );
  const [flags, setFlags] = useState({
    hasCage: equipment.hasCage,
    hasRing: equipment.hasRing,
    hasFieldAccess: equipment.hasFieldAccess,
    hasGym: equipment.hasGym,
  });

  const athleteEvents = EVENTS_LIST.filter((ev) => profile.events.includes(ev.value));

  function toggleWeight(type: ImplementType, kg: number) {
    setSelected((prev) => {
      const next = new Set(prev[type]);
      if (next.has(kg)) next.delete(kg);
      else next.add(kg);
      return { ...prev, [type]: next };
    });
  }

  function flattenImplements(): ImplementEntry[] {
    const out: ImplementEntry[] = [];
    for (const [type, set] of Object.entries(selected) as [ImplementType, Set<number>][]) {
      for (const kg of set) out.push({ weightKg: kg, type });
    }
    return [...out, ...preservedExtras];
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const payload = {
          implements: flattenImplements(),
          hasCage: flags.hasCage,
          hasRing: flags.hasRing,
          hasFieldAccess: flags.hasFieldAccess,
          hasGym: flags.hasGym,
          // Round-trip the engine-shaped gymEquipment unchanged.
          gymEquipment: equipment.gymEquipment ?? undefined,
          facility: facility.trim() || null,
          weightRoomAccess,
        };

        const res = await fetch("/api/throws/equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          toastError("Save failed", data?.error || "Please try again.");
          return;
        }

        success("Equipment saved");
        router.refresh();
      } catch (err) {
        logger.error("equipment save failed", {
          context: "athlete/profile/tab-equipment",
          error: err,
        });
        toastError("Save failed", "Network error. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Implements per event ────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Available implements
          </h2>
          <p className="text-sm text-muted mt-1">
            Pick the weights you can train with. Your coach uses these to pick block 1 / block 2
            implements that you actually have.
          </p>
        </div>

        {athleteEvents.length === 0 ? (
          <p className="text-sm text-muted">
            Add events in <span className="font-semibold text-primary-500">Core Info</span> to log
            available implements.
          </p>
        ) : (
          <div className="space-y-5">
            {athleteEvents.map((ev) => {
              const type = EVENT_TO_IMPLEMENT_TYPE[ev.value];
              const presets = STANDARD_IMPLEMENT_WEIGHTS[type];
              const selectedSet = selected[type];
              return (
                <div key={ev.value} className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{ev.label}</h3>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((kg) => {
                      const active = selectedSet.has(kg);
                      return (
                        <button
                          key={kg}
                          type="button"
                          onClick={() => toggleWeight(type, kg)}
                          aria-pressed={active}
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-medium border transition-colors tabular-nums",
                            active
                              ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                              : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                          )}
                        >
                          {formatKg(kg)} kg
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Training facility ───────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">Facility</h2>
          <p className="text-sm text-muted mt-1">Where you do most of your throwing and lifting.</p>
        </div>

        <div>
          <label
            htmlFor="eq-facility"
            className="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Facility name
          </label>
          <Input
            id="eq-facility"
            type="text"
            className="w-full"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="e.g. University of Oregon, Hayward Field"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            What you have on site
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FACILITY_FLAGS.map((flag) => {
              const checked = flags[flag.key];
              return (
                <button
                  key={flag.key}
                  type="button"
                  onClick={() => setFlags((prev) => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                  aria-pressed={checked}
                  className={cn(
                    "px-4 py-3 rounded-lg text-sm font-medium border transition-colors text-left",
                    checked
                      ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                  )}
                >
                  {flag.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Weight room access ─────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
            Weight room access
          </h2>
          <p className="text-sm text-muted mt-1">How much access you have for strength sessions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCESS_OPTIONS.map((opt) => {
            const active = weightRoomAccess === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWeightRoomAccess(active ? null : opt.value)}
                aria-pressed={active}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                  active
                    ? "border-primary-500 bg-primary-500/8 text-primary-700 dark:text-primary-300"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
