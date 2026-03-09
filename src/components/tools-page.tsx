"use client";

import { useState, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────

type UnitSystem = "imperial" | "metric";

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "strength",   label: "Strength",   icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
  { id: "bodystats",  label: "Body Stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "cardio",     label: "Cardio",     icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { id: "nutrition",  label: "Nutrition",  icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { id: "running",    label: "Running",    icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { id: "converters", label: "Converters", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
];

// ── Shared UI helpers ──────────────────────────────────────────────────

function CalcCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary-500/15 dark:bg-primary-400/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <h3 className="font-heading text-section text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, min, max, step = "any" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: string; max?: string; step?: string;
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

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="input w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ResultBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 p-3.5">
      <p className="label text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="font-heading text-title text-primary-600 dark:text-primary-400 leading-none">{value}</p>
      {sub && <p className="text-caption text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function UnitToggle({ value, onChange }: { value: UnitSystem; onChange: (v: UnitSystem) => void }) {
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

function CalcButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="btn-primary w-full" onClick={onClick} disabled={disabled}>
      Calculate
    </button>
  );
}

// ── Unit helpers ────────────────────────────────────────────────────────

const lbToKg = (lb: number) => lb * 0.453592;
const kgToLb = (kg: number) => kg / 0.453592;
const inToCm = (i: number) => i * 2.54;
const _cmToIn = (cm: number) => cm / 2.54;
const inToM  = (i: number) => i * 0.0254;

function fmt(n: number, dec = 1) {
  if (!isFinite(n)) return "—";
  return n.toFixed(dec);
}

// ══════════════════════════════════════════════════════════════════════
// STRENGTH TAB
// ══════════════════════════════════════════════════════════════════════

const ORM_PERCENTS = [100,95,93,90,87,85,83,80,77,75,72,70,67,65];
const ORM_REPS     = [1,  2,  3,  4, 5, 6, 7, 8, 9,10,11,12,13,14];

function OneRMCalc() {
  const [weight, setWeight] = useState("");
  const [reps,   setReps]   = useState("");
  const [unit,   setUnit]   = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ brzycki: number; epley: number; lander: number } | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    if (!w || !r || r < 1) return;
    const brzycki = r === 1 ? w : w / (1.0278 - 0.0278 * r);
    const epley   = r === 1 ? w : w * (1 + r / 30);
    const lander  = r === 1 ? w : (100 * w) / (101.3 - 2.67123 * r);
    setResult({ brzycki, epley, lander });
  }, [weight, reps]);

  const best = result ? Math.round((result.brzycki + result.epley + result.lander) / 3) : null;
  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="1-Rep Max (1RM)" icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3">
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Weight (${unitLabel})`}>
          <NumInput value={weight} onChange={setWeight} placeholder="135" min="1" />
        </Row>
        <Row label="Reps performed">
          <NumInput value={reps} onChange={setReps} placeholder="5" min="1" max="30" step="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ResultBox label="Brzycki" value={`${fmt(result.brzycki, 0)} ${unitLabel}`} />
            <ResultBox label="Epley"   value={`${fmt(result.epley, 0)} ${unitLabel}`} />
            <ResultBox label="Lander"  value={`${fmt(result.lander, 0)} ${unitLabel}`} />
          </div>
          <ResultBox label="Average Estimate" value={`${best} ${unitLabel}`} sub="Average of all three formulas" />
          {/* Percentage table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-white/5">
            <table className="w-full text-caption">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800">
                  <th className="text-left px-3 py-2 label text-gray-500 dark:text-gray-400">Reps</th>
                  <th className="text-right px-3 py-2 label text-gray-500 dark:text-gray-400">%1RM</th>
                  <th className="text-right px-3 py-2 label text-gray-500 dark:text-gray-400">Weight</th>
                </tr>
              </thead>
              <tbody>
                {ORM_REPS.map((r, i) => (
                  <tr key={r} className="border-t border-gray-100 dark:border-white/5 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{ORM_PERCENTS[i]}%</td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {best ? `${Math.round(best * ORM_PERCENTS[i] / 100)} ${unitLabel}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CalcCard>
  );
}

function WorkloadCalc() {
  const [weight,    setWeight]    = useState("");
  const [currentR,  setCurrentR]  = useState("");
  const [targetR,   setTargetR]   = useState("");
  const [unit,      setUnit]      = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ orm: number; adjusted: number } | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const cr = parseFloat(currentR);
    const tr = parseFloat(targetR);
    if (!w || !cr || !tr || cr < 1 || tr < 1) return;
    const orm = cr === 1 ? w : w * (1 + cr / 30); // Epley
    const adjusted = orm / (1 + tr / 30);
    setResult({ orm, adjusted });
  }, [weight, currentR, targetR]);

  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Workload Adjustment" icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4">
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Row label={`Weight (${unitLabel})`}>
          <NumInput value={weight} onChange={setWeight} placeholder="185" min="1" />
        </Row>
        <Row label="Reps performed">
          <NumInput value={currentR} onChange={setCurrentR} placeholder="8" min="1" max="30" step="1" />
        </Row>
        <Row label="Target reps">
          <NumInput value={targetR} onChange={setTargetR} placeholder="5" min="1" max="30" step="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Estimated 1RM" value={`${fmt(result.orm, 0)} ${unitLabel}`} />
          <ResultBox label="Target weight" value={`${fmt(result.adjusted, 0)} ${unitLabel}`} sub={`for ${targetR} reps`} />
        </div>
      )}
    </CalcCard>
  );
}

const LB_PLATES  = [55, 45, 35, 25, 10, 5, 2.5];
const KG_PLATES  = [25, 20, 15, 10, 5, 2.5, 1.25];
const BAR_LB = 45;
const BAR_KG = 20;

function rackPlates(weightPerSide: number, plates: number[]): { plate: number; count: number }[] {
  const result: { plate: number; count: number }[] = [];
  let remaining = weightPerSide;
  for (const p of plates) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / p);
    if (count > 0) {
      result.push({ plate: p, count });
      remaining -= count * p;
      remaining = Math.round(remaining * 1000) / 1000;
    }
  }
  return result;
}

function BarbellRackCalc() {
  const [target,   setTarget]   = useState("");
  const [unit,     setUnit]     = useState<UnitSystem>("imperial");
  const [result,   setResult]   = useState<{ plates: { plate: number; count: number }[]; actual: number; bar: number } | null>(null);

  const calc = useCallback(() => {
    const t = parseFloat(target);
    if (!t) return;
    const bar    = unit === "imperial" ? BAR_LB : BAR_KG;
    const plates = unit === "imperial" ? LB_PLATES : KG_PLATES;
    const perSide = (t - bar) / 2;
    if (perSide < 0) return;
    const platesResult = rackPlates(perSide, plates);
    const actual = bar + platesResult.reduce((s, p) => s + p.plate * p.count, 0) * 2;
    setResult({ plates: platesResult, actual, bar });
  }, [target, unit]);

  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Barbell Racking" icon="M3 10h18M3 14h18M10 4v16M14 4v16">
      <UnitToggle value={unit} onChange={setUnit} />
      <Row label={`Target weight (${unitLabel})`}>
        <NumInput value={target} onChange={setTarget} placeholder={unit === "imperial" ? "225" : "100"} min="1" />
      </Row>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Bar weight: {unit === "imperial" ? "45 lbs" : "20 kg"}
      </p>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-3">
          <ResultBox label="Actual total" value={`${fmt(result.actual, 1)} ${unitLabel}`}
            sub={result.actual !== parseFloat(target) ? `⚠ Can't hit ${target} exactly with standard plates` : "✓ Exact match"} />
          {result.plates.length > 0 ? (
            <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
              <div className="bg-surface-50 dark:bg-surface-800 px-3 py-2">
                <p className="label text-gray-500 dark:text-gray-400">Plates per side</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {result.plates.map((p) => (
                  <div key={p.plate} className="flex justify-between items-center px-3 py-2">
                    <span className="text-body text-gray-700 dark:text-gray-300">{p.plate} {unitLabel}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">× {p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-caption text-gray-400">Bar only</p>
          )}
        </div>
      )}
    </CalcCard>
  );
}

// ── Strength Standards ──────────────────────────────────────────────────
const STD_LIFTS = ["squat", "bench", "deadlift", "press"] as const;
type Lift = (typeof STD_LIFTS)[number];

const LIFT_LABELS: Record<Lift, string> = {
  squat: "Back Squat", bench: "Bench Press", deadlift: "Deadlift", press: "Overhead Press",
};

const STANDARDS: Record<"male" | "female", Record<Lift, number[]>> = {
  male: {
    squat:    [0.75, 1.25, 1.50, 1.75, 2.25],
    bench:    [0.50, 0.75, 1.00, 1.25, 1.75],
    deadlift: [1.00, 1.50, 1.75, 2.00, 2.50],
    press:    [0.35, 0.55, 0.70, 0.90, 1.20],
  },
  female: {
    squat:    [0.50, 0.75, 1.00, 1.25, 1.50],
    bench:    [0.25, 0.45, 0.65, 0.85, 1.00],
    deadlift: [0.50, 0.85, 1.10, 1.35, 1.75],
    press:    [0.20, 0.35, 0.45, 0.55, 0.75],
  },
};

const LEVEL_LABELS = ["Untrained", "Novice", "Intermediate", "Advanced", "Elite"];
const LEVEL_COLORS = ["bg-gray-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", "bg-primary-500"];

function getStdLevel(ratio: number, standards: number[]): number {
  let lvl = -1;
  for (let i = 0; i < standards.length; i++) {
    if (ratio >= standards[i]) lvl = i; else break;
  }
  return lvl;
}

