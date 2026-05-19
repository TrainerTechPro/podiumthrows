"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DistanceUnit, WeightUnit } from "../_state";

interface Step3PRProps {
  prImplementWeight: string;
  prImplementUnit: WeightUnit;
  prDistance: string;
  prDistanceUnit: DistanceUnit;
  prDate: string;
  onChange: (
    patch: Partial<{
      prImplementWeight: string;
      prImplementUnit: WeightUnit;
      prDistance: string;
      prDistanceUnit: DistanceUnit;
      prDate: string;
    }>
  ) => void;
}

export function Step3PR({
  prImplementWeight,
  prImplementUnit,
  prDistance,
  prDistanceUnit,
  prDate,
  onChange,
}: Step3PRProps) {
  const distanceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    distanceRef.current?.focus();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)] leading-tight">
          Your best so far?
        </h1>
        <p className="text-sm text-muted">
          We&apos;ll set this as your starting line. Beat it next session.
        </p>
      </div>

      <div className="space-y-4">
        <UnitField
          label="Distance"
          value={prDistance}
          onValueChange={(v) => onChange({ prDistance: v })}
          unit={prDistanceUnit}
          onUnitChange={(u) => onChange({ prDistanceUnit: u as DistanceUnit })}
          units={["m", "ft"]}
          inputRef={distanceRef}
          placeholder="0.00"
          step="0.01"
        />

        <UnitField
          label="Implement weight"
          value={prImplementWeight}
          onValueChange={(v) => onChange({ prImplementWeight: v })}
          unit={prImplementUnit}
          onUnitChange={(u) => onChange({ prImplementUnit: u as WeightUnit })}
          units={["kg", "lb"]}
          placeholder="0.00"
          step="0.01"
        />

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
            When
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={prDate}
              max={today}
              onChange={(e) => onChange({ prDate: e.target.value })}
              className="input flex-1"
            />
            {prDate !== today && (
              <button
                type="button"
                onClick={() => onChange({ prDate: today })}
                className="px-4 min-h-[44px] rounded-xl text-sm font-medium text-primary-500 hover:bg-primary-500/10 active:scale-[0.97] transition-colors duration-150"
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Field with unit toggle ────────────────────────────────────────── */

interface UnitFieldProps {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  unit: string;
  onUnitChange: (u: string) => void;
  units: string[];
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
  step?: string;
}

function UnitField({
  label,
  value,
  onValueChange,
  unit,
  onUnitChange,
  units,
  inputRef,
  placeholder,
  step,
}: UnitFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          min="0"
          className="input flex-1 font-mono text-lg tabular-nums"
        />
        <div
          role="radiogroup"
          aria-label={`${label} unit`}
          className="inline-flex items-center bg-[var(--muted-bg)] p-1 rounded-xl shrink-0"
        >
          {units.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => onUnitChange(u)}
              className={cn(
                "px-3 h-11 rounded-lg text-sm font-medium transition-colors uppercase",
                unit === u
                  ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
