"use client";

import React from "react";

// ── Types ──────────────────────────────────────────────────────────────

export type UnitSystem = "imperial" | "metric";

// ── Shared UI helpers ──────────────────────────────────────────────────

export function CalcCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary-500/15 dark:bg-primary-400/10 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <h3 className="font-heading text-section text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export function NumInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step = "any",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      className="input w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0"}
      min={min}
      max={max}
      step={step}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="input w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ResultBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 p-3.5">
      <p className="label text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="font-heading text-title text-primary-600 dark:text-primary-400 leading-none">
        {value}
      </p>
      {sub && <p className="text-caption text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (v: UnitSystem) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 w-fit">
      {(["imperial", "metric"] as UnitSystem[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`px-3 py-3 text-caption font-medium transition-colors min-h-[44px] ${
            value === u
              ? "bg-primary-500 text-white"
              : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
          }`}
        >
          {u === "imperial" ? "lbs / in" : "kg / cm"}
        </button>
      ))}
    </div>
  );
}

export function CalcButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="btn-primary w-full" onClick={onClick} disabled={disabled}>
      Calculate
    </button>
  );
}

// ── Unit helpers ────────────────────────────────────────────────────────

export const lbToKg = (lb: number) => lb * 0.453592;
export const kgToLb = (kg: number) => kg / 0.453592;
export const inToCm = (i: number) => i * 2.54;
export const _cmToIn = (cm: number) => cm / 2.54;
export const inToM = (i: number) => i * 0.0254;

export function fmt(n: number, dec = 1) {
  if (!isFinite(n)) return "—";
  return n.toFixed(dec);
}
