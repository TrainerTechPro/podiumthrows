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
  inToM,
  type UnitSystem,
} from "./ToolCard";

function secsToHMS(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function PaceCalc() {
  const [distance, setDistance] = useState("");
  const [distUnit, setDistUnit] = useState("miles");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [result, setResult] = useState<{
    paceMile: number;
    paceKm: number;
    speedMph: number;
    speedKph: number;
    proj5k: number;
    proj10k: number;
    projHalf: number;
    projFull: number;
  } | null>(null);

  const calc = useCallback(() => {
    const d = parseFloat(distance);
    const h = parseFloat(hours) || 0;
    const min = parseFloat(minutes) || 0;
    const sec = parseFloat(seconds) || 0;
    if (!d) return;
    const totalSec = h * 3600 + min * 60 + sec;
    if (totalSec === 0) return;
    const distMiles = distUnit === "miles" ? d : distUnit === "km" ? d / 1.60934 : d / 1609.34; // meters
    const paceMile = totalSec / distMiles;
    const paceKm = paceMile / 1.60934;
    const speedMph = distMiles / (totalSec / 3600);
    const speedKph = speedMph * 1.60934;
    setResult({
      paceMile,
      paceKm,
      speedMph,
      speedKph,
      proj5k: paceKm * 5,
      proj10k: paceKm * 10,
      projHalf: paceMile * 13.1094,
      projFull: paceMile * 26.2188,
    });
  }, [distance, distUnit, hours, minutes, seconds]);

  return (
    <CalcCard title="Pace Calculator" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Distance">
          <NumInput
            value={distance}
            onChange={setDistance}
            placeholder="5"
            min="0.01"
            step="0.01"
          />
        </Row>
        <Row label="Unit">
          <Select
            value={distUnit}
            onChange={setDistUnit}
            options={[
              { value: "miles", label: "Miles" },
              { value: "km", label: "Kilometers" },
              { value: "meters", label: "Meters" },
            ]}
          />
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Time (hh:mm:ss)</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours">
          <NumInput value={hours} onChange={setHours} placeholder="0" min="0" step="1" />
        </Row>
        <Row label="Minutes">
          <NumInput
            value={minutes}
            onChange={setMinutes}
            placeholder="25"
            min="0"
            max="59"
            step="1"
          />
        </Row>
        <Row label="Seconds">
          <NumInput
            value={seconds}
            onChange={setSeconds}
            placeholder="00"
            min="0"
            max="59"
            step="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Pace / mile" value={secsToHMS(result.paceMile) + " /mi"} />
            <ResultBox label="Pace / km" value={secsToHMS(result.paceKm) + " /km"} />
            <ResultBox label="Speed" value={`${fmt(result.speedMph, 2)} mph`} />
            <ResultBox label="Speed" value={`${fmt(result.speedKph, 2)} km/h`} />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">Projected finish times</p>
            </div>
            {[
              ["5K", result.proj5k],
              ["10K", result.proj10k],
              ["Half Marathon", result.projHalf],
              ["Marathon", result.projFull],
            ].map(([label, secs]) => (
              <div
                key={label as string}
                className="flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <span className="text-gray-700 dark:text-gray-300">{label as string}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {secsToHMS(secs as number)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CalcCard>
  );
}

function DistSpeedTimeCalc() {
  const [distance, setDistance] = useState("");
  const [speed, setSpeed] = useState("");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("");
  const [timeS, setTimeS] = useState("");
  const [distUnit, setDistUnit] = useState("miles");
  const [speedUnit, setSpeedUnit] = useState("mph");
  const [solve, setSolve] = useState("time");
  const [result, setResult] = useState<string | null>(null);

  const calc = useCallback(() => {
    const d = parseFloat(distance);
    const sp = parseFloat(speed);
    const t =
      (parseFloat(timeH) || 0) * 3600 + (parseFloat(timeM) || 0) * 60 + (parseFloat(timeS) || 0);

    if (solve === "time" && d && sp) {
      const distM = distUnit === "miles" ? d * 1609.344 : distUnit === "km" ? d * 1000 : d;
      const spMS = speedUnit === "mph" ? sp / 2.23694 : speedUnit === "kph" ? sp / 3.6 : sp;
      const secs = distM / spMS;
      setResult(secsToHMS(secs));
    } else if (solve === "distance" && sp && t > 0) {
      const spMS = speedUnit === "mph" ? sp / 2.23694 : speedUnit === "kph" ? sp / 3.6 : sp;
      const distM = spMS * t;
      const val =
        distUnit === "miles" ? distM / 1609.344 : distUnit === "km" ? distM / 1000 : distM;
      setResult(`${fmt(val, 3)} ${distUnit}`);
    } else if (solve === "speed" && d && t > 0) {
      const distM = distUnit === "miles" ? d * 1609.344 : distUnit === "km" ? d * 1000 : d;
      const spMS = distM / t;
      const val = speedUnit === "mph" ? spMS * 2.23694 : speedUnit === "kph" ? spMS * 3.6 : spMS;
      setResult(`${fmt(val, 3)} ${speedUnit}`);
    }
  }, [distance, speed, timeH, timeM, timeS, distUnit, speedUnit, solve]);

  return (
    <CalcCard title="Distance / Speed / Time" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <Row label="Solve for">
        <Select
          value={solve}
          onChange={setSolve}
          options={[
            { value: "time", label: "Time" },
            { value: "distance", label: "Distance" },
            { value: "speed", label: "Speed" },
          ]}
        />
      </Row>
      {solve !== "distance" && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <Row label="Distance">
            <NumInput
              value={distance}
              onChange={setDistance}
              placeholder="5"
              min="0.01"
              step="any"
            />
          </Row>
          <Row label="Distance unit">
            <Select
              value={distUnit}
              onChange={setDistUnit}
              options={[
                { value: "miles", label: "Miles" },
                { value: "km", label: "Km" },
                { value: "meters", label: "Meters" },
              ]}
            />
          </Row>
        </div>
      )}
      {solve !== "speed" && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <Row label="Speed">
            <NumInput value={speed} onChange={setSpeed} placeholder="8" min="0.01" step="any" />
          </Row>
          <Row label="Speed unit">
            <Select
              value={speedUnit}
              onChange={setSpeedUnit}
              options={[
                { value: "mph", label: "mph" },
                { value: "kph", label: "km/h" },
                { value: "mps", label: "m/s" },
              ]}
            />
          </Row>
        </div>
      )}
      {solve !== "time" && (
        <>
          <p className="label text-gray-500 dark:text-gray-400">Time</p>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Hours">
              <NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" />
            </Row>
            <Row label="Min">
              <NumInput
                value={timeM}
                onChange={setTimeM}
                placeholder="30"
                min="0"
                max="59"
                step="1"
              />
            </Row>
            <Row label="Sec">
              <NumInput
                value={timeS}
                onChange={setTimeS}
                placeholder="00"
                min="0"
                max="59"
                step="1"
              />
            </Row>
          </div>
        </>
      )}
      <CalcButton onClick={calc} />
      {result && <ResultBox label={`Result (${solve})`} value={result} />}
    </CalcCard>
  );
}

function StepsCalc() {
  const [steps, setSteps] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{
    miles: number;
    km: number;
    feet: number;
    meters: number;
  } | null>(null);

  const calc = useCallback(() => {
    const st = parseFloat(steps);
    const h = parseFloat(height);
    if (!st || !h) return;
    const hM = unit === "imperial" ? inToM(h) : h / 100;
    const coef = sex === "male" ? 0.415 : 0.413;
    const strideM = hM * coef; // step length in meters
    const distM = st * strideM;
    setResult({ miles: distM / 1609.344, km: distM / 1000, feet: distM / 0.3048, meters: distM });
  }, [steps, height, sex, unit]);

  return (
    <CalcCard
      title="Steps to Distance"
      icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
        <Row label="Steps">
          <NumInput value={steps} onChange={setSteps} placeholder="10000" min="1" step="1" />
        </Row>
        <Row label={unit === "imperial" ? "Height (in)" : "Height (cm)"}>
          <NumInput
            value={height}
            onChange={setHeight}
            placeholder={unit === "imperial" ? "70" : "178"}
            min="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-2 gap-2">
          <ResultBox label="Miles" value={fmt(result.miles, 3)} />
          <ResultBox label="Km" value={fmt(result.km, 3)} />
          <ResultBox label="Meters" value={fmt(result.meters, 0)} />
          <ResultBox label="Feet" value={fmt(result.feet, 0)} />
        </div>
      )}
    </CalcCard>
  );
}

