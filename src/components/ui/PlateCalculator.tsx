"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

/* ─── Constants ──────────────────────────────────────────────────────────── */

// Standard plates, descending by weight. The pair-on-bar racker walks the
// array greedily, so the order matters.
//
// Note: we deliberately omit the 55lb (competition-only) plate. With it in
// the list, a 225lb load greedy-racks as 55+35 instead of the canonical
// 2×45 — surprising every D1 coach we've shown it to. Coaches who genuinely
// have 55s can add them in a future "gym profile" customization.
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];

const BAR_KG = 20;
const BAR_LB = 45;

// Visual tuning: each plate gets a height proportional to its weight, clamped
// so a 0.5kg change-plate is still tappable. Height is in pixels; the SVG
// scales up to its container.
const PLATE_DIM_KG: Record<number, { h: number; thick: number }> = {
  25: { h: 84, thick: 14 },
  20: { h: 80, thick: 12 },
  15: { h: 70, thick: 11 },
  10: { h: 60, thick: 10 },
  5: { h: 48, thick: 9 },
  2.5: { h: 38, thick: 8 },
  1.25: { h: 30, thick: 7 },
  0.5: { h: 22, thick: 6 },
};

const PLATE_DIM_LB: Record<number, { h: number; thick: number }> = {
  45: { h: 82, thick: 13 },
  35: { h: 70, thick: 11 },
  25: { h: 58, thick: 10 },
  10: { h: 48, thick: 9 },
  5: { h: 38, thick: 8 },
  2.5: { h: 30, thick: 7 },
  1.25: { h: 24, thick: 6 },
};

// Brand-aligned plate colors. The dark amber for the heaviest plate is
// the primary brand accent; everything else uses subdued tones so the
// stack reads as a gradient at a glance.
const PLATE_COLOR_KG: Record<number, string> = {
  25: "#FF2222",
  20: "#1E40AF",
  15: "#FFC800",
  10: "#10B981",
  5: "#FFFFFF",
  2.5: "#9CA3AF",
  1.25: "#6B7280",
  0.5: "#4B5563",
};

const PLATE_COLOR_LB: Record<number, string> = {
  45: "#1E3A8A",
  35: "#FFC800",
  25: "#10B981",
  10: "#F4F4F5",
  5: "#9CA3AF",
  2.5: "#6B7280",
  1.25: "#4B5563",
};

const STORAGE_KEY_PREFIX = "podium:plate-calc:";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type Unit = "kg" | "lb";

export interface PlateCalculatorProps {
  /** Initial weight to render with. Falls back to bar-only when unset. */
  initialWeight?: number;
  /** Initial unit. Defaults to kg (project's domain). */
  initialUnit?: Unit;
  /** Bar weight override — competition-spec barbell by default. */
  barWeight?: number;
  /**
   * Persistence key inputs. When both are set, last-used weight is saved
   * to localStorage and restored on mount, so an athlete reopening the same
   * exercise next session lands on their previous load.
   */
  athleteId?: string;
  exerciseId?: string;
  /** Disable haptic ticks (useful for unit tests / demos). */
  disableHaptics?: boolean;
  /** Fired whenever the committed weight changes (after debounce). */
  onChange?: (weight: number, unit: Unit) => void;
  /** Callback when the user explicitly commits — wire to your "log set" CTA. */
  onCommit?: (weight: number, unit: Unit) => void;
  className?: string;
}

interface RackedPlate {
  weight: number;
  /** Stable key so React reuses the same DOM node when the stack shifts. */
  key: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function rackPlates(weightPerSide: number, plates: number[]): RackedPlate[] {
  const out: RackedPlate[] = [];
  let remaining = weightPerSide;
  // Avoid fp drift across many subtractions.
  const epsilon = 1e-3;
  let counter = 0;
  for (const p of plates) {
    if (remaining <= epsilon) break;
    let count = Math.floor((remaining + epsilon) / p);
    while (count > 0) {
      out.push({ weight: p, key: `${p}-${counter++}` });
      count--;
    }
    remaining -= Math.floor((remaining + epsilon) / p) * p;
    remaining = Math.max(0, Math.round(remaining * 1000) / 1000);
  }
  return out;
}

function plateBreakdown(plates: RackedPlate[]): string {
  if (!plates.length) return "Bar only";
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p.weight, (counts.get(p.weight) ?? 0) + 1);
  // Each entry represents ONE side; the "× 2 sides" suffix is implicit
  // because every formula in lifting expresses pairs.
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, c]) => (c > 1 ? `${c}×${w}` : `${w}`))
    .join(" + ");
}

