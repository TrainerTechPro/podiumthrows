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

function BodyFatGirthCalc() {
  const [height, setHeight] = useState("");
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [result, setResult] = useState<{ bf: number; fat: number; lbm: number } | null>(null);

  const calc = useCallback(() => {
    const h = parseFloat(height);
    const n = parseFloat(neck);
    const w = parseFloat(waist);
    const hp = parseFloat(hip);
    const bw = parseFloat(weight);
    if (!h || !n || !w || !bw) return;
    if (sex === "female" && !hp) return;

    // Convert to cm if imperial
    const hCm = unit === "imperial" ? inToCm(h) : h;
    const nCm = unit === "imperial" ? inToCm(n) : n;
    const wCm = unit === "imperial" ? inToCm(w) : w;
    const hpCm = unit === "imperial" ? inToCm(hp) : hp;
    const bwKg = unit === "imperial" ? lbToKg(bw) : bw;

    let bf: number;
    if (sex === "male") {
      bf = 86.01 * Math.log10(wCm - nCm) - 70.041 * Math.log10(hCm) + 30.3;
    } else {
      bf = 163.205 * Math.log10(wCm + hpCm - nCm) - 97.684 * Math.log10(hCm) - 78.387;
    }
    bf = Math.max(0, Math.min(bf, 70));
    const fat = (bwKg * bf) / 100;
    const lbm = bwKg - fat;
    setResult({ bf, fat, lbm });
  }, [height, neck, waist, hip, weight, sex, unit]);

  const unitLabel = unit === "imperial" ? "in" : "cm";
  const wUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="Body Fat (Navy Girth Method)"
      icon="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
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
        <Row label={`Height (${unitLabel})`}>
          <NumInput
            value={height}
            onChange={setHeight}
            placeholder={unit === "imperial" ? "70" : "178"}
            min="1"
          />
        </Row>
        <Row label={`Neck (${unitLabel})`}>
          <NumInput
            value={neck}
            onChange={setNeck}
            placeholder={unit === "imperial" ? "15" : "38"}
            min="1"
          />
        </Row>
        <Row label={`Waist (${unitLabel})`}>
          <NumInput
            value={waist}
            onChange={setWaist}
            placeholder={unit === "imperial" ? "33" : "84"}
            min="1"
          />
        </Row>
        {sex === "female" && (
          <Row label={`Hip (${unitLabel})`}>
            <NumInput
              value={hip}
              onChange={setHip}
              placeholder={unit === "imperial" ? "38" : "97"}
              min="1"
            />
          </Row>
        )}
        <Row label={`Body weight (${wUnit})`}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "175" : "79"}
            min="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Body Fat %" value={`${fmt(result.bf, 1)}%`} />
          <ResultBox
            label="Fat mass"
            value={`${fmt(unit === "imperial" ? kgToLb(result.fat) : result.fat, 1)} ${wUnit}`}
          />
          <ResultBox
            label="Lean mass"
            value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`}
          />
        </div>
      )}
    </CalcCard>
  );
}

function SkinfoldCalc() {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  // Male sites: chest, abdomen, thigh
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [s3, setS3] = useState("");
  const [result, setResult] = useState<{ bd: number; bf: number; fat: number; lbm: number } | null>(
    null
  );

  const calc = useCallback(() => {
    const a = parseFloat(age);
    const sf1 = parseFloat(s1),
      sf2 = parseFloat(s2),
      sf3 = parseFloat(s3);
    const bw = parseFloat(weight);
    if (!a || !sf1 || !sf2 || !sf3 || !bw) return;
    const S = sf1 + sf2 + sf3;
    let bd: number;
    if (sex === "male") {
      bd = 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * a;
    } else {
      bd = 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * a;
    }
    const bf = (4.95 / bd - 4.5) * 100;
    const bwKg = unit === "imperial" ? lbToKg(bw) : bw;
    const fat = (bwKg * bf) / 100;
    const lbm = bwKg - fat;
    setResult({ bd, bf: Math.max(0, bf), fat, lbm });
  }, [age, sex, s1, s2, s3, weight, unit]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  const sites =
    sex === "male"
      ? ["Chest (mm)", "Abdomen (mm)", "Thigh (mm)"]
      : ["Tricep (mm)", "Suprailiac (mm)", "Thigh (mm)"];

  return (
    <CalcCard
      title="Body Composition (3-Site Skinfold)"
      icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 10h.01M12 10h.01M15 10h.01M9 13h.01M12 13h.01M15 13h.01M4 6h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10-4H10v4h4V2z"
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
          <NumInput value={age} onChange={setAge} placeholder="25" min="1" max="120" step="1" />
        </Row>
        <Row label={`Body weight (${wUnit})`}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "180" : "82"}
            min="1"
          />
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
            <ResultBox
              label="Fat mass"
              value={`${fmt(unit === "imperial" ? kgToLb(result.fat) : result.fat, 1)} ${wUnit}`}
            />
            <ResultBox
              label="Lean mass"
              value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`}
            />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <p className="label text-gray-500 dark:text-gray-400">
                {sex === "male" ? "Male" : "Female"} body fat norms
              </p>
            </div>
            {(sex === "male"
              ? [
                  ["2–5%", "Essential fat"],
                  ["6–13%", "Athletes"],
                  ["14–17%", "Fitness"],
                  ["18–24%", "Acceptable"],
                  ["≥ 25%", "Obese"],
                ]
              : [
                  ["10–13%", "Essential fat"],
                  ["14–20%", "Athletes"],
                  ["21–24%", "Fitness"],
                  ["25–31%", "Acceptable"],
                  ["≥ 32%", "Obese"],
                ]
            ).map(([range, label]) => (
              <div
                key={label}
                className="flex justify-between px-3 py-1.5 text-caption border-b border-gray-100 dark:border-white/5 last:border-0"
              >
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

// ── Jackson-Pollock 7-Site Skinfold ──────────────────────────────────
const JP7_SITES = [
  "chest",
  "midaxillary",
  "tricep",
  "subscapular",
  "abdomen",
  "suprailiac",
  "thigh",
] as const;
type JP7Site = (typeof JP7_SITES)[number];
const JP7_LABELS: Record<JP7Site, string> = {
  chest: "Chest",
  midaxillary: "Midaxillary",
  tricep: "Tricep",
  subscapular: "Subscapular",
  abdomen: "Abdomen",
  suprailiac: "Suprailiac",
  thigh: "Thigh",
};

function Skinfold7Calc() {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [sites, setSites] = useState<Record<JP7Site, string>>({
    chest: "",
    midaxillary: "",
    tricep: "",
    subscapular: "",
    abdomen: "",
    suprailiac: "",
    thigh: "",
  });

  const result = useMemo(() => {
    const a = parseFloat(age);
    const w = parseFloat(weight);
    const vals = JP7_SITES.map((s) => parseFloat(sites[s]));
    if (!a || !w || vals.some(isNaN)) return null;
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const density =
      sex === "male"
        ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * a
        : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * a;
    const bf = (4.95 / density - 4.5) * 100;
    const wKg = unit === "imperial" ? lbToKg(w) : w;
    const fatMass = (wKg * bf) / 100;
    const lbm = wKg - fatMass;
    return { bf, fatMass, lbm, sum };
  }, [sex, unit, age, weight, sites]);

  const wUnit = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="Body Fat — JP 7-Site Skinfold"
      icon="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
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
        <Row label="Age (years)">
          <NumInput value={age} onChange={setAge} placeholder="30" min="1" max="99" step="1" />
        </Row>
        <Row label={`Weight (${wUnit})`}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "175" : "79"}
            min="1"
          />
        </Row>
      </div>
      <p className="label text-gray-500 dark:text-gray-400">
        Skinfold measurements (mm) — all 7 sites required
      </p>
      <div className="grid grid-cols-2 gap-3">
        {JP7_SITES.map((site) => (
          <Row key={site} label={JP7_LABELS[site]}>
            <NumInput
              value={sites[site]}
              onChange={(v) => setSites((p) => ({ ...p, [site]: v }))}
              placeholder="15"
              min="1"
              step="0.5"
            />
          </Row>
        ))}
      </div>
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <ResultBox label="Body Fat %" value={`${fmt(result.bf, 1)}%`} />
            <ResultBox
              label="Fat mass"
              value={`${fmt(unit === "imperial" ? kgToLb(result.fatMass) : result.fatMass, 1)} ${wUnit}`}
            />
            <ResultBox
              label="Lean mass"
              value={`${fmt(unit === "imperial" ? kgToLb(result.lbm) : result.lbm, 1)} ${wUnit}`}
            />
          </div>
          <ResultBox
            label="7-site sum"
            value={`${fmt(result.sum, 1)} mm`}
            sub="Total of all 7 measurements"
          />
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Jackson & Pollock (1978) 7-site formula · Siri equation · More accurate than 3-site
      </p>
    </CalcCard>
  );
}

export function BodyStatsTab() {
  return (
    <div className="space-y-4">
      <BodyFatGirthCalc />
      <SkinfoldCalc />
      <Skinfold7Calc />
    </div>
  );
}