function StrengthStandardsCalc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [bw, setBw] = useState("");
  const [lifts, setLifts] = useState<Record<Lift, string>>({ squat: "", bench: "", deadlift: "", press: "" });
  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  const results = useMemo(() => {
    const bwNum = parseFloat(bw);
    if (!bwNum) return null;
    const bwLb = unit === "imperial" ? bwNum : kgToLb(bwNum);
    return STD_LIFTS.map((lift) => {
      const lifted = parseFloat(lifts[lift]);
      const stds = STANDARDS[sex][lift];
      const liftedLb = lifted ? (unit === "imperial" ? lifted : kgToLb(lifted)) : null;
      const ratio = liftedLb ? liftedLb / bwLb : null;
      const level = ratio !== null ? getStdLevel(ratio, stds) : null;
      const nextIdx = level !== null ? level + 1 : 0;
      const nextLb = nextIdx < 5 ? stds[nextIdx] * bwLb : null;
      const nextVal = nextLb ? (unit === "imperial" ? nextLb : lbToKg(nextLb)) : null;
      return { lift, level, nextIdx, nextVal };
    });
  }, [sex, unit, bw, lifts]);

  const hasAnyEntry = results ? results.some((_, i) => lifts[STD_LIFTS[i]] !== "") : false;

  return (
    <CalcCard title="Strength Standards" icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z">
      <div className="flex gap-3 flex-wrap">
        <Select value={sex} onChange={(v) => setSex(v as "male" | "female")} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <Row label={`Bodyweight (${unitLabel})`}>
        <NumInput value={bw} onChange={setBw} placeholder={unit === "imperial" ? "185" : "84"} min="1" />
      </Row>
      <p className="label text-gray-500 dark:text-gray-400">Your 1RM for each lift (leave blank to skip)</p>
      <div className="grid grid-cols-2 gap-3">
        {STD_LIFTS.map(lift => (
          <Row key={lift} label={LIFT_LABELS[lift]}>
            <NumInput value={lifts[lift]} onChange={v => setLifts(p => ({ ...p, [lift]: v }))} placeholder={unit === "imperial" ? "225" : "102"} min="1" />
          </Row>
        ))}
      </div>
      {results && hasAnyEntry && (
        <div className="space-y-3">
          {results.map(({ lift, level, nextIdx, nextVal }) => {
            if (lifts[lift] === "" || level === null) return null;
            const levelLabel = level === -1 ? "Below Untrained" : LEVEL_LABELS[level];
            const pct = level === -1 ? 0 : ((level + 1) / 5) * 100;
            return (
              <div key={lift} className="rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{LIFT_LABELS[lift]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${level === -1 ? "bg-gray-400" : LEVEL_COLORS[level]}`}>
                    {levelLabel}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${level === -1 ? "bg-gray-400" : LEVEL_COLORS[level]}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Untrained</span><span>Elite</span>
                </div>
                {nextIdx < 5 && nextVal && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Next level ({LEVEL_LABELS[nextIdx]}): <span className="font-semibold text-gray-800 dark:text-gray-200">{fmt(nextVal, 0)} {unitLabel}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {results && !hasAnyEntry && bw && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Enter at least one lift to see your level</p>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">ExRx bodyweight ratio standards · Untrained → Novice → Intermediate → Advanced → Elite</p>
    </CalcCard>
  );
}

// ── Wilks / DOTS Score ───────────────────────────────────────────────────
function WilksDOTSCalc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [bw, setBw] = useState("");
  const [total, setTotal] = useState("");
  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  const result = useMemo(() => {
    const bwNum = parseFloat(bw);
    const totalNum = parseFloat(total);
    if (!bwNum || !totalNum) return null;
    const bwKg = unit === "imperial" ? lbToKg(bwNum) : bwNum;
    const totalKg = unit === "imperial" ? lbToKg(totalNum) : totalNum;

    // Wilks coefficients (male / female)
    const wa = sex === "male"
      ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
      : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
    const wDenom = wa[0] + wa[1]*bwKg + wa[2]*bwKg**2 + wa[3]*bwKg**3 + wa[4]*bwKg**4 + wa[5]*bwKg**5;
    const wilks = wDenom > 0 ? (totalKg * 500) / wDenom : 0;

    // DOTS coefficients
    const da = sex === "male"
      ? [-307.75076, 24.0900756, -0.1918759221, 0.0009069006, -0.00000148676]
      : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.00000805154];
    const dDenom = da[0] + da[1]*bwKg + da[2]*bwKg**2 + da[3]*bwKg**3 + da[4]*bwKg**4;
    const dots = dDenom > 0 ? (totalKg * 500) / dDenom : 0;

    return { wilks, dots };
  }, [sex, unit, bw, total]);

  return (
    <CalcCard title="Wilks / DOTS Score" icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z">
      <div className="flex gap-3 flex-wrap">
        <Select value={sex} onChange={(v) => setSex(v as "male" | "female")} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Bodyweight (${unitLabel})`}>
          <NumInput value={bw} onChange={setBw} placeholder={unit === "imperial" ? "185" : "84"} min="1" />
        </Row>
        <Row label={`Total lifted (${unitLabel})`}>
          <NumInput value={total} onChange={setTotal} placeholder={unit === "imperial" ? "1200" : "544"} min="1" />
        </Row>
      </div>
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Wilks Score" value={fmt(result.wilks, 1)} sub="Classic formula" />
            <ResultBox label="DOTS Score" value={fmt(result.dots, 1)} sub="IPF preferred (2020+)" />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            {[["< 200","Beginner"],["200–300","Intermediate"],["300–400","Advanced"],["400–500","Elite"],["500+","World-class"]].map(([range, label]) => (
              <div key={label} className="flex justify-between px-3 py-2 text-xs border-b border-gray-200/40 dark:border-white/5 last:border-0">
                <span className="text-gray-500 dark:text-gray-400">{range}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Normalizes total for bodyweight · Total = Squat + Bench + Deadlift</p>
    </CalcCard>
  );
}

function RepMaxCalc() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("5");
  const [unit, setUnit] = useState<"lb"|"kg">("lb");

  const table = useMemo(() => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || w <= 0 || r < 1 || r > 10) return null;
    const epley1   = r === 1 ? w : w * (1 + r / 30);
    const brzycki1 = r === 1 ? w : w * (36 / (37 - r));
    const lander1  = r === 1 ? w : (100 * w) / (101.3 - 2.67123 * r);
    const orm = (epley1 + brzycki1 + lander1) / 3;
    return Array.from({ length: 10 }, (_, i) => {
      const n  = i + 1;
      const eW = n === 1 ? orm : orm / (1 + n / 30);
      const bW = n === 1 ? orm : orm * (37 - n) / 36;
      const lW = n === 1 ? orm : orm * (101.3 - 2.67123 * n) / 100;
      const avg = Math.round((eW + bW + lW) / 3);
      return { reps: n, weight: avg, pct: Math.round(avg / orm * 100) };
    });
  }, [weight, reps]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Rep Max Table</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Enter any set to estimate 1RM and project all rep maxes (Epley · Brzycki · Lander)</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Weight</label>
          <input className="input" type="number" placeholder="225" value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div>
          <label className="label">Reps Done</label>
          <select className="input" value={reps} onChange={e => setReps(e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={unit} onChange={e => setUnit(e.target.value as "lb"|"kg")}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>
      {table && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">Reps</th>
                <th className="px-4 py-2.5 text-right">{unit === "lb" ? "Pounds" : "Kilos"}</th>
                <th className="px-4 py-2.5 text-right">% 1RM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {table.map(row => (
                <tr key={row.reps} className={row.reps === parseInt(reps) ? "bg-primary-50 dark:bg-primary-900/20" : "dark:bg-gray-800/20"}>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{row.reps} {row.reps === 1 ? "rep" : "reps"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{row.weight} {unit}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VerticalJumpPowerCalc() {
  const [jumpHeight, setJumpHeight] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [unit, setUnit] = useState<"imperial"|"metric">("imperial");

  const results = useMemo(() => {
    const h  = parseFloat(jumpHeight);
    const bw = parseFloat(bodyWeight);
    if (!h || !bw || h <= 0 || bw <= 0) return null;
    const hM     = unit === "imperial" ? h * 0.0254 : h / 100;
    const massKg = unit === "imperial" ? bw * 0.453592 : bw;
    const hCm    = hM * 100;
    const lewis  = 2.21 * massKg * Math.sqrt(hM);
    const sayers = Math.max(0, 60.7 * hCm + 45.3 * massKg - 2055);
    const hIn    = unit === "imperial" ? h : h / 2.54;
    const rating =
      hIn < 16 ? { label: "Below Average", color: "text-red-500" } :
      hIn < 20 ? { label: "Average",        color: "text-orange-500" } :
      hIn < 24 ? { label: "Above Average",  color: "text-yellow-500" } :
      hIn < 28 ? { label: "Good",           color: "text-green-500" } :
      hIn < 32 ? { label: "Excellent",      color: "text-emerald-500" } :
                 { label: "Elite",          color: "text-primary-500" };
    return { lewis: Math.round(lewis), sayers: Math.round(sayers), rating };
  }, [jumpHeight, bodyWeight, unit]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Vertical Jump Power</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Peak power output in watts — Lewis and Sayers formulas</p>
      </div>
      <div className="flex gap-2">
        {(["imperial", "metric"] as const).map(u => (
          <button key={u} onClick={() => setUnit(u)} className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${unit === u ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {u === "imperial" ? "Imperial" : "Metric"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Jump Height ({unit === "imperial" ? "in" : "cm"})</label>
          <input className="input" type="number" placeholder={unit === "imperial" ? "24" : "61"} value={jumpHeight} onChange={e => setJumpHeight(e.target.value)} />
        </div>
        <div>
          <label className="label">Body Weight ({unit === "imperial" ? "lb" : "kg"})</label>
          <input className="input" type="number" placeholder={unit === "imperial" ? "185" : "84"} value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} />
        </div>
      </div>
      {results && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.lewis.toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Watts (Lewis)</div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.sayers.toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Watts (Sayers)</div>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
            <span className={`text-lg font-bold ${results.rating.color}`}>{results.rating.label}</span>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Jump Height Rating</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StrengthTab() {
  return (
    <div className="space-y-4">
      <StrengthStandardsCalc />
      <WilksDOTSCalc />
      <RepMaxCalc />
      <OneRMCalc />
      <VerticalJumpPowerCalc />
      <WorkloadCalc />
      <BarbellRackCalc />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BODY STATS TAB
// ══════════════════════════════════════════════════════════════════════

function BMICalc() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [unit,   setUnit]   = useState<UnitSystem>("imperial");
  const [bmi,    setBmi]    = useState<number | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h) return;
    const kg = unit === "imperial" ? lbToKg(w) : w;
    const m  = unit === "imperial" ? inToM(h)  : h / 100;
    setBmi(kg / (m * m));
  }, [weight, height, unit]);

  const getCategory = (b: number) => {
    if (b < 18.5) return { label: "Underweight",     color: "text-blue-500" };
    if (b < 25.0) return { label: "Normal weight",   color: "text-green-500" };
    if (b < 30.0) return { label: "Overweight",      color: "text-yellow-500" };
    if (b < 35.0) return { label: "Obese (Class I)", color: "text-orange-500" };
    if (b < 40.0) return { label: "Obese (Class II)",color: "text-red-500" };
    return                { label: "Obese (Class III)", color: "text-red-700" };
  };

  return (
    <CalcCard title="BMI Calculator" icon="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z">
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={unit === "imperial" ? "Weight (lbs)" : "Weight (kg)"}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "180" : "82"} min="1" />
        </Row>
        <Row label={unit === "imperial" ? "Height (in)" : "Height (cm)"}>
          <NumInput value={height} onChange={setHeight} placeholder={unit === "imperial" ? "70" : "178"} min="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {bmi !== null && (() => {
        const cat = getCategory(bmi);
        return (
          <div className="space-y-2">
            <ResultBox label="BMI" value={fmt(bmi, 1)} sub={cat.label} />
            <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
              {[
                ["< 18.5",     "Underweight",      "text-blue-500"],
                ["18.5 – 24.9","Normal weight",     "text-green-500"],
                ["25.0 – 29.9","Overweight",        "text-yellow-500"],
                ["30.0 – 34.9","Obese Class I",     "text-orange-500"],
                ["35.0 – 39.9","Obese Class II",    "text-red-500"],
                ["≥ 40.0",     "Obese Class III",   "text-red-700"],
              ].map(([range, label, color]) => (
                <div key={label} className={`flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0 ${
                  cat.label === label || cat.label.startsWith(label.split(" (")[0]) ? "bg-primary-50 dark:bg-primary-900/10" : ""
                }`}>
                  <span className={color as string}>{label}</span>
                  <span className="text-gray-500 dark:text-gray-400">{range}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </CalcCard>
  );
}

function WHRCalc() {
  const [waist, setWaist] = useState("");
  const [hip,   setHip]   = useState("");
  const [sex,   setSex]   = useState("male");
  const [unit,  setUnit]  = useState<UnitSystem>("imperial");
  const [ratio, setRatio] = useState<number | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(waist);
    const h = parseFloat(hip);
    if (!w || !h || h === 0) return;
    setRatio(w / h);
  }, [waist, hip]);

  const getRisk = (r: number, sex: string) => {
    if (sex === "male") {
      if (r < 0.95) return { label: "Low risk",      color: "text-green-500" };
      if (r <= 1.00) return { label: "Moderate risk", color: "text-yellow-500" };
      return               { label: "High risk",      color: "text-red-500" };
    } else {
      if (r < 0.80) return { label: "Low risk",      color: "text-green-500" };
      if (r <= 0.85) return { label: "Moderate risk", color: "text-yellow-500" };
      return                { label: "High risk",     color: "text-red-500" };
    }
  };

  const unitLabel = unit === "imperial" ? "in" : "cm";

  return (
    <CalcCard title="Waist-Hip Ratio" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select value={sex} onChange={setSex} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Waist (${unitLabel})`}>
          <NumInput value={waist} onChange={setWaist} placeholder={unit === "imperial" ? "32" : "81"} min="1" />
        </Row>
        <Row label={`Hip (${unitLabel})`}>
          <NumInput value={hip} onChange={setHip} placeholder={unit === "imperial" ? "38" : "96"} min="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {ratio !== null && (() => {
        const risk = getRisk(ratio, sex);
        return (
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="WHR" value={fmt(ratio, 3)} />
            <ResultBox label="Risk" value={risk.label} />
          </div>
        );
      })()}
    </CalcCard>
  );
}

function BodyFatGirthCalc() {
  const [height, setHeight] = useState("");
  const [neck,   setNeck]   = useState("");
  const [waist,  setWaist]  = useState("");
  const [hip,    setHip]    = useState("");
  const [weight, setWeight] = useState("");
  const [sex,    setSex]    = useState("male");
  const [unit,   setUnit]   = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ bf: number; fat: number; lbm: number } | null>(null);

  const calc = useCallback(() => {
    const h  = parseFloat(height);
    const n  = parseFloat(neck);
    const w  = parseFloat(waist);
    const hp = parseFloat(hip);
    const bw = parseFloat(weight);
    if (!h || !n || !w || !bw) return;
    if (sex === "female" && !hp) return;

    // Convert to cm if imperial
    const hCm = unit === "imperial" ? inToCm(h) : h;
    const nCm = unit === "imperial" ? inToCm(n) : n;
    const wCm = unit === "imperial" ? inToCm(w) : w;
    const hpCm= unit === "imperial" ? inToCm(hp): hp;
    const bwKg= unit === "imperial" ? lbToKg(bw): bw;

    let bf: number;
    if (sex === "male") {
      bf = 86.010 * Math.log10(wCm - nCm) - 70.041 * Math.log10(hCm) + 30.30;
    } else {
      bf = 163.205 * Math.log10(wCm + hpCm - nCm) - 97.684 * Math.log10(hCm) - 78.387;
    }
    bf = Math.max(0, Math.min(bf, 70));
    const fat = bwKg * bf / 100;
    const lbm = bwKg - fat;
    setResult({ bf, fat, lbm });
  }, [height, neck, waist, hip, weight, sex, unit]);

  const unitLabel = unit === "imperial" ? "in" : "cm";
  const wUnit     = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Body Fat (Girth Method)" icon="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4">
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select value={sex} onChange={setSex} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Height (${unitLabel})`}>
          <NumInput value={height} onChange={setHeight} placeholder={unit === "imperial" ? "70" : "178"} min="1" />
        </Row>
        <Row label={`Neck (${unitLabel})`}>
          <NumInput value={neck} onChange={setNeck} placeholder={unit === "imperial" ? "15" : "38"} min="1" />
        </Row>
        <Row label={`Waist (${unitLabel})`}>
          <NumInput value={waist} onChange={setWaist} placeholder={unit === "imperial" ? "33" : "84"} min="1" />
        </Row>
        {sex === "female" && (
          <Row label={`Hip (${unitLabel})`}>
            <NumInput value={hip} onChange={setHip} placeholder={unit === "imperial" ? "38" : "97"} min="1" />
          </Row>
        )}
        <Row label={`Body weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Body Fat %" value={`${fmt(result.bf, 1)}%`} />
          <ResultBox label="Fat mass" value={`${fmt(unit === "imperial" ? kgToLb(result.fat) : result.fat, 1)} ${wUnit}`} />
          <ResultBox label="Lean mass" value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`} />
        </div>
      )}
    </CalcCard>
  );
}

function SkinfoldCalc() {
  const [age,    setAge]    = useState("");
  const [sex,    setSex]    = useState("male");
  const [weight, setWeight] = useState("");
  const [unit,   setUnit]   = useState<UnitSystem>("imperial");
  // Male sites: chest, abdomen, thigh
  const [s1, setS1] = useState(""); const [s2, setS2] = useState(""); const [s3, setS3] = useState("");
  const [result, setResult] = useState<{ bd: number; bf: number; fat: number; lbm: number } | null>(null);

  const calc = useCallback(() => {
    const a = parseFloat(age);
    const sf1 = parseFloat(s1), sf2 = parseFloat(s2), sf3 = parseFloat(s3);
    const bw  = parseFloat(weight);
    if (!a || !sf1 || !sf2 || !sf3 || !bw) return;
    const S = sf1 + sf2 + sf3;
    let bd: number;
    if (sex === "male") {
      bd = 1.10938 - (0.0008267 * S) + (0.0000016 * S * S) - (0.0002574 * a);
    } else {
      bd = 1.0994921 - (0.0009929 * S) + (0.0000023 * S * S) - (0.0001392 * a);
    }
    const bf  = ((4.95 / bd) - 4.50) * 100;
    const bwKg= unit === "imperial" ? lbToKg(bw) : bw;
    const fat = bwKg * bf / 100;
    const lbm = bwKg - fat;
    setResult({ bd, bf: Math.max(0, bf), fat, lbm });
  }, [age, sex, s1, s2, s3, weight, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  const sites = sex === "male"
    ? ["Chest (mm)", "Abdomen (mm)", "Thigh (mm)"]
    : ["Tricep (mm)", "Suprailiac (mm)", "Thigh (mm)"];

  return (
    <CalcCard title="Body Composition (3-Site Skinfold)" icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 10h.01M12 10h.01M15 10h.01M9 13h.01M12 13h.01M15 13h.01M4 6h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10-4H10v4h4V2z">
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select value={sex} onChange={setSex} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="25" min="1" max="120" step="1" />
        </Row>
        <Row label={`Body weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "180" : "82"} min="1" />
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Jackson-Pollock 3-site sites</p>
      <div className="grid grid-cols-3 gap-3">
        {[sites[0], sites[1], sites[2]].map((site, i) => (
          <Row key={site} label={site}>
            <NumInput
              value={i === 0 ? s1 : i === 1 ? s2 : s3}
              onChange={i === 0 ? setS1 : i === 1 ? setS2 : setS3}
              placeholder="12"
              min="1"
            />
          </Row>
        ))}
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <ResultBox label="Body Fat %" value={`${fmt(result.bf, 1)}%`} />
            <ResultBox label="Fat mass"   value={`${fmt(unit === "imperial" ? kgToLb(result.fat) : result.fat, 1)} ${wUnit}`} />
            <ResultBox label="Lean mass"  value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`} />
          </div>
          {/* Classification */}
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">{sex === "male" ? "Male" : "Female"} body fat norms</p>
            </div>
            {(sex === "male"
              ? [["2–5%","Essential fat"],["6–13%","Athletes"],["14–17%","Fitness"],["18–24%","Acceptable"],["≥ 25%","Obese"]]
              : [["10–13%","Essential fat"],["14–20%","Athletes"],["21–24%","Fitness"],["25–31%","Acceptable"],["≥ 32%","Obese"]]
            ).map(([range, label]) => (
              <div key={label} className="flex justify-between px-3 py-1.5 text-caption border-b border-gray-100 dark:border-white/5 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-gray-500 dark:text-gray-400">{range}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CalcCard>
  );
}

// ── Ideal Body Weight ────────────────────────────────────────────────────
function IdealBodyWeightCalc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const result = useMemo(() => {
    let totalInches: number;
    if (unit === "imperial") {
      const ft = parseFloat(heightFt) || 0;
      const ins = parseFloat(heightIn) || 0;
      totalInches = ft * 12 + ins;
    } else {
      const cm = parseFloat(heightCm);
      if (!cm) return null;
      totalInches = cm / 2.54;
    }
    if (!totalInches || totalInches < 24) return null;
    const excess = totalInches - 60;
    const male = sex === "male";
    const devineKg   = male ? 50 + 2.3 * excess   : 45.5 + 2.3 * excess;
    const robinsonKg = male ? 52 + 1.9 * excess   : 49   + 1.7 * excess;
    const millerKg   = male ? 56.2 + 1.41 * excess : 53.1 + 1.36 * excess;
    const hamwiKg    = male ? (106 + 6 * excess) / 2.205 : (100 + 5 * excess) / 2.205;
    const avgKg = (devineKg + robinsonKg + millerKg + hamwiKg) / 4;
    const conv = (kg: number) => unit === "imperial" ? kgToLb(kg) : kg;
    return { devine: conv(devineKg), robinson: conv(robinsonKg), miller: conv(millerKg), hamwi: conv(hamwiKg), avg: conv(avgKg) };
  }, [sex, unit, heightFt, heightIn, heightCm]);

  const u = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Ideal Body Weight" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
      <div className="flex gap-3 flex-wrap">
        <Select value={sex} onChange={(v) => setSex(v as "male" | "female")} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      {unit === "imperial" ? (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Height (ft)"><NumInput value={heightFt} onChange={setHeightFt} placeholder="5" min="1" max="8" step="1" /></Row>
          <Row label="Height (in)"><NumInput value={heightIn} onChange={setHeightIn} placeholder="10" min="0" max="11" step="1" /></Row>
        </div>
      ) : (
        <Row label="Height (cm)"><NumInput value={heightCm} onChange={setHeightCm} placeholder="178" min="50" /></Row>
      )}
      {result && (
        <div className="space-y-2">
          <ResultBox label="Average (all formulas)" value={`${fmt(result.avg, 0)} ${u}`} sub="Recommended reference point" />
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Devine"   value={`${fmt(result.devine, 0)} ${u}`} />
            <ResultBox label="Robinson" value={`${fmt(result.robinson, 0)} ${u}`} />
            <ResultBox label="Miller"   value={`${fmt(result.miller, 0)} ${u}`} />
            <ResultBox label="Hamwi"    value={`${fmt(result.hamwi, 0)} ${u}`} />
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Devine, Robinson, Miller, Hamwi formulas · Reference ranges only, not a health target</p>
    </CalcCard>
  );
}

// ── Fitness Testing Scores ────────────────────────────────────────────
// Thresholds: [poor_max, fair_max, avg_max, good_max] → above good_max = Excellent
const PUSHUP_NORMS: Record<"male"|"female", {ageMin:number;ageMax:number;t:number[]}[]> = {
  male: [
    {ageMin:15,ageMax:19,t:[17,22,28,38]},
    {ageMin:20,ageMax:29,t:[16,21,28,35]},
    {ageMin:30,ageMax:39,t:[11,16,21,29]},
    {ageMin:40,ageMax:49,t:[9,12,16,21]},
    {ageMin:50,ageMax:59,t:[6,9,12,20]},
    {ageMin:60,ageMax:99,t:[4,7,10,17]},
  ],
  female: [
    {ageMin:15,ageMax:19,t:[11,17,24,32]},
    {ageMin:20,ageMax:29,t:[9,14,20,29]},
    {ageMin:30,ageMax:39,t:[7,12,19,26]},
    {ageMin:40,ageMax:49,t:[4,10,14,23]},
    {ageMin:50,ageMax:59,t:[1,6,10,20]},
    {ageMin:60,ageMax:99,t:[1,4,11,16]},
  ],
};

const SITUP_NORMS: Record<"male"|"female", {ageMin:number;ageMax:number;t:number[]}[]> = {
  male: [
    {ageMin:15,ageMax:19,t:[32,37,41,47]},
    {ageMin:20,ageMax:29,t:[28,32,36,42]},
    {ageMin:30,ageMax:39,t:[21,26,30,35]},
    {ageMin:40,ageMax:49,t:[16,21,25,30]},
    {ageMin:50,ageMax:59,t:[12,17,21,25]},
    {ageMin:60,ageMax:99,t:[7,11,16,22]},
  ],
  female: [
    {ageMin:15,ageMax:19,t:[26,31,35,41]},
    {ageMin:20,ageMax:29,t:[20,24,30,35]},
    {ageMin:30,ageMax:39,t:[14,19,23,28]},
    {ageMin:40,ageMax:49,t:[6,14,19,24]},
    {ageMin:50,ageMax:59,t:[4,9,13,19]},
    {ageMin:60,ageMax:99,t:[1,5,10,16]},
  ],
};

const FITNESS_CATS = ["Poor","Fair","Average","Good","Excellent"];
const FITNESS_COLORS_BG = ["bg-red-400","bg-orange-400","bg-yellow-400","bg-green-400","bg-primary-500"];

function getFitnessCat(score: number, thresholds: number[]): number {
  if (score <= thresholds[0]) return 0;
  if (score <= thresholds[1]) return 1;
  if (score <= thresholds[2]) return 2;
  if (score <= thresholds[3]) return 3;
  return 4;
}

function FitnessTestingCalc() {
  const [test, setTest] = useState<"pushup"|"situp">("pushup");
  const [sex, setSex] = useState<"male"|"female">("male");
  const [age, setAge] = useState("");
  const [reps, setReps] = useState("");

  const result = useMemo(() => {
    const a = parseInt(age);
    const r = parseInt(reps);
    if (!a || !r || a < 15 || a > 99) return null;
    const norms = test === "pushup" ? PUSHUP_NORMS : SITUP_NORMS;
    const row = norms[sex].find(n => a >= n.ageMin && a <= n.ageMax);
    if (!row) return null;
    return { catIdx: getFitnessCat(r, row.t), thresholds: row.t };
  }, [test, sex, age, reps]);

  return (
    <CalcCard title="Fitness Testing Scores" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4">
      <div className="flex gap-2 flex-wrap">
        {(["pushup","situp"] as const).map(t => (
          <button key={t} onClick={() => setTest(t)}
            className={`px-3 py-3 rounded-lg min-h-[44px] text-xs font-medium transition-colors ${test === t ? "bg-primary-500 text-white" : "bg-surface-100 dark:bg-surface-700 text-gray-600 dark:text-gray-300"}`}>
            {t === "pushup" ? "Push-up" : "Sit-up (1 min)"}
          </button>
        ))}
      </div>
      <Select value={sex} onChange={(v) => setSex(v as "male"|"female")} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="35" min="15" max="99" step="1" />
        </Row>
        <Row label={test === "pushup" ? "Push-ups completed" : "Sit-ups in 1 min"}>
          <NumInput value={reps} onChange={setReps} placeholder="25" min="0" step="1" />
        </Row>
      </div>
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your rating</span>
            <span className={`text-sm font-bold px-3 py-1 rounded-full text-white ${FITNESS_COLORS_BG[result.catIdx]}`}>
              {FITNESS_CATS[result.catIdx]}
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${FITNESS_COLORS_BG[result.catIdx]}`}
              style={{ width: `${((result.catIdx + 1) / 5) * 100}%` }} />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="grid grid-cols-5 text-xs">
              {FITNESS_CATS.map((cat, i) => (
                <div key={cat} className={`px-1 py-2.5 text-center border-r border-gray-200/40 dark:border-white/5 last:border-0 ${i === result.catIdx ? "bg-primary-500/10 dark:bg-primary-400/10 font-bold text-primary-600 dark:text-primary-300" : "text-gray-500 dark:text-gray-400"}`}>
                  <div className="font-medium leading-tight">{cat}</div>
                  <div className="text-gray-400 mt-0.5 text-[10px]">
                    {i === 0 ? `≤${result.thresholds[0]}` :
                     i === 4 ? `${result.thresholds[3]+1}+` :
                     `${result.thresholds[i-1]+1}–${result.thresholds[i]}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {test === "pushup" ? "ACSM norms · Males: full push-up · Females: modified (knee push-up)" : "ACSM norms · Timed 1-minute sit-up test"}
      </p>
    </CalcCard>
  );
}

// ── Jackson-Pollock 7-Site Skinfold ──────────────────────────────────
const JP7_SITES = ["chest","midaxillary","tricep","subscapular","abdomen","suprailiac","thigh"] as const;
type JP7Site = (typeof JP7_SITES)[number];
const JP7_LABELS: Record<JP7Site, string> = {
  chest:"Chest", midaxillary:"Midaxillary", tricep:"Tricep",
  subscapular:"Subscapular", abdomen:"Abdomen", suprailiac:"Suprailiac", thigh:"Thigh",
};

function Skinfold7Calc() {
  const [sex, setSex] = useState<"male"|"female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [sites, setSites] = useState<Record<JP7Site,string>>({
    chest:"", midaxillary:"", tricep:"", subscapular:"", abdomen:"", suprailiac:"", thigh:"",
  });

  const result = useMemo(() => {
    const a = parseFloat(age);
    const w = parseFloat(weight);
    const vals = JP7_SITES.map(s => parseFloat(sites[s]));
    if (!a || !w || vals.some(isNaN)) return null;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const density = sex === "male"
      ? 1.112 - 0.00043499*sum + 0.00000055*sum*sum - 0.00028826*a
      : 1.097 - 0.00046971*sum + 0.00000056*sum*sum - 0.00012828*a;
    const bf = (4.95 / density - 4.5) * 100;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const fatMass = wKg * bf / 100;
    const lbm = wKg - fatMass;
    return { bf, fatMass, lbm, sum };
  }, [sex, unit, age, weight, sites]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Body Fat — JP 7-Site Skinfold" icon="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z">
      <div className="flex gap-3 flex-wrap">
        <Select value={sex} onChange={(v) => setSex(v as "male"|"female")} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)"><NumInput value={age} onChange={setAge} placeholder="30" min="1" max="99" step="1" /></Row>
        <Row label={`Weight (${wUnit})`}><NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" /></Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Skinfold measurements (mm) — all 7 sites required</p>
      <div className="grid grid-cols-2 gap-3">
        {JP7_SITES.map(site => (
          <Row key={site} label={JP7_LABELS[site]}>
            <NumInput value={sites[site]} onChange={v => setSites(p => ({...p, [site]: v}))} placeholder="15" min="1" step="0.5" />
          </Row>
        ))}
      </div>
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <ResultBox label="Body Fat %" value={`${fmt(result.bf, 1)}%`} />
            <ResultBox label="Fat mass" value={`${fmt(unit === "imperial" ? kgToLb(result.fatMass) : result.fatMass, 1)} ${wUnit}`} />
            <ResultBox label="Lean mass" value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`} />
          </div>
          <ResultBox label="7-site sum" value={`${fmt(result.sum, 1)} mm`} sub="Total of all 7 measurements" />
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Jackson & Pollock (1978) 7-site formula · Siri equation · More accurate than 3-site</p>
    </CalcCard>
  );
}

function BodyStatsTab() {
  return (
    <div className="space-y-4">
      <FitnessTestingCalc />
      <IdealBodyWeightCalc />
      <BMICalc />
      <WHRCalc />
      <BodyFatGirthCalc />
      <Skinfold7Calc />
      <SkinfoldCalc />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CARDIO TAB
// ══════════════════════════════════════════════════════════════════════

function TargetHRCalc() {
  const [age,        setAge]        = useState("");
  const [restHR,     setRestHR]     = useState("");
  const [intensityLo, setIntensityLo] = useState("60");
  const [intensityHi, setIntensityHi] = useState("85");
  const [result, setResult] = useState<{
    maxHR: number;
    pctLo: number; pctHi: number;
    karLo: number; karHi: number;
  } | null>(null);

  const calc = useCallback(() => {
    const a  = parseFloat(age);
    const rhr= parseFloat(restHR);
    const lo = parseFloat(intensityLo) / 100;
    const hi = parseFloat(intensityHi) / 100;
    if (!a) return;
    const maxHR = 220 - a;
    const pctLo = maxHR * lo;
    const pctHi = maxHR * hi;
    const HRR   = rhr ? maxHR - rhr : 0;
    const karLo = rhr ? HRR * lo + rhr : 0;
    const karHi = rhr ? HRR * hi + rhr : 0;
    setResult({ maxHR, pctLo, pctHi, karLo, karHi });
  }, [age, restHR, intensityLo, intensityHi]);

  return (
    <CalcCard title="Target Heart Rate" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="30" min="1" max="120" step="1" />
        </Row>
        <Row label="Resting HR (bpm) — optional">
          <NumInput value={restHR} onChange={setRestHR} placeholder="60" min="20" max="120" step="1" />
        </Row>
        <Row label="Intensity low (%)">
          <NumInput value={intensityLo} onChange={setIntensityLo} placeholder="60" min="1" max="100" step="1" />
        </Row>
        <Row label="Intensity high (%)">
          <NumInput value={intensityHi} onChange={setIntensityHi} placeholder="85" min="1" max="100" step="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <ResultBox label="Estimated Max HR" value={`${Math.round(result.maxHR)} bpm`} sub="220 − age" />
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="% HRmax range" value={`${Math.round(result.pctLo)}–${Math.round(result.pctHi)} bpm`} />
            {result.karLo > 0 && (
              <ResultBox label="Karvonen (HRR)" value={`${Math.round(result.karLo)}–${Math.round(result.karHi)} bpm`} />
            )}
          </div>
          {!restHR && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Enter resting HR for Karvonen method</p>
          )}
        </div>
      )}
    </CalcCard>
  );
}