// ── Training Pace Zones (Daniels VDOT) ───────────────────────────────
function computeVDOT(distanceM: number, timeMin: number): number {
  const v = distanceM / timeMin;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pct =
    0.8 + 0.1894393 * Math.exp(-0.012778 * timeMin) + 0.2989558 * Math.exp(-0.1932605 * timeMin);
  return vo2 / pct;
}

function vdotToPaceMinPerMile(vdot: number, pctVo2: number): number {
  const targetVO2 = vdot * pctVo2;
  const a = 0.000104,
    b = 0.182258,
    c_val = -4.6 - targetVO2;
  const disc = b * b - 4 * a * c_val;
  if (disc <= 0) return 0;
  const vMperMin = (-b + Math.sqrt(disc)) / (2 * a);
  return vMperMin > 0 ? 1609.34 / vMperMin : 0;
}

const VDOT_DISTANCES = [
  { value: "1500", label: "1500m", meters: 1500 },
  { value: "mile", label: "1 Mile", meters: 1609.34 },
  { value: "5k", label: "5K", meters: 5000 },
  { value: "10k", label: "10K", meters: 10000 },
  { value: "half", label: "Half Marathon", meters: 21097.5 },
  { value: "marathon", label: "Marathon", meters: 42195 },
];

const PACE_ZONES = [
  { name: "Easy", pct: 0.59, desc: "Conversational, aerobic base" },
  { name: "Long", pct: 0.625, desc: "Long runs, slightly above easy" },
  { name: "Marathon", pct: 0.77, desc: "Goal marathon race pace" },
  { name: "Threshold", pct: 0.88, desc: "Comfortably hard, lactate threshold" },
  { name: "Interval", pct: 0.975, desc: "5K effort, VO₂max development" },
  { name: "Repetition", pct: 1.1, desc: "Speed/form work, short reps" },
];

