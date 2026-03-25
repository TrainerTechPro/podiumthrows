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
  inToCm,
  type UnitSystem,
} from "./ToolCard";

const ACTIVITY_MULTIPLIERS: { label: string; value: string; mult: number }[] = [
  { label: "Sedentary (little/no exercise)", value: "1.2", mult: 1.2 },
  { label: "Lightly active (1–3 days/week)", value: "1.375", mult: 1.375 },
  { label: "Moderately active (3–5 days/week)", value: "1.55", mult: 1.55 },
  { label: "Very active (6–7 days/week)", value: "1.725", mult: 1.725 },
  { label: "Extremely active (physical job + hard)", value: "1.9", mult: 1.9 },
];

function CalorieCalc() {
  const [sex, setSex] = useState("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState("1.55");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ bmr: number; tdee: number } | null>(null);

  const calc = useCallback(() => {
    const a = parseFloat(age);
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const am = ACTIVITY_MULTIPLIERS.find((x) => x.value === activity)?.mult ?? 1.55;
    if (!a || !w || !h) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const hCm = unit === "imperial" ? inToCm(h) : h;
    // Mifflin-St Jeor
    const bmr =
      sex === "male" ? 10 * wKg + 6.25 * hCm - 5 * a + 5 : 10 * wKg + 6.25 * hCm - 5 * a - 161;
    setResult({ bmr, tdee: bmr * am });
  }, [sex, age, weight, height, activity, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const hUnit = unit === "imperial" ? "in" : "cm";

  return (
    <CalcCard
      title="Calorie Requirements"
      icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <UnitToggle value={unit} onChange={setUnit} />
        <Select
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="30" min="1" max="120" step="1" />
        </Row>
        <Row label={`Weight (${wUnit})`}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "175" : "79"}
            min="1"
          />
        </Row>
        <Row label={`Height (${hUnit})`}>
          <NumInput
            value={height}
            onChange={setHeight}
            placeholder={unit === "imperial" ? "70" : "178"}
            min="1"
          />
        </Row>
      </div>
      <Row label="Activity level">
        <Select
          value={activity}
          onChange={setActivity}
          options={ACTIVITY_MULTIPLIERS.map((a) => ({ value: a.value, label: a.label }))}
        />
      </Row>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox
              label="BMR"
              value={`${fmt(result.bmr, 0)} kcal/day`}
              sub="Basal Metabolic Rate"
            />
            <ResultBox
              label="TDEE"
              value={`${fmt(result.tdee, 0)} kcal/day`}
              sub="Total Daily Energy Expenditure"
            />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            {[
              ["Weight loss", result.tdee - 500],
              ["Maintenance", result.tdee],
              ["Lean bulk", result.tdee + 300],
            ].map(([label, cal]) => (
              <div
                key={label as string}
                className="flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <span className="text-gray-700 dark:text-gray-300">{label as string}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {fmt(cal as number, 0)} kcal
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CalcCard>
  );
}

const EXERCISE_METS: { label: string; met: number }[] = [
  { label: "Walking 2.5 mph", met: 3.0 },
  { label: "Walking 3.5 mph", met: 4.3 },
  { label: "Jogging 5 mph", met: 8.0 },
  { label: "Running 6 mph", met: 10.0 },
  { label: "Running 8 mph", met: 13.5 },
  { label: "Cycling (moderate)", met: 8.0 },
  { label: "Cycling (vigorous)", met: 12.0 },
  { label: "Swimming laps", met: 8.0 },
  { label: "Rowing (vigorous)", met: 12.0 },
  { label: "Jump rope", met: 12.3 },
  { label: "Weight training", met: 3.5 },
  { label: "CrossFit / circuit", met: 8.0 },
  { label: "HIIT", met: 10.0 },
  { label: "Basketball", met: 8.0 },
  { label: "Soccer", met: 7.0 },
  { label: "Tennis", met: 7.3 },
  { label: "Yoga", met: 3.0 },
  { label: "Elliptical (moderate)", met: 5.0 },
  { label: "Hiking", met: 6.0 },
  { label: "Rock climbing", met: 8.0 },
];

function ExerciseCaloriesCalc() {
  const [weight, setWeight] = useState("");
  const [exercise, setExercise] = useState("10.0");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<number | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const d = parseFloat(duration);
    const met = parseFloat(exercise);
    if (!w || !d || !met) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    setResult(met * wKg * (d / 60));
  }, [weight, exercise, duration, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="Exercise Calories Burned"
      icon="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
    >
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={`Body weight (${wUnit})`}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "175" : "79"}
            min="1"
          />
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
        <ResultBox
          label="Calories burned"
          value={`${fmt(result, 0)} kcal`}
          sub="MET × weight (kg) × time (hours)"
        />
      )}
    </CalcCard>
  );
}

// ── Protein Needs Calculator ─────────────────────────────────────────────
const PROTEIN_TIERS = [
  {
    value: "sedentary",
    label: "Sedentary (desk job, minimal exercise)",
    range: [0.8, 1.0] as [number, number],
  },
  {
    value: "recreational",
    label: "Recreational (2–3×/week light exercise)",
    range: [1.0, 1.2] as [number, number],
  },
  {
    value: "endurance",
    label: "Endurance athlete (running, cycling, etc.)",
    range: [1.2, 1.6] as [number, number],
  },
  {
    value: "strength",
    label: "Strength athlete (lifting 4–5×/week)",
    range: [1.6, 2.0] as [number, number],
  },
  {
    value: "building",
    label: "Building muscle (caloric surplus)",
    range: [1.8, 2.2] as [number, number],
  },
  {
    value: "cutting",
    label: "Cutting / fat loss (preserving muscle)",
    range: [2.0, 2.4] as [number, number],
  },
];

function ProteinNeedsCalc() {
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [weight, setWeight] = useState("");
  const [tier, setTier] = useState("strength");

  const result = useMemo(() => {
    const w = parseFloat(weight);
    if (!w) return null;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const t = PROTEIN_TIERS.find((p) => p.value === tier)!;
    const lo = Math.round(wKg * t.range[0]);
    const hi = Math.round(wKg * t.range[1]);
    const perMeal = Math.round((lo + hi) / 2 / 4);
    return { lo, hi, perMeal, range: t.range };
  }, [unit, weight, tier]);

  const wtUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="Protein Needs Calculator"
      icon="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
    >
      <UnitToggle value={unit} onChange={setUnit} />
      <Row label={`Body weight (${wtUnit})`}>
        <NumInput
          value={weight}
          onChange={setWeight}
          placeholder={unit === "imperial" ? "175" : "79"}
          min="1"
        />
      </Row>
      <Row label="Activity / goal">
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="input w-full">
          {PROTEIN_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
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
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Based on ISSN & ACSM protein intake recommendations
      </p>
    </CalcCard>
  );
}

// ── Macro Calculator ─────────────────────────────────────────────────
const MACRO_PRESETS = [
  { value: "loss", label: "Weight loss", p: 30, c: 40, f: 30 },
  { value: "maintain", label: "Maintenance", p: 25, c: 45, f: 30 },
  { value: "muscle", label: "Muscle building", p: 30, c: 45, f: 25 },
  { value: "endurance", label: "Endurance sport", p: 20, c: 55, f: 25 },
  { value: "keto", label: "Ketogenic", p: 25, c: 5, f: 70 },
  { value: "highprotein", label: "High protein", p: 40, c: 35, f: 25 },
  { value: "custom", label: "Custom %", p: 30, c: 40, f: 30 },
];

function MacroCalc() {
  const [calories, setCalories] = useState("");
  const [preset, setPreset] = useState("muscle");
  const [pPct, setPPct] = useState("30");
  const [cPct, setCPct] = useState("45");
  const [fPct, setFPct] = useState("25");

  const currentPreset = MACRO_PRESETS.find((p) => p.value === preset)!;
  const proteinPct = preset === "custom" ? parseFloat(pPct) || 0 : currentPreset.p;
  const carbPct = preset === "custom" ? parseFloat(cPct) || 0 : currentPreset.c;
  const fatPct = preset === "custom" ? parseFloat(fPct) || 0 : currentPreset.f;
  const totalPct = proteinPct + carbPct + fatPct;

  const result = useMemo(() => {
    const cal = parseFloat(calories);
    if (!cal || cal < 100) return null;
    const proteinCal = cal * (proteinPct / 100);
    const carbCal = cal * (carbPct / 100);
    const fatCal = cal * (fatPct / 100);
    return {
      proteinG: Math.round(proteinCal / 4),
      carbG: Math.round(carbCal / 4),
      fatG: Math.round(fatCal / 9),
      proteinCal: Math.round(proteinCal),
      carbCal: Math.round(carbCal),
      fatCal: Math.round(fatCal),
    };
  }, [calories, proteinPct, carbPct, fatPct]);

  return (
    <CalcCard
      title="Macro Calculator"
      icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
    >
      <Row label="Daily calories (kcal)">
        <NumInput value={calories} onChange={setCalories} placeholder="2400" min="100" step="50" />
      </Row>
      <Row label="Goal / split preset">
        <select
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value);
            const p = MACRO_PRESETS.find((m) => m.value === e.target.value)!;
            if (e.target.value !== "custom") {
              setPPct(p.p.toString());
              setCPct(p.c.toString());
              setFPct(p.f.toString());
            }
          }}
          className="input w-full"
        >
          {MACRO_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>
      {preset === "custom" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Protein %">
              <NumInput
                value={pPct}
                onChange={setPPct}
                placeholder="30"
                min="0"
                max="100"
                step="1"
              />
            </Row>
            <Row label="Carbs %">
              <NumInput
                value={cPct}
                onChange={setCPct}
                placeholder="40"
                min="0"
                max="100"
                step="1"
              />
            </Row>
            <Row label="Fat %">
              <NumInput
                value={fPct}
                onChange={setFPct}
                placeholder="30"
                min="0"
                max="100"
                step="1"
              />
            </Row>
          </div>
          {totalPct !== 100 && (
            <p
              className={`text-xs font-medium ${totalPct > 100 ? "text-red-500" : "text-yellow-500"}`}
            >
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
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
              Protein {proteinPct}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
              Carbs {carbPct}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
              Fat {fatPct}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ResultBox
              label="Protein"
              value={`${result.proteinG} g`}
              sub={`${result.proteinCal} kcal`}
            />
            <ResultBox label="Carbs" value={`${result.carbG} g`} sub={`${result.carbCal} kcal`} />
            <ResultBox label="Fat" value={`${result.fatG} g`} sub={`${result.fatCal} kcal`} />
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Protein 4 kcal/g · Carbs 4 kcal/g · Fat 9 kcal/g
      </p>
    </CalcCard>
  );
}

function BMRTDEECalc() {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<"imperial" | "metric">("imperial");
  const [weightInput, setWeightInput] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [heightCmIn, setHeightCmIn] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [activity, setActivity] = useState("1.55");

  const BMRR_ACTIVITY = [
    { value: "1.2", label: "Sedentary", desc: "Little/no exercise" },
    { value: "1.375", label: "Light", desc: "1–3 days/wk" },
    { value: "1.55", label: "Moderate", desc: "3–5 days/wk" },
    { value: "1.725", label: "Active", desc: "6–7 days/wk" },
    { value: "1.9", label: "Very Active", desc: "2×/day or physical job" },
  ];

  const results = useMemo(() => {
    const a = parseFloat(age);
    const w = parseFloat(weightInput);
    const bf = parseFloat(bodyFat);
    if (!a || !w) return null;
    const weightKg = unit === "imperial" ? w * 0.453592 : w;
    let heightCm: number;
    if (unit === "imperial") {
      const ft = parseFloat(heightFt) || 0;
      const ins = parseFloat(heightInches) || 0;
      if (!ft && !ins) return null;
      heightCm = (ft * 12 + ins) * 2.54;
    } else {
      const h = parseFloat(heightCmIn);
      if (!h) return null;
      heightCm = h;
    }
    const mifflin =
      sex === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * a + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * a - 161;
    const harris =
      sex === "male"
        ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * a
        : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * a;
    const lbm = bf > 0 && bf < 100 ? weightKg * (1 - bf / 100) : null;
    const katch = lbm !== null ? 370 + 21.6 * lbm : null;
    const mult = parseFloat(activity);
    return {
      mifflin: Math.round(mifflin),
      harris: Math.round(harris),
      katch: katch !== null ? Math.round(katch) : null,
      tdeeMifflin: Math.round(mifflin * mult),
      tdeeHarris: Math.round(harris * mult),
      tdeeKatch: katch !== null ? Math.round(katch * mult) : null,
    };
  }, [age, sex, unit, weightInput, heightFt, heightInches, heightCmIn, bodyFat, activity]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">BMR & TDEE</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Mifflin-St Jeor · Harris-Benedict · Katch-McArdle — three formulas side by side
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
      <div className="flex gap-2">
        {(["male", "female"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSex(s)}
            className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${sex === s ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
          >
            {s === "male" ? "Male" : "Female"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Age</label>
          <input
            className="input"
            type="number"
            placeholder="25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Weight ({unit === "imperial" ? "lb" : "kg"})</label>
          <input
            className="input"
            type="number"
            placeholder={unit === "imperial" ? "185" : "84"}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
        </div>
        {unit === "imperial" ? (
          <>
            <div>
              <label className="label">Height (ft)</label>
              <input
                className="input"
                type="number"
                placeholder="6"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Height (in)</label>
              <input
                className="input"
                type="number"
                placeholder="1"
                value={heightInches}
                onChange={(e) => setHeightInches(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="label">Height (cm)</label>
            <input
              className="input"
              type="number"
              placeholder="185"
              value={heightCmIn}
              onChange={(e) => setHeightCmIn(e.target.value)}
            />
          </div>
        )}
        <div className="col-span-2">
          <label className="label">
            Body Fat %{" "}
            <span className="normal-case font-normal text-gray-400">
              (optional · unlocks Katch-McArdle)
            </span>
          </label>
          <input
            className="input"
            type="number"
            placeholder="15"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Activity Level</label>
        <div className="grid grid-cols-1 gap-1.5 mt-1.5">
          {BMRR_ACTIVITY.map((l) => (
            <button
              key={l.value}
              onClick={() => setActivity(l.value)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors border ${activity === l.value ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`}
            >
              <span className="font-medium">{l.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {l.desc} · ×{l.value}
              </span>
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
              { v: results.harris, label: "Harris-B" },
              { v: results.katch, label: "Katch-McA" },
            ].map(({ v, label }) => (
              <div
                key={label}
                className={`rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center ${v === null ? "opacity-40" : ""}`}
              >
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {v !== null ? v.toLocaleString() : "—"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="label">TDEE — with activity multiplier</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: results.tdeeMifflin, label: "Mifflin" },
              { v: results.tdeeHarris, label: "Harris-B" },
              { v: results.tdeeKatch, label: "Katch-McA" },
            ].map(({ v, label }) => (
              <div
                key={label}
                className={`rounded-xl bg-primary-50 dark:bg-primary-900/20 p-3 text-center ${v === null ? "opacity-40" : ""}`}
              >
                <div className="text-xl font-bold text-primary-700 dark:text-primary-300">
                  {v !== null ? v.toLocaleString() : "—"}
                </div>
                <div className="text-xs text-primary-500/70 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function NutritionTab() {
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