function VerticalJumpCalc() {
  const [weight, setWeight] = useState("");
  const [jump,   setJump]   = useState("");
  const [unit,   setUnit]   = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ lewis: number; sayers: number; harmanPeak: number; harmanMean: number } | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const j = parseFloat(jump);
    if (!w || !j) return;
    const wKg  = unit === "imperial" ? lbToKg(w) : w;
    const jCm  = unit === "imperial" ? inToCm(j) : j;
    const jM   = jCm / 100;
    const lewis     = 2.21 * wKg * Math.sqrt(jM);
    const sayers    = (60.7 * jCm) + (45.3 * wKg) - 2055;
    const harmanPeak= (61.9 * jCm) + (36.0 * wKg) - 1822;
    const harmanMean= (21.2 * jCm) + (23.0 * wKg) - 1393;
    setResult({ lewis, sayers, harmanPeak, harmanMean });
  }, [weight, jump, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const jUnit = unit === "imperial" ? "in" : "cm";

  return (
    <CalcCard title="Vertical Jump Power" icon="M13 10V3L4 14h7v7l9-11h-7z">
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Body weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
        </Row>
        <Row label={`Jump height (${jUnit})`}>
          <NumInput value={jump} onChange={setJump} placeholder={unit === "imperial" ? "24" : "61"} min="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Lewis formula" value={`${fmt(result.lewis, 0)} W`} />
          <ResultBox label="Sayers peak"  value={`${fmt(Math.max(0,result.sayers), 0)} W`} />
          <ResultBox label="Harman peak"  value={`${fmt(Math.max(0,result.harmanPeak), 0)} W`} />
          <ResultBox label="Harman mean"  value={`${fmt(Math.max(0,result.harmanMean), 0)} W`} />
        </div>
      )}
    </CalcCard>
  );
}

