"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { EVENTS, type ThrowEvent } from "@/lib/throws/constants";
import type { DistanceUnit, WeightUnit, OnboardingMode } from "../_state";

interface Step4FirstLogProps {
  mode: OnboardingMode;
  coachFirstName: string;
  event: ThrowEvent;
  firstThrowDistance: string;
  firstThrowDistanceUnit: DistanceUnit;
  firstThrowImplementWeight: string;
  firstThrowImplementUnit: WeightUnit;
  firstThrowRpe: number;
  onChange: (
    patch: Partial<{
      firstThrowDistance: string;
      firstThrowDistanceUnit: DistanceUnit;
      firstThrowImplementWeight: string;
      firstThrowImplementUnit: WeightUnit;
      firstThrowRpe: number;
    }>
  ) => void;
  onChangeEvent: () => void;
}

export function Step4FirstLog({
  mode,
  coachFirstName,
  event,
  firstThrowDistance,
  firstThrowDistanceUnit,
  firstThrowImplementWeight,
  firstThrowImplementUnit,
  firstThrowRpe,
  onChange,
  onChangeEvent,
}: Step4FirstLogProps) {
  const distanceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    distanceRef.current?.focus();
  }, []);

  const eventLabel = EVENTS[event]?.label ?? "Throw";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)] leading-tight">
          {mode === "invite" ? `${coachFirstName} set you up.` : "Now log a throw."}
        </h1>
        <p className="text-sm text-muted">
          {mode === "invite"
            ? "One throw to start."
            : "Practice, today, anything. It takes ten seconds."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Event chip — non-editable, with change link */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
            Event
          </label>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-3 h-11 rounded-xl text-sm font-heading font-semibold bg-primary-500/12 text-[var(--foreground)] border border-primary-500/30"
              style={{ borderLeftColor: EVENTS[event]?.color, borderLeftWidth: 3 }}
            >
              {eventLabel}
            </span>
            <button
              type="button"
              onClick={onChangeEvent}
              className="px-3 py-2 text-xs font-medium text-primary-500 hover:underline"
            >
              change
            </button>
          </div>
        </div>

        {/* Distance — required, autofocused */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
            Distance
          </label>
          <div className="flex items-stretch gap-2">
            <input
              ref={distanceRef}
              type="number"
              inputMode="decimal"
              value={firstThrowDistance}
              onChange={(e) => onChange({ firstThrowDistance: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
              className="input flex-1 font-mono text-2xl tabular-nums"
            />
            <UnitToggle
              units={["m", "ft"]}
              value={firstThrowDistanceUnit}
              onChange={(u) => onChange({ firstThrowDistanceUnit: u as DistanceUnit })}
            />
          </div>
        </div>

        {/* Implement weight — optional */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
            Implement weight <span className="font-normal normal-case text-muted">(optional)</span>
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={firstThrowImplementWeight}
              onChange={(e) => onChange({ firstThrowImplementWeight: e.target.value })}
              placeholder="comp weight"
              step="0.01"
              min="0"
              className="input flex-1 font-mono text-lg tabular-nums"
            />
            <UnitToggle
              units={["kg", "lb"]}
              value={firstThrowImplementUnit}
              onChange={(u) => onChange({ firstThrowImplementUnit: u as WeightUnit })}
            />
          </div>
        </div>

        {/* Felt-like RPE slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="rpe-slider"
              className="block text-xs font-semibold text-muted uppercase tracking-wider"
            >
              Felt like
            </label>
            <span className="text-sm font-mono tabular-nums text-[var(--foreground)] font-semibold">
              {firstThrowRpe} / 10
            </span>
          </div>
          <input
            id="rpe-slider"
            type="range"
            min={1}
            max={10}
            step={1}
            value={firstThrowRpe}
            onChange={(e) => onChange({ firstThrowRpe: parseInt(e.target.value, 10) })}
            className="w-full accent-primary-500 h-2"
          />
          <div className="flex justify-between text-nano text-muted">
            <span>Easy</span>
            <span>All out</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitToggle({
  units,
  value,
  onChange,
}: {
  units: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex items-center bg-[var(--muted-bg)] p-1 rounded-xl shrink-0"
    >
      {units.map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={value === u}
          onClick={() => onChange(u)}
          className={cn(
            "px-3 h-11 rounded-lg text-sm font-medium transition-colors uppercase",
            value === u
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
