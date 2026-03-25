"use client";

import { useState, useCallback, useMemo } from "react";
import {
  CalcCard,
  Row,
  NumInput,
  Select,
  ResultBox,
  UnitToggle,
  CalcButton,
  fmt,
  lbToKg,
  kgToLb,
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

// ── Strength Standards ──────────────────────────────────────────────────
const STD_LIFTS = ["squat", "bench", "deadlift", "press"] as const;
type Lift = (typeof STD_LIFTS)[number];

const LIFT_LABELS: Record<Lift, string> = {
  squat: "Back Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
  press: "Overhead Press",
};

const STANDARDS: Record<"male" | "female", Record<Lift, number[]>> = {
  male: {
    squat: [0.75, 1.25, 1.5, 1.75, 2.25],
    bench: [0.5, 0.75, 1.0, 1.25, 1.75],
    deadlift: [1.0, 1.5, 1.75, 2.0, 2.5],
    press: [0.35, 0.55, 0.7, 0.9, 1.2],
  },
  female: {
    squat: [0.5, 0.75, 1.0, 1.25, 1.5],
    bench: [0.25, 0.45, 0.65, 0.85, 1.0],
    deadlift: [0.5, 0.85, 1.1, 1.35, 1.75],
    press: [0.2, 0.35, 0.45, 0.55, 0.75],
  },
};

const LEVEL_LABELS = ["Untrained", "Novice", "Intermediate", "Advanced", "Elite"];
const LEVEL_COLORS = [
  "bg-gray-400",
  "bg-blue-400",
  "bg-green-400",
  "bg-yellow-400",
  "bg-primary-500",
];

function getStdLevel(ratio: number, standards: number[]): number {
  let lvl = -1;
  for (let i = 0; i < standards.length; i++) {
    if (ratio >= standards[i]) lvl = i;
    else break;
  }
  return lvl;
}

function StrengthStandardsCalc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [bw, setBw] = useState("");
  const [lifts, setLifts] = useState<Record<Lift, string>>({
    squat: "",
    bench: "",
    deadlift: "",
    press: "",
  });
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
    <CalcCard
      title="Strength Standards"
      icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
    >
      <div className="flex gap-3 flex-wrap">
        <Select
          value={sex}
          onChange={(v) => setSex(v as "male" | "female")}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <Row label={`Bodyweight (${unitLabel})`}>
        <NumInput
          value={bw}
          onChange={setBw}
          placeholder={unit === "imperial" ? "185" : "84"}
          min="1"
        />
      </Row>
      <p className="label text-gray-500 dark:text-gray-400">
        Your 1RM for each lift (leave blank to skip)
      </p>
      <div className="grid grid-cols-2 gap-3">
        {STD_LIFTS.map((lift) => (
          <Row key={lift} label={LIFT_LABELS[lift]}>
            <NumInput
              value={lifts[lift]}
              onChange={(v) => setLifts((p) => ({ ...p, [lift]: v }))}
              placeholder={unit === "imperial" ? "225" : "102"}
              min="1"
            />
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
              <div
                key={lift}
                className="rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {LIFT_LABELS[lift]}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${level === -1 ? "bg-gray-400" : LEVEL_COLORS[level]}`}
                  >
                    {levelLabel}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${level === -1 ? "bg-gray-400" : LEVEL_COLORS[level]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Untrained</span>
                  <span>Elite</span>
                </div>
                {nextIdx < 5 && nextVal && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Next level ({LEVEL_LABELS[nextIdx]}):{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {fmt(nextVal, 0)} {unitLabel}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {results && !hasAnyEntry && bw && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
          Enter at least one lift to see your level
        </p>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        ExRx bodyweight ratio standards · Untrained → Novice → Intermediate → Advanced → Elite
      </p>
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
    const wa =
      sex === "male"
        ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
        : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
    const wDenom =
      wa[0] +
      wa[1] * bwKg +
      wa[2] * bwKg ** 2 +
      wa[3] * bwKg ** 3 +
      wa[4] * bwKg ** 4 +
      wa[5] * bwKg ** 5;
    const wilks = wDenom > 0 ? (totalKg * 500) / wDenom : 0;

    // DOTS coefficients
    const da =
      sex === "male"
        ? [-307.75076, 24.0900756, -0.1918759221, 0.0009069006, -0.00000148676]
        : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.00000805154];
    const dDenom = da[0] + da[1] * bwKg + da[2] * bwKg ** 2 + da[3] * bwKg ** 3 + da[4] * bwKg ** 4;
    const dots = dDenom > 0 ? (totalKg * 500) / dDenom : 0;

    return { wilks, dots };
  }, [sex, unit, bw, total]);

  return (
    <CalcCard
      title="Wilks / DOTS Score"
      icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    >
      <div className="flex gap-3 flex-wrap">
        <Select
          value={sex}
          onChange={(v) => setSex(v as "male" | "female")}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Bodyweight (${unitLabel})`}>
          <NumInput
            value={bw}
            onChange={setBw}
            placeholder={unit === "imperial" ? "185" : "84"}
            min="1"
          />
        </Row>
        <Row label={`Total lifted (${unitLabel})`}>
          <NumInput
            value={total}
            onChange={setTotal}
            placeholder={unit === "imperial" ? "1200" : "544"}
            min="1"
          />
        </Row>
      </div>
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Wilks Score" value={fmt(result.wilks, 1)} sub="Classic formula" />
            <ResultBox label="DOTS Score" value={fmt(result.dots, 1)} sub="IPF preferred (2020+)" />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            {[
              ["< 200", "Beginner"],
              ["200–300", "Intermediate"],
              ["300–400", "Advanced"],
              ["400–500", "Elite"],
              ["500+", "World-class"],
            ].map(([range, label]) => (
              <div
                key={label}
                className="flex justify-between px-3 py-2 text-xs border-b border-gray-200/40 dark:border-white/5 last:border-0"
              >
                <span className="text-gray-500 dark:text-gray-400">{range}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Normalizes total for bodyweight · Total = Squat + Bench + Deadlift
      </p>
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

function VerticalJumpPowerCalc() {
  const [jumpHeight, setJumpHeight] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [unit, setUnit] = useState<"imperial" | "metric">("imperial");

  const results = useMemo(() => {
    const h = parseFloat(jumpHeight);
    const bw = parseFloat(bodyWeight);
    if (!h || !bw || h <= 0 || bw <= 0) return null;
    const hM = unit === "imperial" ? h * 0.0254 : h / 100;
    const massKg = unit === "imperial" ? bw * 0.453592 : bw;
    const hCm = hM * 100;
    const lewis = 2.21 * massKg * Math.sqrt(hM);
    const sayers = Math.max(0, 60.7 * hCm + 45.3 * massKg - 2055);
    const hIn = unit === "imperial" ? h : h / 2.54;
    const rating =
      hIn < 16
        ? { label: "Below Average", color: "text-red-500" }
        : hIn < 20
          ? { label: "Average", color: "text-orange-500" }
          : hIn < 24
            ? { label: "Above Average", color: "text-yellow-500" }
            : hIn < 28
              ? { label: "Good", color: "text-green-500" }
              : hIn < 32
                ? { label: "Excellent", color: "text-emerald-500" }
                : { label: "Elite", color: "text-primary-500" };
    return { lewis: Math.round(lewis), sayers: Math.round(sayers), rating };
  }, [jumpHeight, bodyWeight, unit]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">
          Vertical Jump Power
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Peak power output in watts — Lewis and Sayers formulas
        </p>
      </div>
      <div className="flex gap-2">
        {(["imperial", "metric"] as const).map((u) => (
          <button
            key={u}
            onClick={() => setUnit(u)}
            className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${unit === u ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
          >
            {u === "imperial" ? "Imperial" : "Metric"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Jump Height ({unit === "imperial" ? "in" : "cm"})</label>
          <input
            className="input"
            type="number"
            placeholder={unit === "imperial" ? "24" : "61"}
            value={jumpHeight}
            onChange={(e) => setJumpHeight(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Body Weight ({unit === "imperial" ? "lb" : "kg"})</label>
          <input
            className="input"
            type="number"
            placeholder={unit === "imperial" ? "185" : "84"}
            value={bodyWeight}
            onChange={(e) => setBodyWeight(e.target.value)}
          />
        </div>
      </div>
      {results && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {results.lewis.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Watts (Lewis)</div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {results.sayers.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Watts (Sayers)</div>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
            <span className={`text-lg font-bold ${results.rating.color}`}>
              {results.rating.label}
            </span>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Jump Height Rating
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StrengthTab() {
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