function SprintCalc() {
  const [distance, setDistance] = useState("");
  const [distUnit, setDistUnit] = useState("yards");
  const [time,     setTime]     = useState("");
  const [result, setResult] = useState<{ mps: number; mph: number; kph: number } | null>(null);

  const calc = useCallback(() => {
    const d = parseFloat(distance);
    const t = parseFloat(time);
    if (!d || !t || t === 0) return;
    const dm = distUnit === "yards" ? d * 0.9144 : distUnit === "feet" ? d * 0.3048 : d;
    const mps = dm / t;
    setResult({ mps, mph: mps * 2.23694, kph: mps * 3.6 });
  }, [distance, distUnit, time]);

  return (
    <CalcCard title="Sprint Speed" icon="M13 10V3L4 14h7v7l9-11h-7z">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Distance">
          <NumInput value={distance} onChange={setDistance} placeholder="40" min="1" />
        </Row>
        <Row label="Unit">
          <Select value={distUnit} onChange={setDistUnit} options={[
            {value:"yards", label:"Yards"},
            {value:"meters",label:"Meters"},
            {value:"feet",  label:"Feet"},
          ]} />
        </Row>
        <Row label="Time (seconds)">
          <NumInput value={time} onChange={setTime} placeholder="4.5" min="0.1" step="0.01" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Speed"   value={`${fmt(result.mps, 2)} m/s`} />
          <ResultBox label="Speed"   value={`${fmt(result.mph, 2)} mph`} />
          <ResultBox label="Speed"   value={`${fmt(result.kph, 2)} km/h`} />
        </div>
      )}
    </CalcCard>
  );
}

// ── MET & Calorie Burn Calculator (ACSM equations) ──────────────────

type MachineType = "treadmill" | "bike" | "elliptical" | "rower" | "stairclimber";

// Approximate resistance-level → watts mapping for common cardio machines.
// Based on typical commercial gym equipment at ~80 RPM / normal stride.
// These are estimates — wattage display is always more accurate.
function resistanceToWatts(level: number, machine: MachineType): number {
  const clamped = Math.max(1, Math.min(20, level));
  switch (machine) {
    case "bike":         return Math.round(10 + (clamped - 1) * 13.5);   // ~10–269 W
    case "elliptical":   return Math.round(30 + (clamped - 1) * 16);     // ~30–334 W
    case "rower":        return Math.round(50 + (clamped - 1) * 15);     // ~50–335 W
    case "stairclimber": return Math.round(40 + (clamped - 1) * 14);     // ~40–306 W
    default:             return Math.round(10 + (clamped - 1) * 13.5);
  }
}

// ACSM treadmill metabolic equations
// walking: < 3.7 mph (100 m/min); running: ≥ 3.7 mph
function treadmillVO2(speedMph: number, gradePct: number): number {
  const speedMmin = speedMph * 26.82; // convert mph → m/min
  const grade = gradePct / 100;
  if (speedMmin < 100) {
    // Walking equation
    return 0.1 * speedMmin + 1.8 * speedMmin * grade + 3.5;
  } else {
    // Running equation
    return 0.2 * speedMmin + 0.9 * speedMmin * grade + 3.5;
  }
}

// ACSM leg-ergometry equation for watts → VO2 (mL/kg/min)
// Valid for bike, elliptical, rower, stair climber (leg-dominant).
// VO2 (mL/min) = 1.8 × (watts × 6.12) + 7 × weight_kg  (1 W ≈ 6.12 kgm/min)
function machineVO2(watts: number, weightKg: number): number {
  const workRateKgmMin = watts * 6.12;
  return (1.8 * workRateKgmMin) / weightKg + 7;
}

function METCalorieCalc() {
  const [machine,    setMachine]    = useState<MachineType>("treadmill");
  const [unit,       setUnit]       = useState<UnitSystem>("imperial");
  const [weight,     setWeight]     = useState("");
  const [duration,   setDuration]   = useState("");
  // Treadmill inputs
  const [speed,      setSpeed]      = useState("");
  const [incline,    setIncline]    = useState("0");
  // Machine inputs
  const [inputMode,  setInputMode]  = useState<"watts" | "resistance">("resistance");
  const [watts,      setWatts]      = useState("");
  const [resistance, setResistance] = useState("");

  const [result, setResult] = useState<{
    vo2: number; met: number; calPerMin: number; totalCal: number;
    intensity: string; zone: string; zoneColor: string;
    watts?: number; isEstimated?: boolean;
  } | null>(null);

  const getIntensity = (met: number) => {
    if (met < 3)  return { label: "Light",    zone: "< 3 METs",  color: "text-blue-400" };
    if (met < 6)  return { label: "Moderate", zone: "3–6 METs",  color: "text-green-400" };
    if (met < 9)  return { label: "Vigorous", zone: "6–9 METs",  color: "text-yellow-400" };
    if (met < 12) return { label: "Very High",zone: "9–12 METs", color: "text-orange-400" };
    return              { label: "Maximum",   zone: "> 12 METs", color: "text-red-400" };
  };

  const calc = useCallback(() => {
    const w   = parseFloat(weight);
    const dur = parseFloat(duration);
    if (!w || !dur) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;

    let vo2 = 0;
    let usedWatts: number | undefined;
    let isEstimated = false;

    if (machine === "treadmill") {
      const sp = parseFloat(speed);
      const gr = parseFloat(incline) || 0;
      if (!sp) return;
      const spMph = unit === "imperial" ? sp : sp / 1.60934; // convert kph → mph if metric
      vo2 = treadmillVO2(spMph, gr);
    } else {
      if (inputMode === "watts") {
        const w2 = parseFloat(watts);
        if (!w2) return;
        usedWatts = w2;
        vo2 = machineVO2(w2, wKg);
      } else {
        const lvl = parseFloat(resistance);
        if (!lvl) return;
        usedWatts = resistanceToWatts(lvl, machine);
        isEstimated = true;
        vo2 = machineVO2(usedWatts, wKg);
      }
    }

    const met       = vo2 / 3.5;
    const calPerMin = (met * wKg) / 60;   // kcal/min  (1 MET = 1 kcal/kg/hr)
    const totalCal  = calPerMin * dur;
    const { label, zone, color } = getIntensity(met);

    setResult({ vo2, met, calPerMin, totalCal, intensity: label, zone, zoneColor: color, watts: usedWatts, isEstimated });
  }, [machine, unit, weight, duration, speed, incline, inputMode, watts, resistance]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const sUnit = machine === "treadmill" ? (unit === "imperial" ? "mph" : "km/h") : "";

  const machineOptions = [
    { value: "treadmill",    label: "Treadmill" },
    { value: "bike",         label: "Stationary Bike" },
    { value: "elliptical",   label: "Elliptical" },
    { value: "rower",        label: "Rowing Machine" },
    { value: "stairclimber", label: "Stair Climber" },
  ];

  return (
    <CalcCard
      title="MET &amp; Calorie Burn"
      icon="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
    >
      {/* Row 1: machine + units */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={machine}
          onChange={(v) => setMachine(v as MachineType)}
          options={machineOptions}
        />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>

      {/* Treadmill inputs */}
      {machine === "treadmill" && (
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Speed (${sUnit})`}>
            <NumInput value={speed} onChange={setSpeed} placeholder={unit === "imperial" ? "6.0" : "9.7"} min="0.5" step="0.1" />
          </Row>
          <Row label="Incline (%)">
            <NumInput value={incline} onChange={setIncline} placeholder="0" min="0" max="40" step="0.5" />
          </Row>
        </div>
      )}

      {/* Machine inputs */}
      {machine !== "treadmill" && (
        <div className="space-y-3">
          {/* Watts vs resistance toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 w-fit">
            {(["resistance", "watts"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setInputMode(m)}
                className={`px-3 py-1.5 text-caption font-medium transition-colors capitalize ${
                  inputMode === m
                    ? "bg-primary-500 text-white"
                    : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                {m === "resistance" ? "Resistance Level" : "Watts (accurate)"}
              </button>
            ))}
          </div>

          {inputMode === "resistance" ? (
            <div className="space-y-1.5">
              <Row label="Resistance level (1–20)">
                <NumInput value={resistance} onChange={setResistance} placeholder="10" min="1" max="20" step="1" />
              </Row>
              <p className="text-caption text-amber-500 dark:text-amber-400">
                ⚠ Approximate — resistance levels vary by machine brand. Use watts for accuracy.
              </p>
            </div>
          ) : (
            <Row label="Watts (from machine display)">
              <NumInput value={watts} onChange={setWatts} placeholder="150" min="1" step="1" />
            </Row>
          )}
        </div>
      )}

      {/* Shared: weight + duration */}
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Body weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
        </Row>
        <Row label="Duration (minutes)">
          <NumInput value={duration} onChange={setDuration} placeholder="45" min="1" step="1" />
        </Row>
      </div>

      <CalcButton onClick={calc} />

      {result && (
        <div className="space-y-3">
          {/* Primary results */}
          <div className="grid grid-cols-3 gap-2">
            <ResultBox
              label="METs"
              value={fmt(result.met, 1)}
              sub={`${result.intensity} · ${result.zone}`}
            />
            <ResultBox
              label="Cal / min"
              value={`${fmt(result.calPerMin, 1)} kcal`}
              sub="Based on your weight"
            />
            <ResultBox
              label="Total calories"
              value={`${fmt(result.totalCal, 0)} kcal`}
              sub={`for ${duration} min`}
            />
          </div>

          {/* Watts used (machine mode) */}
          {result.watts !== undefined && (
            <div className={`rounded-xl px-3.5 py-2.5 text-caption ${
              result.isEstimated
                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30"
                : "bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5"
            }`}>
              <span className={result.isEstimated ? "text-amber-700 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"}>
                {result.isEstimated ? "⚠ Estimated " : ""}Wattage used: <strong>{result.watts} W</strong>
                {result.isEstimated && " (from resistance level — use watts mode for exact results)"}
              </span>
            </div>
          )}

          {/* Intensity zone strip */}
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">Intensity zones (ACSM)</p>
            </div>
            {[
              ["< 3",    "Light",     "text-blue-400",   result.met < 3],
              ["3–6",    "Moderate",  "text-green-400",  result.met >= 3 && result.met < 6],
              ["6–9",    "Vigorous",  "text-yellow-400", result.met >= 6 && result.met < 9],
              ["9–12",   "Very High", "text-orange-400", result.met >= 9 && result.met < 12],
              ["> 12",   "Maximum",   "text-red-400",    result.met >= 12],
            ].map(([range, label, color, active]) => (
              <div
                key={label as string}
                className={`flex justify-between items-center px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0 ${
                  active ? "bg-primary-50 dark:bg-primary-900/10" : ""
                }`}
              >
                <span className={`font-medium ${color as string}`}>{label as string}</span>
                <span className="text-gray-500 dark:text-gray-400">{range as string} METs</span>
                {active && (
                  <span className="text-caption bg-primary-500 text-white rounded-full px-2 py-0.5 ml-auto">← You</span>
                )}
              </div>
            ))}
          </div>

          {/* Formula note */}
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {machine === "treadmill"
              ? `ACSM ${parseFloat(speed) * (unit === "metric" ? 1/1.60934 : 1) < 3.7 ? "walking" : "running"} metabolic equation · VO₂ = ${
                  parseFloat(speed) * (unit === "metric" ? 1/1.60934 : 1) < 3.7
                    ? "0.1×speed + 1.8×speed×grade + 3.5"
                    : "0.2×speed + 0.9×speed×grade + 3.5"
                }`
              : "ACSM leg-ergometry equation · VO₂ = 1.8×(W×6.12) / kg + 7"
            }
          </p>
        </div>
      )}
    </CalcCard>
  );
}

