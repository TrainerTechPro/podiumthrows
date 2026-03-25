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
  inToM,
  type UnitSystem,
} from "./ToolCard";

function BMICalc() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [bmi, setBmi] = useState<number | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h) return;
    const kg = unit === "imperial" ? lbToKg(w) : w;
    const m = unit === "imperial" ? inToM(h) : h / 100;
    setBmi(kg / (m * m));
  }, [weight, height, unit]);

  const getCategory = (b: number) => {
    if (b < 18.5) return { label: "Underweight", color: "text-blue-500" };
    if (b < 25.0) return { label: "Normal weight", color: "text-green-500" };
    if (b < 30.0) return { label: "Overweight", color: "text-yellow-500" };
    if (b < 35.0) return { label: "Obese (Class I)", color: "text-orange-500" };
    if (b < 40.0) return { label: "Obese (Class II)", color: "text-red-500" };
    return { label: "Obese (Class III)", color: "text-red-700" };
  };

  return (
    <CalcCard
      title="BMI Calculator"
      icon="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    >
      <UnitToggle value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Row label={unit === "imperial" ? "Weight (lbs)" : "Weight (kg)"}>
          <NumInput
            value={weight}
            onChange={setWeight}
            placeholder={unit === "imperial" ? "180" : "82"}
            min="1"
          />
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
      {bmi !== null &&
        (() => {
          const cat = getCategory(bmi);
          return (
            <div className="space-y-2">
              <ResultBox label="BMI" value={fmt(bmi, 1)} sub={cat.label} />
              <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
                {[
                  ["< 18.5", "Underweight", "text-blue-500"],
                  ["18.5 – 24.9", "Normal weight", "text-green-500"],
                  ["25.0 – 29.9", "Overweight", "text-yellow-500"],
                  ["30.0 – 34.9", "Obese Class I", "text-orange-500"],
                  ["35.0 – 39.9", "Obese Class II", "text-red-500"],
                  ["≥ 40.0", "Obese Class III", "text-red-700"],
                ].map(([range, label, color]) => (
                  <div
                    key={label}
                    className={`flex justify-between px-3 py-2 text-caption border-b border-gray-100 dark:border-white/5 last:border-0 ${
                      cat.label === label || cat.label.startsWith(label.split(" (")[0])
                        ? "bg-primary-50 dark:bg-primary-900/10"
                        : ""
                    }`}
                  >
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
  const [hip, setHip] = useState("");
  const [sex, setSex] = useState("male");
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [ratio, setRatio] = useState<number | null>(null);

  const calc = useCallback(() => {
    const w = parseFloat(waist);
    const h = parseFloat(hip);
    if (!w || !h || h === 0) return;
    setRatio(w / h);
  }, [waist, hip]);

  const getRisk = (r: number, sex: string) => {
    if (sex === "male") {
      if (r < 0.95) return { label: "Low risk", color: "text-green-500" };
      if (r <= 1.0) return { label: "Moderate risk", color: "text-yellow-500" };
      return { label: "High risk", color: "text-red-500" };
    } else {
      if (r < 0.8) return { label: "Low risk", color: "text-green-500" };
      if (r <= 0.85) return { label: "Moderate risk", color: "text-yellow-500" };
      return { label: "High risk", color: "text-red-500" };
    }
  };

  const unitLabel = unit === "imperial" ? "in" : "cm";

  return (
    <CalcCard
      title="Waist-Hip Ratio"
      icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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
        <Row label={`Waist (${unitLabel})`}>
          <NumInput
            value={waist}
            onChange={setWaist}
            placeholder={unit === "imperial" ? "32" : "81"}
            min="1"
          />
        </Row>
        <Row label={`Hip (${unitLabel})`}>
          <NumInput
            value={hip}
            onChange={setHip}
            placeholder={unit === "imperial" ? "38" : "96"}
            min="1"
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {ratio !== null &&
        (() => {
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
      title="Body Fat (Girth Method)"
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
          {/* Classification */}
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
    const devineKg = male ? 50 + 2.3 * excess : 45.5 + 2.3 * excess;
    const robinsonKg = male ? 52 + 1.9 * excess : 49 + 1.7 * excess;
    const millerKg = male ? 56.2 + 1.41 * excess : 53.1 + 1.36 * excess;
    const hamwiKg = male ? (106 + 6 * excess) / 2.205 : (100 + 5 * excess) / 2.205;
    const avgKg = (devineKg + robinsonKg + millerKg + hamwiKg) / 4;
    const conv = (kg: number) => (unit === "imperial" ? kgToLb(kg) : kg);
    return {
      devine: conv(devineKg),
      robinson: conv(robinsonKg),
      miller: conv(millerKg),
      hamwi: conv(hamwiKg),
      avg: conv(avgKg),
    };
  }, [sex, unit, heightFt, heightIn, heightCm]);

  const u = unit === "imperial" ? "lbs" : "kg";

  return (
    <CalcCard
      title="Ideal Body Weight"
      icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
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
      {unit === "imperial" ? (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Height (ft)">
            <NumInput
              value={heightFt}
              onChange={setHeightFt}
              placeholder="5"
              min="1"
              max="8"
              step="1"
            />
          </Row>
          <Row label="Height (in)">
            <NumInput
              value={heightIn}
              onChange={setHeightIn}
              placeholder="10"
              min="0"
              max="11"
              step="1"
            />
          </Row>
        </div>
      ) : (
        <Row label="Height (cm)">
          <NumInput value={heightCm} onChange={setHeightCm} placeholder="178" min="50" />
        </Row>
      )}
      {result && (
        <div className="space-y-2">
          <ResultBox
            label="Average (all formulas)"
            value={`${fmt(result.avg, 0)} ${u}`}
            sub="Recommended reference point"
          />
          <div className="grid grid-cols-2 gap-2">
            <ResultBox label="Devine" value={`${fmt(result.devine, 0)} ${u}`} />
            <ResultBox label="Robinson" value={`${fmt(result.robinson, 0)} ${u}`} />
            <ResultBox label="Miller" value={`${fmt(result.miller, 0)} ${u}`} />
            <ResultBox label="Hamwi" value={`${fmt(result.hamwi, 0)} ${u}`} />
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Devine, Robinson, Miller, Hamwi formulas · Reference ranges only, not a health target
      </p>
    </CalcCard>
  );
}

// ── Fitness Testing Scores ────────────────────────────────────────────
// Thresholds: [poor_max, fair_max, avg_max, good_max] → above good_max = Excellent
const PUSHUP_NORMS: Record<"male" | "female", { ageMin: number; ageMax: number; t: number[] }[]> = {
  male: [
    { ageMin: 15, ageMax: 19, t: [17, 22, 28, 38] },
    { ageMin: 20, ageMax: 29, t: [16, 21, 28, 35] },
    { ageMin: 30, ageMax: 39, t: [11, 16, 21, 29] },
    { ageMin: 40, ageMax: 49, t: [9, 12, 16, 21] },
    { ageMin: 50, ageMax: 59, t: [6, 9, 12, 20] },
    { ageMin: 60, ageMax: 99, t: [4, 7, 10, 17] },
  ],
  female: [
    { ageMin: 15, ageMax: 19, t: [11, 17, 24, 32] },
    { ageMin: 20, ageMax: 29, t: [9, 14, 20, 29] },
    { ageMin: 30, ageMax: 39, t: [7, 12, 19, 26] },
    { ageMin: 40, ageMax: 49, t: [4, 10, 14, 23] },
    { ageMin: 50, ageMax: 59, t: [1, 6, 10, 20] },
    { ageMin: 60, ageMax: 99, t: [1, 4, 11, 16] },
  ],
};

const SITUP_NORMS: Record<"male" | "female", { ageMin: number; ageMax: number; t: number[] }[]> = {
  male: [
    { ageMin: 15, ageMax: 19, t: [32, 37, 41, 47] },
    { ageMin: 20, ageMax: 29, t: [28, 32, 36, 42] },
    { ageMin: 30, ageMax: 39, t: [21, 26, 30, 35] },
    { ageMin: 40, ageMax: 49, t: [16, 21, 25, 30] },
    { ageMin: 50, ageMax: 59, t: [12, 17, 21, 25] },
    { ageMin: 60, ageMax: 99, t: [7, 11, 16, 22] },
  ],
  female: [
    { ageMin: 15, ageMax: 19, t: [26, 31, 35, 41] },
    { ageMin: 20, ageMax: 29, t: [20, 24, 30, 35] },
    { ageMin: 30, ageMax: 39, t: [14, 19, 23, 28] },
    { ageMin: 40, ageMax: 49, t: [6, 14, 19, 24] },
    { ageMin: 50, ageMax: 59, t: [4, 9, 13, 19] },
    { ageMin: 60, ageMax: 99, t: [1, 5, 10, 16] },
  ],
};

const FITNESS_CATS = ["Poor", "Fair", "Average", "Good", "Excellent"];
const FITNESS_COLORS_BG = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-400",
  "bg-primary-500",
];

function getFitnessCat(score: number, thresholds: number[]): number {
  if (score <= thresholds[0]) return 0;
  if (score <= thresholds[1]) return 1;
  if (score <= thresholds[2]) return 2;
  if (score <= thresholds[3]) return 3;
  return 4;
}

function FitnessTestingCalc() {
  const [test, setTest] = useState<"pushup" | "situp">("pushup");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [reps, setReps] = useState("");

  const result = useMemo(() => {
    const a = parseInt(age);
    const r = parseInt(reps);
    if (!a || !r || a < 15 || a > 99) return null;
    const norms = test === "pushup" ? PUSHUP_NORMS : SITUP_NORMS;
    const row = norms[sex].find((n) => a >= n.ageMin && a <= n.ageMax);
    if (!row) return null;
    return { catIdx: getFitnessCat(r, row.t), thresholds: row.t };
  }, [test, sex, age, reps]);

  return (
    <CalcCard
      title="Fitness Testing Scores"
      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    >
      <div className="flex gap-2 flex-wrap">
        {(["pushup", "situp"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTest(t)}
            className={`px-3 py-3 rounded-lg min-h-[44px] text-xs font-medium transition-colors ${test === t ? "bg-primary-500 text-white" : "bg-surface-100 dark:bg-surface-700 text-gray-600 dark:text-gray-300"}`}
          >
            {t === "pushup" ? "Push-up" : "Sit-up (1 min)"}
          </button>
        ))}
      </div>
      <Select
        value={sex}
        onChange={(v) => setSex(v as "male" | "female")}
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
      />
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your rating
            </span>
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full text-white ${FITNESS_COLORS_BG[result.catIdx]}`}
            >
              {FITNESS_CATS[result.catIdx]}
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${FITNESS_COLORS_BG[result.catIdx]}`}
              style={{ width: `${((result.catIdx + 1) / 5) * 100}%` }}
            />
          </div>
          <div className="rounded-xl border border-gray-200/60 dark:border-white/5 overflow-hidden">
            <div className="grid grid-cols-5 text-xs">
              {FITNESS_CATS.map((cat, i) => (
                <div
                  key={cat}
                  className={`px-1 py-2.5 text-center border-r border-gray-200/40 dark:border-white/5 last:border-0 ${i === result.catIdx ? "bg-primary-500/10 dark:bg-primary-400/10 font-bold text-primary-600 dark:text-primary-300" : "text-gray-500 dark:text-gray-400"}`}
                >
                  <div className="font-medium leading-tight">{cat}</div>
                  <div className="text-gray-400 mt-0.5 text-[10px]">
                    {i === 0
                      ? `≤${result.thresholds[0]}`
                      : i === 4
                        ? `${result.thresholds[3] + 1}+`
                        : `${result.thresholds[i - 1] + 1}–${result.thresholds[i]}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {test === "pushup"
          ? "ACSM norms · Males: full push-up · Females: modified (knee push-up)"
          : "ACSM norms · Timed 1-minute sit-up test"}
      </p>
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
