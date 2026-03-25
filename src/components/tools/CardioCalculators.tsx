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
  inToCm,
  type UnitSystem,
} from "./ToolCard";

function TargetHRCalc() {
  const [age, setAge] = useState("");
  const [restHR, setRestHR] = useState("");
  const [intensityLo, setIntensityLo] = useState("60");
  const [intensityHi, setIntensityHi] = useState("85");
  const [result, setResult] = useState<{
    maxHR: number;
    pctLo: number;
    pctHi: number;
    karLo: number;
    karHi: number;
  } | null>(null);

  const calc = useCallback(() => {
    const a = parseFloat(age);
    const rhr = parseFloat(restHR);
    const lo = parseFloat(intensityLo) / 100;
    const hi = parseFloat(intensityHi) / 100;
    if (!a) return;
    const maxHR = 220 - a;
    const pctLo = maxHR * lo;
    const pctHi = maxHR * hi;
    const HRR = rhr ? maxHR - rhr : 0;
    const karLo = rhr ? HRR * lo + rhr : 0;
    const karHi = rhr ? HRR * hi + rhr : 0;
    setResult({ maxHR, pctLo, pctHi, karLo, karHi });
  }, [age, restHR, intensityLo, intensityHi]);

  return (
    <CalcCard
      title="Target Heart Rate"
      icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    >
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="30" min="1" max="120" step="1" />
        </Row>
        <Row label="Resting HR (bpm) — optional">
          <NumInput
            value={restHR}
            onChange={setRestHR}
            placeholder="60"
            min="20"
            max="120"
            step="1"
          />
        </Row>
        <Row label="Intensity low (%)">
          <NumInput
            value={intensityLo}
            onChange={setIntensityLo}
            placeholder="60"
            min="1"
            max="100"
            step="1"
          />
        </Row>
        <Row label="Intensity high (%)">
          <NumInput
            value={intensityHi}
            onChange={setIntensityHi}
            placeholder="85"
            min="1"
            max="100"
            step="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <ResultBox
            label="Estimated Max HR"
            value={`${Math.round(result.maxHR)} bpm`}
            sub="220 − age"
          />
          <div className="grid grid-cols-2 gap-2">
            <ResultBox
              label="% HRmax range"
              value={`${Math.round(result.pctLo)}–${Math.round(result.pctHi)} bpm`}
            />
            {result.karLo > 0 && (
              <ResultBox
                label="Karvonen (HRR)"
                value={`${Math.round(result.karLo)}–${Math.round(result.karHi)} bpm`}
              />
            )}
          </div>
          {!restHR && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Enter resting HR for Karvonen method
            </p>
          )}
        </div>
      )}
    </CalcCard>
  );
}

function VerticalJumpCalc() {
  const [weight, setWeight] = useState("");
  const [jump, setJump] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{
    lewis: number;
    sayers: number;
    harmanPeak: number;
    harmanMean: number;
  } | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const j = parseFloat(jump);
    if (!w || !j) return;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const jCm = unit === "imperial" ? inToCm(j) : j;
    const jM = jCm / 100;
    const lewis = 2.21 * wKg * Math.sqrt(jM);
    const sayers = 60.7 * jCm + 45.3 * wKg - 2055;
    const harmanPeak = 61.9 * jCm + 36.0 * wKg - 1822;
    const harmanMean = 21.2 * jCm + 23.0 * wKg - 1393;
    setResult({ lewis, sayers, harmanPeak, harmanMean });
  }, [weight, jump, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const jUnit = unit === "imperial" ? "in" : "cm";

  return (
    <CalcCard title="Vertical Jump Power" icon="M13 10V3L4 14h7v7l9-11h-7z">
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
        <Row label={`Jump height (${jUnit})`}>
          <NumInput
            value={jump}
            onChange={setJump}
            placeholder={unit === "imperial" ? "24" : "61"}
            min="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Lewis formula" value={`${fmt(result.lewis, 0)} W`} />
          <ResultBox label="Sayers peak" value={`${fmt(Math.max(0, result.sayers), 0)} W`} />
          <ResultBox label="Harman peak" value={`${fmt(Math.max(0, result.harmanPeak), 0)} W`} />
          <ResultBox label="Harman mean" value={`${fmt(Math.max(0, result.harmanMean), 0)} W`} />
        </div>
      )}
    </CalcCard>
  );
}