// ── VO₂max Field Tests ───────────────────────────────────────────────────
function getVO2Category(vo2: number, sex: "male" | "female"): string {
  const male = sex === "male";
  if (vo2 >= (male ? 60 : 55)) return "Superior";
  if (vo2 >= (male ? 52 : 46)) return "Excellent";
  if (vo2 >= (male ? 45 : 38)) return "Good";
  if (vo2 >= (male ? 38 : 31)) return "Fair";
  if (vo2 >= (male ? 30 : 24)) return "Poor";
  return "Very Poor";
}

function VO2MaxCalc() {
  const [test, setTest] = useState<"cooper" | "mile5" | "rockport">("cooper");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [distCooper, setDistCooper] = useState("");
  const [m5m, setM5m] = useState("");
  const [m5s, setM5s] = useState("");
  const [rockM, setRockM] = useState("");
  const [rockS, setRockS] = useState("");
  const [rockHR, setRockHR] = useState("");
  const [result, setResult] = useState<{ vo2: number; cat: string } | null>(null);

  function calc() {
    setResult(null);
    if (test === "cooper") {
      const dist = parseFloat(distCooper);
      if (!dist) return;
      const distM = unit === "imperial" ? dist * 1609.34 : dist * 1000;
      const vo2 = Math.max(0, (distM - 504.9) / 44.73);
      setResult({ vo2, cat: getVO2Category(vo2, sex) });
    } else if (test === "mile5") {
      const mins = (parseFloat(m5m) || 0) + (parseFloat(m5s) || 0) / 60;
      if (!mins) return;
      const vo2 = Math.max(0, 483 / mins + 3.5);
      setResult({ vo2, cat: getVO2Category(vo2, sex) });
    } else {
      const mins = (parseFloat(rockM) || 0) + (parseFloat(rockS) || 0) / 60;
      const hr = parseFloat(rockHR);
      const ageN = parseFloat(age);
      const wt = parseFloat(weight);
      if (!mins || !hr || !ageN || !wt) return;
      const wtLb = unit === "imperial" ? wt : kgToLb(wt);
      const vo2 = Math.max(0, 132.853 - 0.0769 * wtLb - 0.3877 * ageN + 6.315 * (sex === "male" ? 1 : 0) - 3.2649 * mins - 0.1565 * hr);
      setResult({ vo2, cat: getVO2Category(vo2, sex) });
    }
  }

  const distUnit = unit === "imperial" ? "miles" : "km";
  const wtUnit   = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="VO₂max Field Tests" icon="M13 10V3L4 14h7v7l9-11h-7z">
      <div className="flex gap-2 flex-wrap">
        {(["cooper", "mile5", "rockport"] as const).map(t => (
          <button key={t} onClick={() => { setTest(t); setResult(null); }}
            className={`px-3 py-3 rounded-lg min-h-[44px] text-xs font-medium transition-colors ${test === t ? "bg-primary-500 text-white" : "bg-surface-100 dark:bg-surface-700 text-gray-600 dark:text-gray-300"}`}>
            {t === "cooper" ? "Cooper 12-min" : t === "mile5" ? "1.5-Mile Run" : "Rockport Walk"}
          </button>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Select value={sex} onChange={(v) => { setSex(v as "male" | "female"); setResult(null); }} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
        <UnitToggle value={unit} onChange={(v) => { setUnit(v); setResult(null); }} />
      </div>

      {test === "cooper" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">Run as far as possible in 12 minutes. Enter total distance covered.</p>
          <Row label={`Distance covered (${distUnit})`}>
            <NumInput value={distCooper} onChange={setDistCooper} placeholder={unit === "imperial" ? "1.5" : "2.4"} min="0.1" step="0.01" />
          </Row>
        </>
      )}

      {test === "mile5" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">Run 1.5 miles as fast as possible on a measured course.</p>
          <p className="label text-gray-500 dark:text-gray-400">Finish time</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Minutes"><NumInput value={m5m} onChange={setM5m} placeholder="12" min="0" step="1" /></Row>
            <Row label="Seconds"><NumInput value={m5s} onChange={setM5s} placeholder="30" min="0" max="59" step="1" /></Row>
          </div>
        </>
      )}

      {test === "rockport" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">Walk 1 mile as fast as possible. Record time and HR immediately after finishing.</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Age (years)"><NumInput value={age} onChange={setAge} placeholder="35" min="18" max="99" step="1" /></Row>
            <Row label={`Weight (${wtUnit})`}><NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" /></Row>
          </div>
          <p className="label text-gray-500 dark:text-gray-400">Walk time</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Minutes"><NumInput value={rockM} onChange={setRockM} placeholder="14" min="0" step="1" /></Row>
            <Row label="Seconds"><NumInput value={rockS} onChange={setRockS} placeholder="45" min="0" max="59" step="1" /></Row>
          </div>
          <Row label="Heart rate immediately after (bpm)">
            <NumInput value={rockHR} onChange={setRockHR} placeholder="130" min="40" max="220" step="1" />
          </Row>
        </>
      )}

      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="VO₂max" value={`${fmt(result.vo2, 1)} mL/kg/min`} sub="Estimated" />
          <ResultBox label="Category" value={result.cat} sub="Based on sex" />
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {test === "cooper"  ? "Cooper (1968) · VO₂max = (distance m − 504.9) / 44.73" :
         test === "mile5"   ? "George et al. (1993) · VO₂max = 483 / time(min) + 3.5" :
                              "Kline et al. (1987) Rockport 1-Mile Walk Test"}
      </p>
    </CalcCard>
  );
}

const HR_ZONES = [
  { name: "Zone 1", label: "Recovery",     pctLow: 0.50, pctHigh: 0.60, color: "bg-blue-400" },
  { name: "Zone 2", label: "Aerobic Base", pctLow: 0.60, pctHigh: 0.70, color: "bg-green-400" },
  { name: "Zone 3", label: "Aerobic",      pctLow: 0.70, pctHigh: 0.80, color: "bg-yellow-400" },
  { name: "Zone 4", label: "Threshold",    pctLow: 0.80, pctHigh: 0.90, color: "bg-orange-400" },
  { name: "Zone 5", label: "VO₂max",       pctLow: 0.90, pctHigh: 1.00, color: "bg-red-500" },
];