const PACE_ZONE_COLORS = [
  "bg-blue-400",
  "bg-green-400",
  "bg-yellow-400",
  "bg-orange-400",
  "bg-red-400",
  "bg-purple-500",
];

function TrainingPaceZonesCalc() {
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [distance, setDistance] = useState("5k");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("20");
  const [timeS, setTimeS] = useState("0");
  const [result, setResult] = useState<{ vdot: number; paces: number[] } | null>(null);

  function calc() {
    const totalSec =
      (parseFloat(timeH) || 0) * 3600 + (parseFloat(timeM) || 0) * 60 + (parseFloat(timeS) || 0);
    if (!totalSec) return;
    const dist = VDOT_DISTANCES.find((d) => d.value === distance)!;
    const vdot = computeVDOT(dist.meters, totalSec / 60);
    const paces = PACE_ZONES.map((z) => vdotToPaceMinPerMile(vdot, z.pct));
    setResult({ vdot, paces });
  }

  function formatPace(minPerMile: number): string {
    const pace = unit === "metric" ? minPerMile / 1.60934 : minPerMile;
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")} /${unit === "metric" ? "km" : "mi"}`;
  }

  return (
    <CalcCard title="Training Pace Zones" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
      <UnitToggle
        value={unit}
        onChange={(v) => {
          setUnit(v);
          setResult(null);
        }}
      />
      <Row label="Recent race distance">
        <select
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="input w-full"
        >
          {VDOT_DISTANCES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Row>
      <p className="label text-gray-500 dark:text-gray-400">Race finish time</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours">
          <NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" />
        </Row>
        <Row label="Minutes">
          <NumInput value={timeM} onChange={setTimeM} placeholder="20" min="0" max="59" step="1" />
        </Row>
        <Row label="Seconds">
          <NumInput value={timeS} onChange={setTimeS} placeholder="00" min="0" max="59" step="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <ResultBox
            label="VDOT / VO₂max est."
            value={fmt(result.vdot, 1)}
            sub="Daniels fitness indicator"
          />
          <div className="space-y-1.5">
            {PACE_ZONES.map((zone, i) => (
              <div
                key={zone.name}
                className="flex items-center gap-3 rounded-xl bg-surface-50 dark:bg-surface-800 border border-gray-200/60 dark:border-white/5 px-3.5 py-2.5"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PACE_ZONE_COLORS[i]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {zone.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {zone.desc}
                  </div>
                </div>
                <div className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0">
                  {formatPace(result.paces[i])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Jack Daniels VDOT methodology · Enter a recent race time for best accuracy
      </p>
    </CalcCard>
  );
}

// ── Age-Graded Running Performance ───────────────────────────────────
// WMA-style performance factors: fraction of peak at ~25-30 yrs
const AGE_PERF_FACTORS: Record<"male" | "female", [number, number][]> = {
  male: [
    [15, 0.93],
    [20, 0.975],
    [25, 1.0],
    [30, 0.998],
    [35, 0.978],
    [40, 0.952],
    [45, 0.916],
    [50, 0.877],
    [55, 0.832],
    [60, 0.781],
    [65, 0.726],
    [70, 0.676],
    [75, 0.62],
    [80, 0.568],
    [85, 0.511],
    [90, 0.461],
  ],
  female: [
    [15, 0.92],
    [20, 0.97],
    [25, 1.0],
    [30, 0.998],
    [35, 0.972],
    [40, 0.935],
    [45, 0.892],
    [50, 0.844],
    [55, 0.793],
    [60, 0.737],
    [65, 0.677],
    [70, 0.618],
    [75, 0.563],
    [80, 0.511],
    [85, 0.455],
    [90, 0.404],
  ],
};

// Open world records in seconds (male / female)
const AGE_GRADE_DISTANCES = [
  { value: "mile", label: "1 Mile", mWR: 223.13, fWR: 252.33 },
  { value: "5k", label: "5K", mWR: 755.36, fWR: 845.4 },
  { value: "10k", label: "10K", mWR: 1571, fWR: 1741 },
  { value: "half", label: "Half Marathon", mWR: 3451, fWR: 3772 },
  { value: "marathon", label: "Marathon", mWR: 7235, fWR: 7913 },
];

function getAgePerfFactor(age: number, sex: "male" | "female"): number {
  const table = AGE_PERF_FACTORS[sex];
  for (let i = table.length - 1; i >= 0; i--) {
    if (age >= table[i][0]) {
      if (i < table.length - 1) {
        const [a0, f0] = table[i],
          [a1, f1] = table[i + 1];
        return f0 + ((f1 - f0) * (age - a0)) / (a1 - a0);
      }
      return table[i][1];
    }
  }
  return table[0][1];
}

function AgeGradedRunningCalc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [distance, setDistance] = useState("5k");
  const [timeH, setTimeH] = useState("");
  const [timeM, setTimeM] = useState("25");
  const [timeS, setTimeS] = useState("0");
  const [result, setResult] = useState<{
    agPct: number;
    ageEquivSec: number;
    category: string;
  } | null>(null);

  function secsToStr(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.round(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
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
    const totalSec =
      (parseFloat(timeH) || 0) * 3600 + (parseFloat(timeM) || 0) * 60 + (parseFloat(timeS) || 0);
    const ageN = parseFloat(age);
    if (!totalSec || !ageN) return;
    const dist = AGE_GRADE_DISTANCES.find((d) => d.value === distance)!;
    const wr = sex === "male" ? dist.mWR : dist.fWR;
    const af = getAgePerfFactor(ageN, sex);
    // AG% = age-adjusted WR / athlete time × 100
    const agPct = Math.min(100, (wr / af / totalSec) * 100);
    // Open-age equivalent: what you'd run at peak age
    const ageEquivSec = totalSec * af;
    setResult({ agPct, ageEquivSec, category: getAGCategory(agPct) });
  }

  return (
    <CalcCard
      title="Age-Graded Running"
      icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    >
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
      <div className="grid grid-cols-2 gap-3">
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="45" min="15" max="99" step="1" />
        </Row>
        <Row label="Race distance">
          <select
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="input w-full"
          >
            {AGE_GRADE_DISTANCES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">Finish time</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="Hours">
          <NumInput value={timeH} onChange={setTimeH} placeholder="0" min="0" step="1" />
        </Row>
        <Row label="Minutes">
          <NumInput value={timeM} onChange={setTimeM} placeholder="25" min="0" max="59" step="1" />
        </Row>
        <Row label="Seconds">
          <NumInput value={timeS} onChange={setTimeS} placeholder="00" min="0" max="59" step="1" />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ResultBox
              label="Age Grade %"
              value={`${fmt(result.agPct, 1)}%`}
              sub={result.category}
            />
            <ResultBox
              label="Peak-age equivalent"
              value={secsToStr(result.ageEquivSec)}
              sub="If you were at peak age"
            />
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${result.agPct}%` }}
            />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden text-xs">
            {[
              ["≥ 90%", "World Class"],
              ["≥ 80%", "National Class"],
              ["≥ 70%", "Regional Class"],
              ["≥ 60%", "Local Class"],
              ["≥ 50%", "Recreational"],
              ["< 50%", "Participant"],
            ].map(([pct, label]) => (
              <div
                key={label}
                className="flex justify-between px-3 py-1.5 border-b border-gray-200/40 dark:border-white/5 last:border-0"
              >
                <span className="text-gray-500 dark:text-gray-400">{pct}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        WMA-style age grading · Compares performance fairly across ages and sexes
      </p>
    </CalcCard>
  );
}

const SPRINT_DISTS = [
  { label: "10m", key: "d10" },
  { label: "20m", key: "d20" },
  { label: "30m", key: "d30" },
  { label: "40m", key: "d40" },
  { label: "60m", key: "d60" },
  { label: "100m", key: "d100" },
] as const;

type SprintDistKey = (typeof SPRINT_DISTS)[number]["key"];

const SPRINT_DIST_M: Record<SprintDistKey, number> = {
  d10: 10,
  d20: 20,
  d30: 30,
  d40: 40,
  d60: 60,
  d100: 100,
};

function SprintSplitCalc() {
  const [times, setTimes] = useState<Record<SprintDistKey, string>>({
    d10: "",
    d20: "",
    d30: "",
    d40: "",
    d60: "",
    d100: "",
  });

  const results = useMemo(() => {
    const filled = SPRINT_DISTS.filter((d) => times[d.key] && parseFloat(times[d.key]) > 0)
      .map((d) => ({
        label: d.label,
        key: d.key,
        dist: SPRINT_DIST_M[d.key],
        time: parseFloat(times[d.key]),
      }))
      .sort((a, b) => a.dist - b.dist);
    if (filled.length === 0) return null;
    const rows = filled.map((s, i) => {
      const splitTime = i === 0 ? s.time : s.time - filled[i - 1].time;
      const splitDist = i === 0 ? s.dist : s.dist - filled[i - 1].dist;
      const segMs = splitDist / splitTime;
      const avgMs = s.dist / s.time;
      return {
        label: s.label,
        totalTime: s.time.toFixed(2),
        avgMs: avgMs.toFixed(2),
        avgMph: (avgMs * 2.23694).toFixed(1),
        segMs: segMs.toFixed(2),
        segMph: (segMs * 2.23694).toFixed(1),
        isFirst: i === 0,
      };
    });
    const topMs = Math.max(...rows.map((r) => parseFloat(r.segMs)));
    return { rows, topMs: topMs.toFixed(2), topMph: (topMs * 2.23694).toFixed(1) };
  }, [times]);

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base text-gray-900 dark:text-white">
          Sprint Split Analyzer
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          FAT or hand times → velocity and acceleration phase breakdown
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {SPRINT_DISTS.map((d) => (
          <div key={d.key}>
            <label className="label">{d.label} (sec)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder={
                d.key === "d10" ? "1.80" : d.key === "d20" ? "3.00" : d.key === "d40" ? "4.60" : ""
              }
              value={times[d.key]}
              onChange={(e) => setTimes((prev) => ({ ...prev, [d.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {results && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4 text-center">
              <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                {results.topMs}
              </div>
              <div className="text-xs text-primary-500/70 mt-0.5">Top Speed (m/s)</div>
            </div>
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-4 text-center">
              <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                {results.topMph}
              </div>
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
                {results.rows.map((row) => (
                  <tr key={row.label} className="dark:bg-gray-800/20">
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                      {row.label}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {row.totalTime}s
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                      {row.isFirst ? row.avgMs : row.segMs}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {row.isFirst ? row.avgMph : row.segMph}
                    </td>
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

export function RunningTab() {
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