function SprintCalc() {
  const [distance, setDistance] = useState("");
  const [distUnit, setDistUnit] = useState("yards");
  const [time, setTime] = useState("");
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
          <Select
            value={distUnit}
            onChange={setDistUnit}
            options={[
              { value: "yards", label: "Yards" },
              { value: "meters", label: "Meters" },
              { value: "feet", label: "Feet" },
            ]}
          />
        </Row>
        <Row label="Time (seconds)">
          <NumInput value={time} onChange={setTime} placeholder="4.5" min="0.1" step="0.01" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Speed" value={`${fmt(result.mps, 2)} m/s`} />
          <ResultBox label="Speed" value={`${fmt(result.mph, 2)} mph`} />
          <ResultBox label="Speed" value={`${fmt(result.kph, 2)} km/h`} />
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
    case "bike":
      return Math.round(10 + (clamped - 1) * 13.5); // ~10–269 W
    case "elliptical":
      return Math.round(30 + (clamped - 1) * 16); // ~30–334 W
    case "rower":
      return Math.round(50 + (clamped - 1) * 15); // ~50–335 W
    case "stairclimber":
      return Math.round(40 + (clamped - 1) * 14); // ~40–306 W
    default:
      return Math.round(10 + (clamped - 1) * 13.5);
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
  const [machine, setMachine] = useState<MachineType>("treadmill");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [weight, setWeight] = useState("");
  const [duration, setDuration] = useState("");
  // Treadmill inputs
  const [speed, setSpeed] = useState("");
  const [incline, setIncline] = useState("0");
  // Machine inputs
  const [inputMode, setInputMode] = useState<"watts" | "resistance">("resistance");
  const [watts, setWatts] = useState("");
  const [resistance, setResistance] = useState("");

  const [result, setResult] = useState<{
    vo2: number;
    met: number;
    calPerMin: number;
    totalCal: number;
    intensity: string;
    zone: string;
    zoneColor: string;
    watts?: number;
    isEstimated?: boolean;
  } | null>(null);

  const getIntensity = (met: number) => {
    if (met < 3) return { label: "Light", zone: "< 3 METs", color: "text-blue-400" };
    if (met < 6) return { label: "Moderate", zone: "3–6 METs", color: "text-green-400" };
    if (met < 9) return { label: "Vigorous", zone: "6–9 METs", color: "text-yellow-400" };
    if (met < 12) return { label: "Very High", zone: "9–12 METs", color: "text-orange-400" };
    return { label: "Maximum", zone: "> 12 METs", color: "text-red-400" };
  };

  const calc = useCallback(() => {
    const w = parseFloat(weight);
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

    const met = vo2 / 3.5;
    const calPerMin = (met * wKg) / 60; // kcal/min  (1 MET = 1 kcal/kg/hr)
    const totalCal = calPerMin * dur;
    const { label, zone, color } = getIntensity(met);

    setResult({
      vo2,
      met,
      calPerMin,
      totalCal,
      intensity: label,
      zone,
      zoneColor: color,
      watts: usedWatts,
      isEstimated,
    });
  }, [machine, unit, weight, duration, speed, incline, inputMode, watts, resistance]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";
  const sUnit = machine === "treadmill" ? (unit === "imperial" ? "mph" : "km/h") : "";

  const machineOptions = [
    { value: "treadmill", label: "Treadmill" },
    { value: "bike", label: "Stationary Bike" },
    { value: "elliptical", label: "Elliptical" },
    { value: "rower", label: "Rowing Machine" },
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
            <NumInput
              value={speed}
              onChange={setSpeed}
              placeholder={unit === "imperial" ? "6.0" : "9.7"}
              min="0.5"
              step="0.1"
            />
          </Row>
          <Row label="Incline (%)">
            <NumInput
              value={incline}
              onChange={setIncline}
              placeholder="0"
              min="0"
              max="40"
              step="0.5"
            />
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
                <NumInput
                  value={resistance}
                  onChange={setResistance}
                  placeholder="10"
                  min="1"
                  max="20"
                  step="1"
                />
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
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "175" : "79"}
            min="1"
          />
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
            <div
              className={`rounded-xl px-3.5 py-2.5 text-caption ${
                result.isEstimated
                  ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30"
                  : "bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5"
              }`}
            >
              <span
                className={
                  result.isEstimated
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                {result.isEstimated ? "⚠ Estimated " : ""}Wattage used:{" "}
                <strong>{result.watts} W</strong>
                {result.isEstimated &&
                  " (from resistance level — use watts mode for exact results)"}
              </span>
            </div>
          )}

          {/* Intensity zone strip */}
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">Intensity zones (ACSM)</p>
            </div>
            {[
              ["< 3", "Light", "text-blue-400", result.met < 3],
              ["3–6", "Moderate", "text-green-400", result.met >= 3 && result.met < 6],
              ["6–9", "Vigorous", "text-yellow-400", result.met >= 6 && result.met < 9],
              ["9–12", "Very High", "text-orange-400", result.met >= 9 && result.met < 12],
              ["> 12", "Maximum", "text-red-400", result.met >= 12],
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
                  <span className="text-caption bg-primary-500 text-white rounded-full px-2 py-0.5 ml-auto">
                    ← You
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Formula note */}
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {machine === "treadmill"
              ? `ACSM ${parseFloat(speed) * (unit === "metric" ? 1 / 1.60934 : 1) < 3.7 ? "walking" : "running"} metabolic equation · VO₂ = ${
                  parseFloat(speed) * (unit === "metric" ? 1 / 1.60934 : 1) < 3.7
                    ? "0.1×speed + 1.8×speed×grade + 3.5"
                    : "0.2×speed + 0.9×speed×grade + 3.5"
                }`
              : "ACSM leg-ergometry equation · VO₂ = 1.8×(W×6.12) / kg + 7"}
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
      const vo2 = Math.max(
        0,
        132.853 -
          0.0769 * wtLb -
          0.3877 * ageN +
          6.315 * (sex === "male" ? 1 : 0) -
          3.2649 * mins -
          0.1565 * hr
      );
      setResult({ vo2, cat: getVO2Category(vo2, sex) });
    }
  }

  const distUnit = unit === "imperial" ? "miles" : "km";
  const wtUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard title="VO₂max Field Tests" icon="M13 10V3L4 14h7v7l9-11h-7z">
      <div className="flex gap-2 flex-wrap">
        {(["cooper", "mile5", "rockport"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTest(t);
              setResult(null);
            }}
            className={`px-3 py-3 rounded-lg min-h-[44px] text-xs font-medium transition-colors ${test === t ? "bg-primary-500 text-white" : "bg-surface-100 dark:bg-surface-700 text-gray-600 dark:text-gray-300"}`}
          >
            {t === "cooper" ? "Cooper 12-min" : t === "mile5" ? "1.5-Mile Run" : "Rockport Walk"}
          </button>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Select
          value={sex}
          onChange={(v) => {
            setSex(v as "male" | "female");
            setResult(null);
          }}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <UnitToggle
          value={unit}
          onChange={(v) => {
            setUnit(v);
            setResult(null);
          }}
        />
      </div>

      {test === "cooper" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Run as far as possible in 12 minutes. Enter total distance covered.
          </p>
          <Row label={`Distance covered (${distUnit})`}>
            <NumInput
              value={distCooper}
              onChange={setDistCooper}
              placeholder={unit === "imperial" ? "1.5" : "2.4"}
              min="0.1"
              step="0.01"
            />
          </Row>
        </>
      )}

      {test === "mile5" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Run 1.5 miles as fast as possible on a measured course.
          </p>
          <p className="label text-gray-500 dark:text-gray-400">Finish time</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Minutes">
              <NumInput value={m5m} onChange={setM5m} placeholder="12" min="0" step="1" />
            </Row>
            <Row label="Seconds">
              <NumInput value={m5s} onChange={setM5s} placeholder="30" min="0" max="59" step="1" />
            </Row>
          </div>
        </>
      )}

      {test === "rockport" && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Walk 1 mile as fast as possible. Record time and HR immediately after finishing.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Age (years)">
              <NumInput value={age} onChange={setAge} placeholder="35" min="18" max="99" step="1" />
            </Row>
            <Row label={`Weight (${wtUnit})`}>
              <NumInput
                value={weight}
                onChange={setWeight}
                placeholder={unit === "imperial" ? "175" : "79"}
                min="1"
              />
            </Row>
          </div>
          <p className="label text-gray-500 dark:text-gray-400">Walk time</p>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Minutes">
              <NumInput value={rockM} onChange={setRockM} placeholder="14" min="0" step="1" />
            </Row>
            <Row label="Seconds">
              <NumInput
                value={rockS}
                onChange={setRockS}
                placeholder="45"
                min="0"
                max="59"
                step="1"
              />
            </Row>
          </div>
          <Row label="Heart rate immediately after (bpm)">
            <NumInput
              value={rockHR}
              onChange={setRockHR}
              placeholder="130"
              min="40"
              max="220"
              step="1"
            />
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
        {test === "cooper"
          ? "Cooper (1968) · VO₂max = (distance m − 504.9) / 44.73"
          : test === "mile5"
            ? "George et al. (1993) · VO₂max = 483 / time(min) + 3.5"
            : "Kline et al. (1987) Rockport 1-Mile Walk Test"}
      </p>
    </CalcCard>
  );
}

