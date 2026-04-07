"use client";

import { useState, useCallback, useMemo } from "react";
import {
  CalcCard,
  Row,
  NumInput,
  ResultBox,
  UnitToggle,
  CalcButton,
  fmt,
  type UnitSystem,
} from "./ToolCard";

// ── Strength-specific constants ─────────────────────────────────────

const ORM_PERCENTS = [100, 95, 93, 90, 87, 85, 83, 80, 77, 75, 72, 70, 67, 65];
const ORM_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function OneRMCalc() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ brzycki: number; epley: number; lander: number } | null>(
    null
  );

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const r = parseFloat(reps);
    if (!w || !r || r < 1) return;
    const brzycki = r === 1 ? w : w / (1.0278 - 0.0278 * r);
    const epley = r === 1 ? w : w * (1 + r / 30);
    const lander = r === 1 ? w : (100 * w) / (101.3 - 2.67123 * r);
    setResult({ brzycki, epley, lander });
  }, [weight, reps]);

  const best = result ? Math.round((result.brzycki + result.epley + result.lander) / 3) : null;
  const unitLabel = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="1-Rep Max (1RM)"
      icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
    >
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
            <ResultBox label="Epley" value={`${fmt(result.epley, 0)} ${unitLabel}`} />
            <ResultBox label="Lander" value={`${fmt(result.lander, 0)} ${unitLabel}`} />
          </div>
          <ResultBox
            label="Average Estimate"
            value={`${best} ${unitLabel}`}
            sub="Average of all three formulas"
          />
          {/* Percentage table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200/60 dark:border-white/5">
            <table className="w-full text-caption">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800">
                  <th className="text-left px-3 py-2 label text-gray-500 dark:text-gray-400">
                    Reps
                  </th>
                  <th className="text-right px-3 py-2 label text-gray-500 dark:text-gray-400">
                    %1RM
                  </th>
                  <th className="text-right px-3 py-2 label text-gray-500 dark:text-gray-400">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody>
                {ORM_REPS.map((r, i) => (
                  <tr
                    key={r}
                    className="border-t border-gray-100 dark:border-white/5 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                  >
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">
                      {ORM_PERCENTS[i]}%
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                      {best ? `${Math.round((best * ORM_PERCENTS[i]) / 100)} ${unitLabel}` : "—"}
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
  const [weight, setWeight] = useState("");
  const [currentR, setCurrentR] = useState("");
  const [targetR, setTargetR] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
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
    <CalcCard
      title="Workload Adjustment"
      icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
    >
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Row label={`Weight (${unitLabel})`}>
          <NumInput value={weight} onChange={setWeight} placeholder="185" min="1" />
        </Row>
        <Row label="Reps performed">
          <NumInput
            value={currentR}
            onChange={setCurrentR}
            placeholder="8"
            min="1"
            max="30"
            step="1"
          />
        </Row>
        <Row label="Target reps">
          <NumInput
            value={targetR}
            onChange={setTargetR}
            placeholder="5"
            min="1"
            max="30"
            step="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Estimated 1RM" value={`${fmt(result.orm, 0)} ${unitLabel}`} />
          <ResultBox
            label="Target weight"
            value={`${fmt(result.adjusted, 0)} ${unitLabel}`}
            sub={`for ${targetR} reps`}
          />
        </div>
      )}
    </CalcCard>
  );
}

const LB_PLATES = [55, 45, 35, 25, 10, 5, 2.5];
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
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
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{
    plates: { plate: number; count: number }[];
    actual: number;
    bar: number;
  } | null>(null);

  const calc = useCallback(() => {
    const t = parseFloat(target);
    if (!t) return;
    const bar = unit === "imperial" ? BAR_LB : BAR_KG;
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
        <NumInput
          value={target}
          onChange={setTarget}
          placeholder={unit === "imperial" ? "225" : "100"}
          min="1"
        />
      </Row>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Bar weight: {unit === "imperial" ? "45 lbs" : "20 kg"}
      </p>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-3">
          <ResultBox
            label="Actual total"
            value={`${fmt(result.actual, 1)} ${unitLabel}`}
            sub={
              result.actual !== parseFloat(target)
                ? `⚠ Can't hit ${target} exactly with standard plates`
                : "✓ Exact match"
            }
          />
          {result.plates.length > 0 ? (
            <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
              <div className="bg-surface-50 dark:bg-surface-800 px-3 py-2">
                <p className="label text-gray-500 dark:text-gray-400">Plates per side</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {result.plates.map((p) => (
                  <div key={p.plate} className="flex justify-between items-center px-3 py-2">
                    <span className="text-body text-gray-700 dark:text-gray-300">
                      {p.plate} {unitLabel}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      × {p.count}
                    </span>
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

function RepMaxCalc() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("5");
  const [unit, setUnit] = useState<"lb" | "kg">("lb");

  const table = useMemo(() => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || w <= 0 || r < 1 || r > 10) return null;
    const epley1 = r === 1 ? w : w * (1 + r / 30);
    const brzycki1 = r === 1 ? w : w * (36 / (37 - r));
    const lander1 = r === 1 ? w : (100 * w) / (101.3 - 2.67123 * r);
    const orm = (epley1 + brzycki1 + lander1) / 3;
    return Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      const eW = n === 1 ? orm : orm / (1 + n / 30);
      const bW = n === 1 ? orm : (orm * (37 - n)) / 36;
      const lW = n === 1 ? orm : (orm * (101.3 - 2.67123 * n)) / 100;
      const avg = Math.round((eW + bW + lW) / 3);
      return { reps: n, weight: avg, pct: Math.round((avg / orm) * 100) };
    });
  }, [weight, reps]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Rep Max Table</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Enter any set to estimate 1RM and project all rep maxes (Epley · Brzycki · Lander)
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Weight</label>
          <input
            className="input"
            type="number"
            placeholder="225"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Reps Done</label>
          <select className="input" value={reps} onChange={(e) => setReps(e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value as "lb" | "kg")}
          >
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
              {table.map((row) => (
                <tr
                  key={row.reps}
                  className={
                    row.reps === parseInt(reps)
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "dark:bg-gray-800/20"
                  }
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    {row.reps} {row.reps === 1 ? "rep" : "reps"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                    {row.weight} {unit}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">
                    {row.pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function StrengthTab() {
  return (
    <div className="space-y-4">
      <RepMaxCalc />
      <OneRMCalc />
      <WorkloadCalc />
      <BarbellRackCalc />
    </div>
  );
}