function clampWeight(value: number, bar: number): number {
  // Whole-pound jumps are common in US programming; whole-kg in metric. We
  // clamp at 0 so the calc never goes negative; upper bound is loose so
  // strongmen testing 300kg+ aren't capped artificially.
  if (!Number.isFinite(value)) return bar;
  return Math.max(0, Math.round(value * 100) / 100);
}

function tickHaptic(disabled: boolean | undefined) {
  if (disabled || typeof navigator === "undefined") return;
  // navigator.vibrate is a no-op on iOS Safari and on desktop — fine.
  navigator.vibrate?.(10);
}

function readPersistedWeight(athleteId?: string, exerciseId?: string, unit?: Unit): number | null {
  if (!athleteId || !exerciseId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${athleteId}:${exerciseId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { weight?: number; unit?: Unit };
    if (parsed.unit !== unit) return null;
    return typeof parsed.weight === "number" && parsed.weight >= 0 ? parsed.weight : null;
  } catch (err) {
    // ok: best-effort restore — fall back to the bar weight on quota errors,
    // corrupt JSON, or private mode. No user action would help.
    logger.debug("plate calc persistence read failed", {
      context: "ui/PlateCalculator",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
    return null;
  }
}

function writePersistedWeight(weight: number, unit: Unit, athleteId?: string, exerciseId?: string) {
  if (!athleteId || !exerciseId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${athleteId}:${exerciseId}`,
      JSON.stringify({ weight, unit })
    );
  } catch (err) {
    // ok: best-effort write. localStorage throws in private mode or when over
    // quota; the persistence is a 2-tap convenience, not authoritative state.
    logger.debug("plate calc persistence write failed", {
      context: "ui/PlateCalculator",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function PlateCalculator({
  initialWeight,
  initialUnit = "kg",
  barWeight,
  athleteId,
  exerciseId,
  disableHaptics,
  onChange,
  onCommit,
  className,
}: PlateCalculatorProps) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const bar = barWeight ?? (unit === "kg" ? BAR_KG : BAR_LB);

  // Resolve the initial weight: prop > persisted > bar.
  const persisted = useMemo(
    () => readPersistedWeight(athleteId, exerciseId, initialUnit),
    [athleteId, exerciseId, initialUnit]
  );
  const startWeight = initialWeight ?? persisted ?? bar;

  const [weight, setWeight] = useState<number>(clampWeight(startWeight, bar));
  const [inputValue, setInputValue] = useState<string>(String(startWeight));

  const reduceMotion = useReducedMotion();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* ── When unit toggles, snap the bar weight + clear out-of-unit weight ── */
  const handleUnitChange = useCallback(
    (next: Unit) => {
      if (next === unit) return;
      setUnit(next);
      const newBar = barWeight ?? (next === "kg" ? BAR_KG : BAR_LB);
      // Restore from persistence if available for the new unit; otherwise
      // fall back to the new bar weight. Don't auto-convert — coaches usually
      // think in one unit; a stealth conversion creates rounding traps.
      const pers = readPersistedWeight(athleteId, exerciseId, next);
      const next0 = pers ?? newBar;
      setWeight(next0);
      setInputValue(String(next0));
    },
    [unit, barWeight, athleteId, exerciseId]
  );

  /* ── Increment / decrement / reset / set ─────────────────────────────── */
  const adjust = useCallback(
    (delta: number) => {
      tickHaptic(disableHaptics);
      setWeight((w) => clampWeight(w + delta, bar));
      setInputValue((v) => {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return String(bar + delta);
        return String(clampWeight(n + delta, bar));
      });
    },
    [bar, disableHaptics]
  );

  const reset = useCallback(() => {
    tickHaptic(disableHaptics);
    setWeight(bar);
    setInputValue(String(bar));
  }, [bar, disableHaptics]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (value === "") return;
    const n = parseFloat(value);
    if (Number.isFinite(n) && n >= 0) setWeight(Math.round(n * 100) / 100);
  }, []);

  const handleInputBlur = useCallback(() => {
    setInputValue(String(weight));
  }, [weight]);

  /* ── Persist + notify on every committed weight change ───────────────── */
  useEffect(() => {
    onChangeRef.current?.(weight, unit);
    writePersistedWeight(weight, unit, athleteId, exerciseId);
  }, [weight, unit, athleteId, exerciseId]);

  /* ── Derived state ───────────────────────────────────────────────────── */
  const plates = unit === "kg" ? KG_PLATES : LB_PLATES;
  const dims = unit === "kg" ? PLATE_DIM_KG : PLATE_DIM_LB;
  const colors = unit === "kg" ? PLATE_COLOR_KG : PLATE_COLOR_LB;

  const perSide = useMemo(() => Math.max(0, (weight - bar) / 2), [weight, bar]);
  const racked = useMemo(() => rackPlates(perSide, plates), [perSide, plates]);
  const racked2 = useMemo(() => racked.reduce((s, p) => s + p.weight, 0), [racked]);
  const exact = Math.abs(racked2 * 2 + bar - weight) < 1e-3;
  const breakdown = plateBreakdown(racked);

  // Quick increments — kg uses 2.5/5/10, lb uses 5/10/25 (matches the warmup
  // patterns coaches use without thinking).
  const quickButtons = unit === "kg" ? [2.5, 5, 10] : [5, 10, 25];

  return (
    <div className={cn("card p-5 space-y-4", className)}>
      {/* Header — title + unit toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base text-[var(--foreground)]">Plate Calculator</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            Bar {bar}
            {unit} + plates
          </p>
        </div>
        <div
          role="group"
          aria-label="Weight unit"
          className="inline-flex rounded-lg border border-[var(--card-border)] p-0.5 text-xs font-medium"
        >
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUnitChange(u)}
              aria-pressed={unit === u}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors uppercase tracking-wider",
                unit === u
                  ? "bg-primary-500/15 text-primary-700 dark:text-primary-300"
                  : "text-surface-500 dark:text-surface-400 hover:text-[var(--foreground)]"
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Weight readout + quick adjusters */}
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-5xl font-heading font-semibold tabular-nums text-[var(--foreground)] tracking-tight">
            {weight}
          </span>
          <span className="text-sm font-mono uppercase tracking-wider text-surface-500 dark:text-surface-400">
            {unit}
          </span>
        </div>
        <span
          className={cn(
            "text-xs",
            exact ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          )}
          aria-live="polite"
        >
          {exact ? `${breakdown} per side` : `Closest: ${racked2 * 2 + bar}${unit} (${breakdown})`}
        </span>
      </div>

      {/* Animated barbell + plate stack */}
      <PlateStackSVG
        bar={bar}
        unit={unit}
        plates={racked}
        plateDims={dims}
        plateColors={colors}
        reduceMotion={reduceMotion}
      />

      {/* Direct entry + ± buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjust(-quickButtons[1])}
          aria-label={`Decrease ${quickButtons[1]} ${unit}`}
          className="shrink-0 w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-[var(--foreground)] flex items-center justify-center transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          aria-label={`Total weight in ${unit}`}
          className="flex-1 min-w-0 text-center font-mono text-lg tabular-nums bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 text-[var(--foreground)]"
        />
        <button
          type="button"
          onClick={() => adjust(quickButtons[1])}
          aria-label={`Increase ${quickButtons[1]} ${unit}`}
          className="shrink-0 w-10 h-10 rounded-full bg-primary-500/15 hover:bg-primary-500/25 text-primary-700 dark:text-primary-300 flex items-center justify-center transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {/* Quick increments + reset */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {quickButtons.map((q) => (
          <button
            key={`-${q}`}
            type="button"
            onClick={() => adjust(-q)}
            className="px-2.5 py-1 rounded-full text-xs font-mono tabular-nums bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400 hover:text-[var(--foreground)] transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={`Decrease ${q} ${unit}`}
          >
            −{q}
          </button>
        ))}
        {quickButtons.map((q) => (
          <button
            key={`+${q}`}
            type="button"
            onClick={() => adjust(q)}
            className="px-2.5 py-1 rounded-full text-xs font-mono tabular-nums bg-primary-500/10 hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={`Increase ${q} ${unit}`}
          >
            +{q}
          </button>
        ))}
        <button
          type="button"
          onClick={reset}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-surface-500 dark:text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Reset to bar weight"
        >
          <RotateCcw size={12} strokeWidth={1.75} aria-hidden="true" />
          Reset
        </button>
      </div>

      {onCommit && (
        <button
          type="button"
          onClick={() => onCommit(weight, unit)}
          className="w-full py-2.5 rounded-lg bg-primary-500 text-surface-950 font-medium text-sm transition-transform active:scale-[0.98] hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)]"
        >
          Log {weight}
          {unit}
        </button>
      )}
    </div>
  );
}

/* ─── Animated SVG stack ─────────────────────────────────────────────────── */

interface PlateStackSVGProps {
  bar: number;
  unit: Unit;
  plates: RackedPlate[];
  plateDims: Record<number, { h: number; thick: number }>;
  plateColors: Record<number, string>;
  reduceMotion: boolean;
}

function PlateStackSVG({
  bar,
  unit,
  plates,
  plateDims,
  plateColors,
  reduceMotion,
}: PlateStackSVGProps) {
  // Layout in viewBox units. The bar sits horizontally; plates stack outward
  // from the collar on each side. We render only the right side and mirror
  // it visually for the left.
  const VB_W = 320;
  const VB_H = 110;
  const BAR_LEFT = 32;
  const BAR_RIGHT = VB_W - 32;
  const BAR_THICKNESS = 6;
  const BAR_Y = VB_H / 2 - BAR_THICKNESS / 2;
  const COLLAR_W = 6;
  const COLLAR_H = 30;

  // Walk plates outward from each collar, summing thickness so each plate
  // gets a stable x-offset that animates when the stack changes.
  let cursor = 0;
  const placed = plates.map((p) => {
    const dim = plateDims[p.weight] ?? { h: 30, thick: 8 };
    const xRight = BAR_RIGHT + COLLAR_W + cursor;
    const xLeft = BAR_LEFT - COLLAR_W - cursor - dim.thick;
    cursor += dim.thick + 1;
    return { ...p, dim, xRight, xLeft };
  });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Barbell loaded with ${plates.length} plate${plates.length === 1 ? "" : "s"} per side, ${bar}${unit} bar`}
      >
        {/* Bar */}
        <rect
          x={BAR_LEFT}
          y={BAR_Y}
          width={BAR_RIGHT - BAR_LEFT}
          height={BAR_THICKNESS}
          rx={2}
          className="fill-surface-300 dark:fill-surface-600"
        />
        {/* Collars (sleeves) */}
        <rect
          x={BAR_LEFT - COLLAR_W}
          y={VB_H / 2 - COLLAR_H / 2}
          width={COLLAR_W}
          height={COLLAR_H}
          rx={1.5}
          className="fill-surface-400 dark:fill-surface-500"
        />
        <rect
          x={BAR_RIGHT}
          y={VB_H / 2 - COLLAR_H / 2}
          width={COLLAR_W}
          height={COLLAR_H}
          rx={1.5}
          className="fill-surface-400 dark:fill-surface-500"
        />

        {/* Right-side plates */}
        {placed.map((p) => (
          <PlateRect
            key={`r-${p.key}`}
            x={p.xRight}
            y={VB_H / 2 - p.dim.h / 2}
            width={p.dim.thick}
            height={p.dim.h}
            color={plateColors[p.weight] ?? "#888"}
            reduceMotion={reduceMotion}
          />
        ))}
        {/* Left-side plates (mirrored) */}
        {placed.map((p) => (
          <PlateRect
            key={`l-${p.key}`}
            x={p.xLeft}
            y={VB_H / 2 - p.dim.h / 2}
            width={p.dim.thick}
            height={p.dim.h}
            color={plateColors[p.weight] ?? "#888"}
            reduceMotion={reduceMotion}
          />
        ))}
      </svg>
    </div>
  );
}

interface PlateRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  reduceMotion: boolean;
}

function PlateRect({ x, y, width, height, color, reduceMotion }: PlateRectProps) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={1.5}
      fill={color}
      style={{
        transition: reduceMotion
          ? "none"
          : "x 280ms cubic-bezier(0.22, 1, 0.36, 1), y 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "x, y, height",
      }}
    />
  );
}

/* ─── prefers-reduced-motion hook ────────────────────────────────────────── */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/* ─── Test-only helpers (exported for unit tests) ────────────────────────── */

export const _testing = {
  rackPlates,
  plateBreakdown,
  KG_PLATES,
  LB_PLATES,
  BAR_KG,
  BAR_LB,
};