function HeartRateZoneCalc() {
  const [ageInput,   setAgeInput]   = useState("");
  const [maxHRInput, setMaxHRInput] = useState("");
  const [restHR,     setRestHR]     = useState("");
  const [method, setMethod] = useState<"karvonen"|"percent">("karvonen");

  const results = useMemo(() => {
    const age = parseFloat(ageInput);
    const rhr = parseFloat(restHR);
    let mhr   = parseFloat(maxHRInput);
    if (!mhr && age) mhr = 220 - age;
    if (!mhr) return null;
    return HR_ZONES.map(z => {
      const useKarvonen = method === "karvonen" && rhr > 0;
      const low  = useKarvonen ? Math.round((mhr - rhr) * z.pctLow  + rhr) : Math.round(mhr * z.pctLow);
      const high = useKarvonen ? Math.round((mhr - rhr) * z.pctHigh + rhr) : Math.round(mhr * z.pctHigh);
      return { ...z, low, high };
    });
  }, [ageInput, maxHRInput, restHR, method]);

  const estimatedMax = ageInput && !maxHRInput ? Math.round(220 - parseFloat(ageInput)) : null;

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Heart Rate Zones</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">5 training zones via Karvonen (HRR) or % max HR</p>
      </div>
      <div className="flex gap-2">
        {(["karvonen", "percent"] as const).map(m => (
          <button key={m} onClick={() => setMethod(m)} className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${method === m ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {m === "karvonen" ? "Karvonen" : "% Max HR"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Age</label>
          <input className="input" type="number" placeholder="25" value={ageInput} onChange={e => setAgeInput(e.target.value)} />
        </div>
        <div>
          <label className="label">
            Max HR{estimatedMax ? <span className="normal-case font-normal text-gray-400 ml-1">(est. {estimatedMax})</span> : ""}
          </label>
          <input className="input" type="number" placeholder={estimatedMax ? String(estimatedMax) : "195"} value={maxHRInput} onChange={e => setMaxHRInput(e.target.value)} />
        </div>
        <div>
          <label className="label">Resting HR</label>
          <input className="input" type="number" placeholder="60" value={restHR} onChange={e => setRestHR(e.target.value)} disabled={method === "percent"} />
        </div>
      </div>
      {results && (
        <div className="space-y-2">
          {results.map(z => (
            <div key={z.name} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${z.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{z.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{z.label}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{Math.round(z.pctLow * 100)}–{Math.round(z.pctHigh * 100)}% intensity</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900 dark:text-white">{z.low}–{z.high}</div>
                <div className="text-xs text-gray-400">bpm</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardioTab() {
  return (
    <div className="space-y-4">
      <HeartRateZoneCalc />
      <VO2MaxCalc />
      <METCalorieCalc />
      <TargetHRCalc />
      <VerticalJumpCalc />
      <SprintCalc />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// NUTRITION TAB
// ══════════════════════════════════════════════════════════════════════

const ACTIVITY_MULTIPLIERS: { label: string; value: string; mult: number }[] = [
  { label: "Sedentary (little/no exercise)",       value: "1.2",   mult: 1.2 },
  { label: "Lightly active (1–3 days/week)",        value: "1.375", mult: 1.375 },
  { label: "Moderately active (3–5 days/week)",     value: "1.55",  mult: 1.55 },
  { label: "Very active (6–7 days/week)",           value: "1.725", mult: 1.725 },
  { label: "Extremely active (physical job + hard)", value: "1.9",  mult: 1.9 },
];

function CalorieCalc() {
  const [sex,      setSex]      = useState("male");
  const [age,      setAge]      = useState("");
  const [weight,   setWeight]   = useState("");
  const [height,   setHeight]   = useState("");
  const [activity, setActivity] = useState("1.55");
  const [unit,     setUnit]     = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ bmr: number; tdee: number } | null>(null);

  const calc = useCallback(() => {
    const a  = parseFloat(age);
    const w  = parseFloat(weight);
    const h  = parseFloat(height);
    const am = ACTIVITY_MULTIPLIERS.find(x => x.value === activity)?.mult ?? 1.55;
    if (!a || !w || !h) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const hCm = unit === "imperial" ? inToCm(h) : h;
    // Mifflin-St Jeor
    const bmr = sex === "male"
      ? (10 * wKg) + (6.25 * hCm) - (5 * a) + 5
      : (10 * wKg) + (6.25 * hCm) - (5 * a) - 161;
    setResult({ bmr, tdee: bmr * am });
  }, [sex, age, weight, height, activity, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const hUnit = unit === "imperial" ? "in"  : "cm";

  return (
    <CalcCard title="Calorie Requirements" icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18">
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select value={sex} onChange={setSex} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="30" min="1" max="120" step="1" />
        </Row>
        <Row label={`Weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
        </Row>
        <Row label={`Height (${hUnit})`}>
          <NumInput value={height} onChange={setHeight} placeholder={unit === "imperial" ? "70" : "178"} min="1" />
        </Row>
      </div>
      <Row label="Activity level">
        <Select value={activity} onChange={setActivity} options={ACTIVITY_MULTIPLIERS.map(a => ({value:a.value,label:a.label}))} />
      </Row>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="BMR" value={`${fmt(result.bmr, 0)} kcal/day`} sub="Basal Metabolic Rate" />
            <ResultBox label="TDEE" value={`${fmt(result.tdee, 0)} kcal/day`} sub="Total Daily Energy Expenditure" />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            {[
              ["Weight loss",        result.tdee - 500],
              ["Maintenance",        result.tdee],
              ["Lean bulk",          result.tdee + 300],
            ].map(([label, cal]) => (
              <div key={label as string} className="flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{label as string}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(cal as number, 0)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CalcCard>
  );
}

const EXERCISE_METS: { label: string; met: number }[] = [
  { label: "Walking 2.5 mph",         met: 3.0 },
  { label: "Walking 3.5 mph",         met: 4.3 },
  { label: "Jogging 5 mph",           met: 8.0 },
  { label: "Running 6 mph",           met: 10.0 },
  { label: "Running 8 mph",           met: 13.5 },
  { label: "Cycling (moderate)",       met: 8.0 },
  { label: "Cycling (vigorous)",       met: 12.0 },
  { label: "Swimming laps",           met: 8.0 },
  { label: "Rowing (vigorous)",       met: 12.0 },
  { label: "Jump rope",               met: 12.3 },
  { label: "Weight training",         met: 3.5 },
  { label: "CrossFit / circuit",      met: 8.0 },
  { label: "HIIT",                    met: 10.0 },
  { label: "Basketball",              met: 8.0 },
  { label: "Soccer",                  met: 7.0 },
  { label: "Tennis",                  met: 7.3 },
  { label: "Yoga",                    met: 3.0 },
  { label: "Elliptical (moderate)",   met: 5.0 },
  { label: "Hiking",                  met: 6.0 },
  { label: "Rock climbing",           met: 8.0 },
];

function ExerciseCaloriesCalc() {
  const [weight,   setWeight]   = useState("");
  const [exercise, setExercise] = useState("10.0");
  const [duration, setDuration] = useState("");
  const [unit,     setUnit]     = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<number | null>(null);

  const calc = useCallback(() => {
    const w  = parseFloat(weight);
    const d  = parseFloat(duration);
    const met= parseFloat(exercise);
    if (!w || !d || !met) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    setResult(met * wKg * (d / 60));
  }, [weight, exercise, duration, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Exercise Calories Burned" icon="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z">
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Body weight (${wUnit})`}>
          <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
        </Row>
        <Row label="Duration (minutes)">
          <NumInput value={duration} onChange={setDuration} placeholder="45" min="1" />
        </Row>
      </div>
      <Row label="Exercise type">
        <select
          className="input w-full"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
        >
          {EXERCISE_METS.map((ex) => (
            <option key={ex.label} value={ex.met.toString()}>
              {ex.label} (MET {ex.met})
            </option>
          ))}
        </select>
      </Row>
      <CalcButton onClick={calc} />
      {result !== null && (
        <ResultBox label="Calories burned" value={`${fmt(result, 0)} kcal`} sub="MET × weight (kg) × time (hours)" />
      )}
    </CalcCard>
  );
}

// ── Protein Needs Calculator ─────────────────────────────────────────────
const PROTEIN_TIERS = [
  { value: "sedentary",    label: "Sedentary (desk job, minimal exercise)",       range: [0.8,  1.0] as [number, number] },
  { value: "recreational", label: "Recreational (2–3×/week light exercise)",       range: [1.0,  1.2] as [number, number] },
  { value: "endurance",    label: "Endurance athlete (running, cycling, etc.)",    range: [1.2,  1.6] as [number, number] },
  { value: "strength",     label: "Strength athlete (lifting 4–5×/week)",          range: [1.6,  2.0] as [number, number] },
  { value: "building",     label: "Building muscle (caloric surplus)",             range: [1.8,  2.2] as [number, number] },
  { value: "cutting",      label: "Cutting / fat loss (preserving muscle)",        range: [2.0,  2.4] as [number, number] },
];

function ProteinNeedsCalc() {
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [weight, setWeight] = useState("");
  const [tier, setTier] = useState("strength");

  const result = useMemo(() => {
    const w = parseFloat(weight);
    if (!w) return null;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const t = PROTEIN_TIERS.find(p => p.value === tier)!;
    const lo = Math.round(wKg * t.range[0]);
    const hi = Math.round(wKg * t.range[1]);
    const perMeal = Math.round(((lo + hi) / 2) / 4);
    return { lo, hi, perMeal, range: t.range };
  }, [unit, weight, tier]);

  const wtUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="Protein Needs Calculator" icon="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z">
      <UnitToggle value={unit} onChange={setUnit} />
      <Row label={`Body weight (${wtUnit})`}>
        <NumInput value={weight} onChange={setWeight} placeholder={unit === "imperial" ? "175" : "79"} min="1" />
      </Row>
      <Row label="Activity / goal">
        <select value={tier} onChange={e => setTier(e.target.value)} className="input w-full">
          {PROTEIN_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Row>
      {result && (
        <div className="space-y-2">
          <ResultBox
            label="Daily protein target"
            value={`${result.lo}–${result.hi} g`}
            sub={`${result.range[0]}–${result.range[1]} g/kg bodyweight`}
          />
          <ResultBox
            label="Per meal (÷ 4 meals)"
            value={`~${result.perMeal} g`}
            sub="Avg if eating 4 meals/day"
          />
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Based on ISSN & ACSM protein intake recommendations</p>
    </CalcCard>
  );
}

// ── Macro Calculator ─────────────────────────────────────────────────
const MACRO_PRESETS = [
  { value:"loss",        label:"Weight loss",       p:30, c:40, f:30 },
  { value:"maintain",    label:"Maintenance",        p:25, c:45, f:30 },
  { value:"muscle",      label:"Muscle building",    p:30, c:45, f:25 },
  { value:"endurance",   label:"Endurance sport",    p:20, c:55, f:25 },
  { value:"keto",        label:"Ketogenic",          p:25, c:5,  f:70 },
  { value:"highprotein", label:"High protein",       p:40, c:35, f:25 },
  { value:"custom",      label:"Custom %",           p:30, c:40, f:30 },
];

function MacroCalc() {
  const [calories, setCalories] = useState("");
  const [preset, setPreset] = useState("muscle");
  const [pPct, setPPct] = useState("30");
  const [cPct, setCPct] = useState("45");
  const [fPct, setFPct] = useState("25");

  const currentPreset = MACRO_PRESETS.find(p => p.value === preset)!;
  const proteinPct = preset === "custom" ? (parseFloat(pPct) || 0) : currentPreset.p;
  const carbPct    = preset === "custom" ? (parseFloat(cPct) || 0) : currentPreset.c;
  const fatPct     = preset === "custom" ? (parseFloat(fPct) || 0) : currentPreset.f;
  const totalPct   = proteinPct + carbPct + fatPct;

  const result = useMemo(() => {
    const cal = parseFloat(calories);
    if (!cal || cal < 100) return null;
    const proteinCal = cal * (proteinPct / 100);
    const carbCal    = cal * (carbPct / 100);
    const fatCal     = cal * (fatPct / 100);
    return {
      proteinG: Math.round(proteinCal / 4),
      carbG:    Math.round(carbCal / 4),
      fatG:     Math.round(fatCal / 9),
      proteinCal: Math.round(proteinCal),
      carbCal:    Math.round(carbCal),
      fatCal:     Math.round(fatCal),
    };
  }, [calories, proteinPct, carbPct, fatPct]);

  return (
    <CalcCard title="Macro Calculator" icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18">
      <Row label="Daily calories (kcal)">
        <NumInput value={calories} onChange={setCalories} placeholder="2400" min="100" step="50" />
      </Row>
      <Row label="Goal / split preset">
        <select value={preset} onChange={e => {
          setPreset(e.target.value);
          const p = MACRO_PRESETS.find(m => m.value === e.target.value)!;
          if (e.target.value !== "custom") {
            setPPct(p.p.toString()); setCPct(p.c.toString()); setFPct(p.f.toString());
          }
        }} className="input w-full">
          {MACRO_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Row>
      {preset === "custom" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Protein %"><NumInput value={pPct} onChange={setPPct} placeholder="30" min="0" max="100" step="1" /></Row>
            <Row label="Carbs %"><NumInput value={cPct} onChange={setCPct} placeholder="40" min="0" max="100" step="1" /></Row>
            <Row label="Fat %"><NumInput value={fPct} onChange={setFPct} placeholder="30" min="0" max="100" step="1" /></Row>
          </div>
          {totalPct !== 100 && (
            <p className={`text-xs font-medium ${totalPct > 100 ? "text-red-500" : "text-yellow-500"}`}>
              Percentages total {totalPct}% — must equal 100%
            </p>
          )}
        </>
      )}
      {result && (
        <div className="space-y-3">
          <div className="h-3 rounded-full overflow-hidden flex">
            <div className="bg-blue-400 h-full" style={{ width: `${proteinPct}%` }} />
            <div className="bg-yellow-400 h-full" style={{ width: `${carbPct}%` }} />
            <div className="bg-orange-400 h-full" style={{ width: `${fatPct}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Protein {proteinPct}%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Carbs {carbPct}%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />Fat {fatPct}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ResultBox label="Protein" value={`${result.proteinG} g`} sub={`${result.proteinCal} kcal`} />
            <ResultBox label="Carbs"   value={`${result.carbG} g`}    sub={`${result.carbCal} kcal`} />
            <ResultBox label="Fat"     value={`${result.fatG} g`}     sub={`${result.fatCal} kcal`} />
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Protein 4 kcal/g · Carbs 4 kcal/g · Fat 9 kcal/g</p>
    </CalcCard>
  );
}

function BMRTDEECalc() {
  const [age,          setAge]          = useState("");
  const [sex,          setSex]          = useState<"male"|"female">("male");
  const [unit,         setUnit]         = useState<"imperial"|"metric">("imperial");
  const [weightInput,  setWeightInput]  = useState("");
  const [heightFt,     setHeightFt]     = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [heightCmIn,   setHeightCmIn]   = useState("");
  const [bodyFat,      setBodyFat]      = useState("");
  const [activity,     setActivity]     = useState("1.55");

  const BMRR_ACTIVITY = [
    { value: "1.2",   label: "Sedentary",   desc: "Little/no exercise" },
    { value: "1.375", label: "Light",        desc: "1–3 days/wk" },
    { value: "1.55",  label: "Moderate",     desc: "3–5 days/wk" },
    { value: "1.725", label: "Active",       desc: "6–7 days/wk" },
    { value: "1.9",   label: "Very Active",  desc: "2×/day or physical job" },
  ];

  const results = useMemo(() => {
    const a  = parseFloat(age);
    const w  = parseFloat(weightInput);
    const bf = parseFloat(bodyFat);
    if (!a || !w) return null;
    const weightKg = unit === "imperial" ? w * 0.453592 : w;
    let heightCm: number;
    if (unit === "imperial") {
      const ft  = parseFloat(heightFt) || 0;
      const ins = parseFloat(heightInches) || 0;
      if (!ft && !ins) return null;
      heightCm = (ft * 12 + ins) * 2.54;
    } else {
      const h = parseFloat(heightCmIn);
      if (!h) return null;
      heightCm = h;
    }
    const mifflin = sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * a + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * a - 161;
    const harris  = sex === "male"
      ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * a
      : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * a;
    const lbm   = bf > 0 && bf < 100 ? weightKg * (1 - bf / 100) : null;
    const katch = lbm !== null ? 370 + 21.6 * lbm : null;
    const mult  = parseFloat(activity);
    return {
      mifflin:     Math.round(mifflin),
      harris:      Math.round(harris),
      katch:       katch !== null ? Math.round(katch) : null,
      tdeeMifflin: Math.round(mifflin * mult),
      tdeeHarris:  Math.round(harris  * mult),
      tdeeKatch:   katch !== null ? Math.round(katch * mult) : null,
    };
  }, [age, sex, unit, weightInput, heightFt, heightInches, heightCmIn, bodyFat, activity]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">BMR & TDEE</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Mifflin-St Jeor · Harris-Benedict · Katch-McArdle — three formulas side by side</p>
      </div>
      <div className="flex gap-2">
        {(["imperial", "metric"] as const).map(u => (
          <button key={u} onClick={() => setUnit(u)} className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${unit === u ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {u === "imperial" ? "Imperial" : "Metric"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(["male", "female"] as const).map(s => (
          <button key={s} onClick={() => setSex(s)} className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${sex === s ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {s === "male" ? "Male" : "Female"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Age</label>
          <input className="input" type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
        </div>
        <div>
          <label className="label">Weight ({unit === "imperial" ? "lb" : "kg"})</label>
          <input className="input" type="number" placeholder={unit === "imperial" ? "185" : "84"} value={weightInput} onChange={e => setWeightInput(e.target.value)} />
        </div>
        {unit === "imperial" ? (
          <>
            <div>
              <label className="label">Height (ft)</label>
              <input className="input" type="number" placeholder="6" value={heightFt} onChange={e => setHeightFt(e.target.value)} />
            </div>
            <div>
              <label className="label">Height (in)</label>
              <input className="input" type="number" placeholder="1" value={heightInches} onChange={e => setHeightInches(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="label">Height (cm)</label>
            <input className="input" type="number" placeholder="185" value={heightCmIn} onChange={e => setHeightCmIn(e.target.value)} />
          </div>
        )}
        <div className="col-span-2">
          <label className="label">Body Fat % <span className="normal-case font-normal text-gray-400">(optional · unlocks Katch-McArdle)</span></label>
          <input className="input" type="number" placeholder="15" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Activity Level</label>
        <div className="grid grid-cols-1 gap-1.5 mt-1.5">
          {BMRR_ACTIVITY.map(l => (
            <button key={l.value} onClick={() => setActivity(l.value)} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors border ${activity === l.value ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`}>
              <span className="font-medium">{l.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{l.desc} · ×{l.value}</span>
            </button>
          ))}
        </div>
      </div>
      {results && (
        <div className="space-y-3">
          <div className="label">BMR — calories/day at rest</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: results.mifflin, label: "Mifflin" },
              { v: results.harris,  label: "Harris-B" },
              { v: results.katch,   label: "Katch-McA" },
            ].map(({ v, label }) => (
              <div key={label} className={`rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center ${v === null ? "opacity-40" : ""}`}>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{v !== null ? v.toLocaleString() : "—"}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="label">TDEE — with activity multiplier</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: results.tdeeMifflin, label: "Mifflin" },
              { v: results.tdeeHarris,  label: "Harris-B" },
              { v: results.tdeeKatch,   label: "Katch-McA" },
            ].map(({ v, label }) => (
              <div key={label} className={`rounded-xl bg-primary-50 dark:bg-primary-900/20 p-3 text-center ${v === null ? "opacity-40" : ""}`}>
                <div className="text-xl font-bold text-primary-700 dark:text-primary-300">{v !== null ? v.toLocaleString() : "—"}</div>
                <div className="text-xs text-primary-500/70 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NutritionTab() {
  return (
    <div className="space-y-4">
      <BMRTDEECalc />
      <MacroCalc />
      <ProteinNeedsCalc />
      <CalorieCalc />
      <ExerciseCaloriesCalc />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// RUNNING TAB
// ══════════════════════════════════════════════════════════════════════

function secsToHMS(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${m}:${String(sec).padStart(2,"0")}`;
}

function PaceCalc() {
  const [distance, setDistance]  = useState("");
  const [distUnit, setDistUnit]  = useState("miles");
  const [hours,    setHours]     = useState("");
  const [minutes,  setMinutes]   = useState("");
  const [seconds,  setSeconds]   = useState("");
  const [result, setResult] = useState<{
    paceMile: number; paceKm: number; speedMph: number; speedKph: number;
    proj5k: number; proj10k: number; projHalf: number; projFull: number;
  } | null>(null);

  const calc = useCallback(() => {
    const d   = parseFloat(distance);
    const h   = parseFloat(hours)   || 0;
    const min = parseFloat(minutes) || 0;
    const sec = parseFloat(seconds) || 0;
    if (!d) return;
    const totalSec  = h * 3600 + min * 60 + sec;
    if (totalSec === 0) return;
    const distMiles = distUnit === "miles"  ? d
                    : distUnit === "km"     ? d / 1.60934
                    : d / 1609.34; // meters
    const paceMile  = totalSec / distMiles;
    const paceKm    = paceMile / 1.60934;
    const speedMph  = distMiles / (totalSec / 3600);
    const speedKph  = speedMph * 1.60934;
    setResult({
      paceMile, paceKm, speedMph, speedKph,
      proj5k:    paceKm  * 5,
      proj10k:   paceKm  * 10,
      projHalf:  paceMile * 13.1094,
      projFull:  paceMile * 26.2188,
    });
  }, [distance, distUnit, hours, minutes, seconds]);

  return (
    <CalcCard title="Pace Calculator" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Distance">
          <NumInput value={distance} onChange={setDistance} placeholder="5" min="0.01" step="0.01" />
        </Row>
        <Row label="Unit">
          <Select value={distUnit} onChange={setDistUnit} options={[
            {value:"miles",  label:"Miles"},
            {value:"km",     label:"Kilometers"},
            {value:"meters", label:"Meters"},
          ]} />
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Time (hh:mm:ss)</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours"><NumInput value={hours}   onChange={setHours}   placeholder="0" min="0" step="1" /></Row>
        <Row label="Minutes"><NumInput value={minutes} onChange={setMinutes} placeholder="25" min="0" max="59" step="1" /></Row>
        <Row label="Seconds"><NumInput value={seconds} onChange={setSeconds} placeholder="00" min="0" max="59" step="1" /></Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Pace / mile"  value={secsToHMS(result.paceMile) + " /mi"} />
            <ResultBox label="Pace / km"    value={secsToHMS(result.paceKm) + " /km"} />
            <ResultBox label="Speed"        value={`${fmt(result.speedMph, 2)} mph`} />
            <ResultBox label="Speed"        value={`${fmt(result.speedKph, 2)} km/h`} />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">Projected finish times</p>
            </div>
            {[
              ["5K",           result.proj5k],
              ["10K",          result.proj10k],
              ["Half Marathon",result.projHalf],
              ["Marathon",     result.projFull],
            ].map(([label, secs]) => (
              <div key={label as string} className="flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{label as string}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{secsToHMS(secs as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CalcCard>
  );
}

function DistSpeedTimeCalc() {
  const [distance,  setDistance]  = useState("");
  const [speed,     setSpeed]     = useState("");
  const [timeH,     setTimeH]     = useState("");
  const [timeM,     setTimeM]     = useState("");
  const [timeS,     setTimeS]     = useState("");
  const [distUnit,  setDistUnit]  = useState("miles");
  const [speedUnit, setSpeedUnit] = useState("mph");
  const [solve,     setSolve]     = useState("time");
  const [result,    setResult]    = useState<string | null>(null);

  const calc = useCallback(() => {
    const d = parseFloat(distance);
    const sp= parseFloat(speed);
    const t = (parseFloat(timeH)||0)*3600 + (parseFloat(timeM)||0)*60 + (parseFloat(timeS)||0);

    if (solve === "time" && d && sp) {
      const distM = distUnit === "miles" ? d * 1609.344 : distUnit === "km" ? d * 1000 : d;
      const spMS  = speedUnit === "mph" ? sp / 2.23694 : speedUnit === "kph" ? sp / 3.6 : sp;
      const secs  = distM / spMS;
      setResult(secsToHMS(secs));
    } else if (solve === "distance" && sp && t > 0) {
      const spMS  = speedUnit === "mph" ? sp / 2.23694 : speedUnit === "kph" ? sp / 3.6 : sp;
      const distM = spMS * t;
      const val   = distUnit === "miles" ? distM / 1609.344 : distUnit === "km" ? distM / 1000 : distM;
      setResult(`${fmt(val, 3)} ${distUnit}`);
    } else if (solve === "speed" && d && t > 0) {
      const distM = distUnit === "miles" ? d * 1609.344 : distUnit === "km" ? d * 1000 : d;
      const spMS  = distM / t;
      const val   = speedUnit === "mph" ? spMS * 2.23694 : speedUnit === "kph" ? spMS * 3.6 : spMS;
      setResult(`${fmt(val, 3)} ${speedUnit}`);
    }
  }, [distance, speed, timeH, timeM, timeS, distUnit, speedUnit, solve]);

  return (
    <CalcCard title="Distance / Speed / Time" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <Row label="Solve for">
        <Select value={solve} onChange={setSolve} options={[
          {value:"time",     label:"Time"},
          {value:"distance", label:"Distance"},
          {value:"speed",    label:"Speed"},
        ]} />
      </Row>
      {solve !== "distance" && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <Row label="Distance">
            <NumInput value={distance} onChange={setDistance} placeholder="5" min="0.01" step="any" />
          </Row>
          <Row label="Distance unit">
            <Select value={distUnit} onChange={setDistUnit} options={[
              {value:"miles",  label:"Miles"},
              {value:"km",     label:"Km"},
              {value:"meters", label:"Meters"},
            ]} />
          </Row>
        </div>
      )}
      {solve !== "speed" && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <Row label="Speed">
            <NumInput value={speed} onChange={setSpeed} placeholder="8" min="0.01" step="any" />
          </Row>
          <Row label="Speed unit">
            <Select value={speedUnit} onChange={setSpeedUnit} options={[
              {value:"mph", label:"mph"},
              {value:"kph", label:"km/h"},
              {value:"mps", label:"m/s"},
            ]} />
          </Row>
        </div>
      )}
      {solve !== "time" && (
        <>
          <p className="label text-gray-500 dark:text-gray-400">Time</p>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Hours"><NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" /></Row>
            <Row label="Min"><NumInput value={timeM} onChange={setTimeM} placeholder="30" min="0" max="59" step="1" /></Row>
            <Row label="Sec"><NumInput value={timeS} onChange={setTimeS} placeholder="00" min="0" max="59" step="1" /></Row>
          </div>
        </>
      )}
      <CalcButton onClick={calc} />
      {result && <ResultBox label={`Result (${solve})`} value={result} />}
    </CalcCard>
  );
}

function StepsCalc() {
  const [steps,   setSteps]   = useState("");
  const [height,  setHeight]  = useState("");
  const [sex,     setSex]     = useState("male");
  const [unit,    setUnit]    = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ miles: number; km: number; feet: number; meters: number } | null>(null);

  const calc = useCallback(() => {
    const st = parseFloat(steps);
    const h  = parseFloat(height);
    if (!st || !h) return;
    const hM   = unit === "imperial" ? inToM(h) : h / 100;
    const coef = sex === "male" ? 0.415 : 0.413;
    const strideM = hM * coef; // step length in meters
    const distM   = st * strideM;
    setResult({ miles: distM / 1609.344, km: distM / 1000, feet: distM / 0.3048, meters: distM });
  }, [steps, height, sex, unit]);

  return (
    <CalcCard title="Steps to Distance" icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select value={sex} onChange={setSex} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Steps">
          <NumInput value={steps} onChange={setSteps} placeholder="10000" min="1" step="1" />
        </Row>
        <Row label={unit === "imperial" ? "Height (in)" : "Height (cm)"}>
          <NumInput value={height} onChange={setHeight} placeholder={unit === "imperial" ? "70" : "178"} min="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Miles"   value={fmt(result.miles, 3)} />
          <ResultBox label="Km"      value={fmt(result.km, 3)} />
          <ResultBox label="Meters"  value={fmt(result.meters, 0)} />
          <ResultBox label="Feet"    value={fmt(result.feet, 0)} />
        </div>
      )}
    </CalcCard>
  );
}

// ── Training Pace Zones (Daniels VDOT) ───────────────────────────────
function computeVDOT(distanceM: number, timeMin: number): number {
  const v = distanceM / timeMin;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMin) + 0.2989558 * Math.exp(-0.1932605 * timeMin);
  return vo2 / pct;
}

function vdotToPaceMinPerMile(vdot: number, pctVo2: number): number {
  const targetVO2 = vdot * pctVo2;
  const a = 0.000104, b = 0.182258, c_val = -4.60 - targetVO2;
  const disc = b * b - 4 * a * c_val;
  if (disc <= 0) return 0;
  const vMperMin = (-b + Math.sqrt(disc)) / (2 * a);
  return vMperMin > 0 ? 1609.34 / vMperMin : 0;
}

const VDOT_DISTANCES = [
  { value:"1500",     label:"1500m",          meters:1500 },
  { value:"mile",     label:"1 Mile",         meters:1609.34 },
  { value:"5k",       label:"5K",             meters:5000 },
  { value:"10k",      label:"10K",            meters:10000 },
  { value:"half",     label:"Half Marathon",  meters:21097.5 },
  { value:"marathon", label:"Marathon",       meters:42195 },
];

const PACE_ZONES = [
  { name:"Easy",        pct:0.59,  desc:"Conversational, aerobic base" },
  { name:"Long",        pct:0.625, desc:"Long runs, slightly above easy" },
  { name:"Marathon",    pct:0.77,  desc:"Goal marathon race pace" },
  { name:"Threshold",   pct:0.88,  desc:"Comfortably hard, lactate threshold" },
  { name:"Interval",    pct:0.975, desc:"5K effort, VO₂max development" },
  { name:"Repetition",  pct:1.10,  desc:"Speed/form work, short reps" },
];

const PACE_ZONE_COLORS = ["bg-blue-400","bg-green-400","bg-yellow-400","bg-orange-400","bg-red-400","bg-purple-500"];

function TrainingPaceZonesCalc() {
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [distance, setDistance] = useState("5k");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("20");
  const [timeS, setTimeS] = useState("0");
  const [result, setResult] = useState<{ vdot: number; paces: number[] } | null>(null);

  function calc() {
    const totalSec = (parseFloat(timeH)||0)*3600 + (parseFloat(timeM)||0)*60 + (parseFloat(timeS)||0);
    if (!totalSec) return;
    const dist = VDOT_DISTANCES.find(d => d.value === distance)!;
    const vdot = computeVDOT(dist.meters, totalSec / 60);
    const paces = PACE_ZONES.map(z => vdotToPaceMinPerMile(vdot, z.pct));
    setResult({ vdot, paces });
  }

  function formatPace(minPerMile: number): string {
    const pace = unit === "metric" ? minPerMile / 1.60934 : minPerMile;
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60);
    return `${m}:${s.toString().padStart(2,"0")} /${unit === "metric" ? "km" : "mi"}`;
  }

  return (
    <CalcCard title="Training Pace Zones" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <UnitToggle value={unit} onChange={(v) => { setUnit(v); setResult(null); }} />
      <Row label="Recent race distance">
        <select value={distance} onChange={e => setDistance(e.target.value)} className="input w-full">
          {VDOT_DISTANCES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </Row>
      <p className="label text-gray-500 dark:text-gray-400">Race finish time</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours"><NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" /></Row>
        <Row label="Minutes"><NumInput value={timeM} onChange={setTimeM} placeholder="20" min="0" max="59" step="1" /></Row>
        <Row label="Seconds"><NumInput value={timeS} onChange={setTimeS} placeholder="00" min="0" max="59" step="1" /></Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <ResultBox label="VDOT / VO₂max est." value={fmt(result.vdot, 1)} sub="Daniels fitness indicator" />
          <div className="space-y-1.5">
            {PACE_ZONES.map((zone, i) => (
              <div key={zone.name} className="flex items-center gap-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 px-3.5 py-2.5">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PACE_ZONE_COLORS[i]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{zone.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{zone.desc}</div>
                </div>
                <div className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0">
                  {formatPace(result.paces[i])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">Jack Daniels VDOT methodology · Enter a recent race time for best accuracy</p>
    </CalcCard>
  );
}

// ── Age-Graded Running Performance ───────────────────────────────────
// WMA-style performance factors: fraction of peak at ~25-30 yrs
const AGE_PERF_FACTORS: Record<"male"|"female", [number, number][]> = {
  male: [
    [15,0.930],[20,0.975],[25,1.000],[30,0.998],[35,0.978],[40,0.952],
    [45,0.916],[50,0.877],[55,0.832],[60,0.781],[65,0.726],[70,0.676],
    [75,0.620],[80,0.568],[85,0.511],[90,0.461],
  ],
  female: [
    [15,0.920],[20,0.970],[25,1.000],[30,0.998],[35,0.972],[40,0.935],
    [45,0.892],[50,0.844],[55,0.793],[60,0.737],[65,0.677],[70,0.618],
    [75,0.563],[80,0.511],[85,0.455],[90,0.404],
  ],
};

// Open world records in seconds (male / female)
const AGE_GRADE_DISTANCES = [
  { value:"mile",     label:"1 Mile",        mWR:223.13, fWR:252.33 },
  { value:"5k",       label:"5K",            mWR:755.36, fWR:845.40 },
  { value:"10k",      label:"10K",           mWR:1571,   fWR:1741   },
  { value:"half",     label:"Half Marathon", mWR:3451,   fWR:3772   },
  { value:"marathon", label:"Marathon",      mWR:7235,   fWR:7913   },
];

function getAgePerfFactor(age: number, sex: "male"|"female"): number {
  const table = AGE_PERF_FACTORS[sex];
  for (let i = table.length - 1; i >= 0; i--) {
    if (age >= table[i][0]) {
      if (i < table.length - 1) {
        const [a0, f0] = table[i], [a1, f1] = table[i+1];
        return f0 + (f1 - f0) * (age - a0) / (a1 - a0);
      }
      return table[i][1];
    }
  }
  return table[0][1];
}

function AgeGradedRunningCalc() {
  const [sex, setSex] = useState<"male"|"female">("male");
  const [age, setAge] = useState("");
  const [distance, setDistance] = useState("5k");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("25");
  const [timeS, setTimeS] = useState("0");
  const [result, setResult] = useState<{ agPct:number; ageEquivSec:number; category:string } | null>(null);

  function secsToStr(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.round(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
    return `${m}:${sec.toString().padStart(2,"0")}`;
  }

  function getAGCategory(pct: number): string {
    if (pct >= 90) return "World Class";
    if (pct >= 80) return "National Class";
    if (pct >= 70) return "Regional Class";
    if (pct >= 60) return "Local Class";
    if (pct >= 50) return "Recreational";
    return "Participant";
  }

  function calc() {
    const totalSec = (parseFloat(timeH)||0)*3600 + (parseFloat(timeM)||0)*60 + (parseFloat(timeS)||0);
    const ageN = parseFloat(age);
    if (!totalSec || !ageN) return;
    const dist = AGE_GRADE_DISTANCES.find(d => d.value === distance)!;
    const wr = sex === "male" ? dist.mWR : dist.fWR;
    const af = getAgePerfFactor(ageN, sex);
    // AG% = age-adjusted WR / athlete time × 100
    const agPct = Math.min(100, (wr / af) / totalSec * 100);
    // Open-age equivalent: what you'd run at peak age
    const ageEquivSec = totalSec * af;
    setResult({ agPct, ageEquivSec, category: getAGCategory(agPct) });
  }

  return (
    <CalcCard title="Age-Graded Running" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
      <Select value={sex} onChange={(v) => { setSex(v as "male"|"female"); setResult(null); }} options={[{value:"male",label:"Male"},{value:"female",label:"Female"}]} />
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)"><NumInput value={age} onChange={setAge} placeholder="45" min="15" max="99" step="1" /></Row>
        <Row label="Race distance">
          <select value={distance} onChange={e => setDistance(e.target.value)} className="input w-full">
            {AGE_GRADE_DISTANCES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Finish time</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours"><NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" /></Row>
        <Row label="Minutes"><NumInput value={timeM} onChange={setTimeM} placeholder="25" min="0" max="59" step="1" /></Row>
        <Row label="Seconds"><NumInput value={timeS} onChange={setTimeS} placeholder="00" min="0" max="59" step="1" /></Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Age Grade %" value={`${fmt(result.agPct, 1)}%`} sub={result.category} />
            <ResultBox label="Peak-age equivalent" value={secsToStr(result.ageEquivSec)} sub="If you were at peak age" />
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${result.agPct}%` }} />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden text-xs">
            {[["≥ 90%","World Class"],["≥ 80%","National Class"],["≥ 70%","Regional Class"],["≥ 60%","Local Class"],["≥ 50%","Recreational"],["< 50%","Participant"]].map(([pct,label]) => (
              <div key={label} className="flex justify-between px-3 py-1.5 border-b border-gray-200/40 dark:border-white/5 last:border-0">
                <span className="text-gray-500 dark:text-gray-400">{pct}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">WMA-style age grading · Compares performance fairly across ages and sexes</p>
    </CalcCard>
  );
}

const SPRINT_DISTS = [
  { label: "10m",  key: "d10"  },
  { label: "20m",  key: "d20"  },
  { label: "30m",  key: "d30"  },
  { label: "40m",  key: "d40"  },
  { label: "60m",  key: "d60"  },
  { label: "100m", key: "d100" },
] as const;

type SprintDistKey = typeof SPRINT_DISTS[number]["key"];

const SPRINT_DIST_M: Record<SprintDistKey, number> = {
  d10: 10, d20: 20, d30: 30, d40: 40, d60: 60, d100: 100,
};

function SprintSplitCalc() {
  const [times, setTimes] = useState<Record<SprintDistKey, string>>({
    d10: "", d20: "", d30: "", d40: "", d60: "", d100: "",
  });

  const results = useMemo(() => {
    const filled = SPRINT_DISTS
      .filter(d => times[d.key] && parseFloat(times[d.key]) > 0)
      .map(d => ({ label: d.label, key: d.key, dist: SPRINT_DIST_M[d.key], time: parseFloat(times[d.key]) }))
      .sort((a, b) => a.dist - b.dist);
    if (filled.length === 0) return null;
    const rows = filled.map((s, i) => {
      const splitTime = i === 0 ? s.time : s.time - filled[i - 1].time;
      const splitDist = i === 0 ? s.dist : s.dist - filled[i - 1].dist;
      const segMs     = splitDist / splitTime;
      const avgMs     = s.dist / s.time;
      return {
        label:     s.label,
        totalTime: s.time.toFixed(2),
        avgMs:     avgMs.toFixed(2),
        avgMph:    (avgMs * 2.23694).toFixed(1),
        segMs:     segMs.toFixed(2),
        segMph:    (segMs * 2.23694).toFixed(1),
        isFirst:   i === 0,
      };
    });
    const topMs = Math.max(...rows.map(r => parseFloat(r.segMs)));
    return { rows, topMs: topMs.toFixed(2), topMph: (topMs * 2.23694).toFixed(1) };
  }, [times]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Sprint Split Analyzer</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">FAT or hand times → velocity and acceleration phase breakdown</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {SPRINT_DISTS.map(d => (
          <div key={d.key}>
            <label className="label">{d.label} (sec)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder={d.key === "d10" ? "1.80" : d.key === "d20" ? "3.00" : d.key === "d40" ? "4.60" : ""}
              value={times[d.key]}
              onChange={e => setTimes(prev => ({ ...prev, [d.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {results && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4 text-center">
              <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">{results.topMs}</div>
              <div className="text-xs text-primary-500/70 mt-0.5">Top Speed (m/s)</div>
            </div>
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4 text-center">
              <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">{results.topMph}</div>
              <div className="text-xs text-primary-500/70 mt-0.5">Top Speed (mph)</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-left">Split</th>
                  <th className="px-3 py-2.5 text-right">Time</th>
                  <th className="px-3 py-2.5 text-right">Seg m/s</th>
                  <th className="px-3 py-2.5 text-right">Seg mph</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {results.rows.map(row => (
                  <tr key={row.label} className="dark:bg-gray-800/20">
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{row.label}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{row.totalTime}s</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{row.isFirst ? row.avgMs : row.segMs}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">{row.isFirst ? row.avgMph : row.segMph}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RunningTab() {
  return (
    <div className="space-y-4">
      <SprintSplitCalc />
      <TrainingPaceZonesCalc />
      <AgeGradedRunningCalc />
      <PaceCalc />
      <DistSpeedTimeCalc />
      <StepsCalc />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CONVERTERS TAB
// ══════════════════════════════════════════════════════════════════════

function WeightConverter() {
  const [value, setValue] = useState("");
  const [from,  setFrom]  = useState("lb");
  const [result, setResult] = useState<{ lb: number; kg: number; oz: number; g: number; st: number } | null>(null);

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (!v) return;
    const toKg: Record<string,number> = { lb: 0.453592, kg: 1, oz: 0.0283495, g: 0.001, st: 6.35029 };
    const kg = v * toKg[from];
    setResult({ lb: kg / 0.453592, kg, oz: kg / 0.0283495, g: kg * 1000, st: kg / 6.35029 });
  }, [value, from]);

  return (
    <CalcCard title="Weight Converter" icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="100" min="0" step="any" />
        </Row>
        <Row label="From">
          <Select value={from} onChange={setFrom} options={[
            {value:"lb",label:"Pounds (lb)"},
            {value:"kg",label:"Kilograms (kg)"},
            {value:"oz",label:"Ounces (oz)"},
            {value:"g", label:"Grams (g)"},
            {value:"st",label:"Stone (st)"},
          ]} />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Pounds"    value={fmt(result.lb, 4)} />
          <ResultBox label="Kilograms" value={fmt(result.kg, 4)} />
          <ResultBox label="Ounces"    value={fmt(result.oz, 3)} />
          <ResultBox label="Grams"     value={fmt(result.g, 2)} />
          <ResultBox label="Stone"     value={fmt(result.st, 4)} />
        </div>
      )}
    </CalcCard>
  );
}

function LengthConverter() {
  const [value, setValue] = useState("");
  const [from,  setFrom]  = useState("in");
  const [result, setResult] = useState<Record<string,number> | null>(null);

  const toM: Record<string,number> = { in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344, mm:0.001, cm:0.01, m:1, km:1000 };

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (!v) return;
    const meters = v * toM[from];
    const res: Record<string,number> = {};
    Object.keys(toM).forEach(u => { res[u] = meters / toM[u]; });
    setResult(res);
  }, [value, from]);

  const labels: Record<string,string> = { in:"in", ft:"ft", yd:"yd", mi:"miles", mm:"mm", cm:"cm", m:"m", km:"km" };

  return (
    <CalcCard title="Length / Distance Converter" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="100" min="0" step="any" />
        </Row>
        <Row label="From">
          <Select value={from} onChange={setFrom} options={Object.keys(toM).map(u => ({value:u, label:labels[u]}))} />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(toM).map(u => (
            <ResultBox key={u} label={labels[u]} value={fmt(result[u], result[u] < 0.001 ? 8 : result[u] < 1 ? 5 : 3)} />
          ))}
        </div>
      )}
    </CalcCard>
  );
}

function TempConverter() {
  const [value, setValue] = useState("");
  const [from,  setFrom]  = useState("F");
  const [result, setResult] = useState<{ F: number; C: number; K: number } | null>(null);

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    let C: number;
    if (from === "F")      C = (v - 32) * 5/9;
    else if (from === "K") C = v - 273.15;
    else                   C = v;
    setResult({ C, F: C * 9/5 + 32, K: C + 273.15 });
  }, [value, from]);

  return (
    <CalcCard title="Temperature Converter" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="98.6" step="any" />
        </Row>
        <Row label="From">
          <Select value={from} onChange={setFrom} options={[
            {value:"F",label:"Fahrenheit (°F)"},
            {value:"C",label:"Celsius (°C)"},
            {value:"K",label:"Kelvin (K)"},
          ]} />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Fahrenheit (°F)" value={fmt(result.F, 2)} />
          <ResultBox label="Celsius (°C)"    value={fmt(result.C, 2)} />
          <ResultBox label="Kelvin (K)"      value={fmt(result.K, 2)} />
        </div>
      )}
    </CalcCard>
  );
}

function ConvertersTab() {
  return (
    <div className="space-y-4">
      <WeightConverter />
      <LengthConverter />
      <TempConverter />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

interface ToolsPageProps {
  isCoach?: boolean;
}

export default function ToolsPage({ isCoach: _isCoach = false }: ToolsPageProps) {
  const [activeTab, setActiveTab] = useState("strength");

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-display text-gray-900 dark:text-gray-50">
            Fitness Calculators
          </h1>
          <p className="text-body text-gray-500 dark:text-gray-400 mt-1">
            Science-backed tools for strength, body composition, cardio and more
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-caption font-medium whitespace-nowrap transition-all flex-shrink-0 min-h-[44px] ${
                activeTab === tab.id
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-white dark:bg-surface-800 text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-white/8 hover:border-primary-300 dark:hover:border-primary-600/40"
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "strength"   && <StrengthTab />}
        {activeTab === "bodystats"  && <BodyStatsTab />}
        {activeTab === "cardio"     && <CardioTab />}
        {activeTab === "nutrition"  && <NutritionTab />}
        {activeTab === "running"    && <RunningTab />}
        {activeTab === "converters" && <ConvertersTab />}
      </div>
    </div>
  );
}