const HR_ZONES = [
  { name: "Zone 1", label: "Recovery", pctLow: 0.5, pctHigh: 0.6, color: "bg-blue-400" },
  { name: "Zone 2", label: "Aerobic Base", pctLow: 0.6, pctHigh: 0.7, color: "bg-green-400" },
  { name: "Zone 3", label: "Aerobic", pctLow: 0.7, pctHigh: 0.8, color: "bg-yellow-400" },
  { name: "Zone 4", label: "Threshold", pctLow: 0.8, pctHigh: 0.9, color: "bg-orange-400" },
  { name: "Zone 5", label: "VO₂max", pctLow: 0.9, pctHigh: 1.0, color: "bg-red-500" },
];

function HeartRateZoneCalc() {
  const [ageInput, setAgeInput] = useState("");
  const [maxHRInput, setMaxHRInput] = useState("");
  const [restHR, setRestHR] = useState("");
  const [method, setMethod] = useState<"karvonen" | "percent">("karvonen");

  const results = useMemo(() => {
    const age = parseFloat(ageInput);
    const rhr = parseFloat(restHR);
    let mhr = parseFloat(maxHRInput);
    if (!mhr && age) mhr = 220 - age;
    if (!mhr) return null;
    return HR_ZONES.map((z) => {
      const useKarvonen = method === "karvonen" && rhr > 0;
      const low = useKarvonen
        ? Math.round((mhr - rhr) * z.pctLow + rhr)
        : Math.round(mhr * z.pctLow);
      const high = useKarvonen
        ? Math.round((mhr - rhr) * z.pctHigh + rhr)
        : Math.round(mhr * z.pctHigh);
      return { ...z, low, high };
    });
  }, [ageInput, maxHRInput, restHR, method]);

  const estimatedMax = ageInput && !maxHRInput ? Math.round(220 - parseFloat(ageInput)) : null;

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">Heart Rate Zones</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          5 training zones via Karvonen (HRR) or % max HR
        </p>
      </div>
      <div className="flex gap-2">
        {(["karvonen", "percent"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`flex-1 py-3 rounded-lg min-h-[44px] text-sm font-medium transition-colors ${method === m ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
          >
            {m === "karvonen" ? "Karvonen" : "% Max HR"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Age</label>
          <input
            className="input"
            type="number"
            placeholder="25"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
          />
        </div>
        <div>
          <label className="label">
            Max HR
            {estimatedMax ? (
              <span className="normal-case font-normal text-gray-400 ml-1">
                (est. {estimatedMax})
              </span>
            ) : (
              ""
            )}
          </label>
          <input
            className="input"
            type="number"
            placeholder={estimatedMax ? String(estimatedMax) : "195"}
            value={maxHRInput}
            onChange={(e) => setMaxHRInput(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Resting HR</label>
          <input
            className="input"
            type="number"
            placeholder="60"
            value={restHR}
            onChange={(e) => setRestHR(e.target.value)}
            disabled={method === "percent"}
          />
        </div>
      </div>
      {results && (
        <div className="space-y-2">
          {results.map((z) => (
            <div
              key={z.name}
              className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3"
            >
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${z.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {z.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{z.label}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {Math.round(z.pctLow * 100)}–{Math.round(z.pctHigh * 100)}% intensity
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {z.low}–{z.high}
                </div>
                <div className="text-xs text-gray-400">bpm</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CardioTab() {
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
