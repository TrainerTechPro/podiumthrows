"use client";

import { useState, useCallback } from "react";
import {
  CalcCard,
  Row,
  NumInput,
  Select,
  ResultBox,
  CalcButton,
  fmt,
} from "./ToolCard";

function WeightConverter() {
  const [value, setValue] = useState("");
  const [from, setFrom] = useState("lb");
  const [result, setResult] = useState<{
    lb: number;
    kg: number;
    oz: number;
    g: number;
    st: number;
  } | null>(null);

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (!v) return;
    const toKg: Record<string, number> = {
      lb: 0.453592,
      kg: 1,
      oz: 0.0283495,
      g: 0.001,
      st: 6.35029,
    };
    const kg = v * toKg[from];
    setResult({ lb: kg / 0.453592, kg, oz: kg / 0.0283495, g: kg * 1000, st: kg / 6.35029 });
  }, [value, from]);

  return (
    <CalcCard
      title="Weight Converter"
      icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
    >
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="100" min="0" step="any" />
        </Row>
        <Row label="From">
          <Select
            value={from}
            onChange={setFrom}
            options={[
              { value: "lb", label: "Pounds (lb)" },
              { value: "kg", label: "Kilograms (kg)" },
              { value: "oz", label: "Ounces (oz)" },
              { value: "g", label: "Grams (g)" },
              { value: "st", label: "Stone (st)" },
            ]}
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Pounds" value={fmt(result.lb, 4)} />
          <ResultBox label="Kilograms" value={fmt(result.kg, 4)} />
          <ResultBox label="Ounces" value={fmt(result.oz, 3)} />
          <ResultBox label="Grams" value={fmt(result.g, 2)} />
          <ResultBox label="Stone" value={fmt(result.st, 4)} />
        </div>
      )}
    </CalcCard>
  );
}

const LENGTH_TO_METERS: Record<string, number> = {
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
};

function LengthConverter() {
  const [value, setValue] = useState("");
  const [from, setFrom] = useState("in");
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (!v) return;
    const meters = v * LENGTH_TO_METERS[from];
    const res: Record<string, number> = {};
    Object.keys(LENGTH_TO_METERS).forEach((u) => {
      res[u] = meters / LENGTH_TO_METERS[u];
    });
    setResult(res);
  }, [value, from]);

  const labels: Record<string, string> = {
    in: "in",
    ft: "ft",
    yd: "yd",
    mi: "miles",
    mm: "mm",
    cm: "cm",
    m: "m",
    km: "km",
  };

  return (
    <CalcCard
      title="Length / Distance Converter"
      icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
    >
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="100" min="0" step="any" />
        </Row>
        <Row label="From">
          <Select
            value={from}
            onChange={setFrom}
            options={Object.keys(LENGTH_TO_METERS).map((u) => ({ value: u, label: labels[u] }))}
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(LENGTH_TO_METERS).map((u) => (
            <ResultBox
              key={u}
              label={labels[u]}
              value={fmt(result[u], result[u] < 0.001 ? 8 : result[u] < 1 ? 5 : 3)}
            />
          ))}
        </div>
      )}
    </CalcCard>
  );
}

function TempConverter() {
  const [value, setValue] = useState("");
  const [from, setFrom] = useState("F");
  const [result, setResult] = useState<{ F: number; C: number; K: number } | null>(null);

  const calc = useCallback(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return;
    let C: number;
    if (from === "F") C = ((v - 32) * 5) / 9;
    else if (from === "K") C = v - 273.15;
    else C = v;
    setResult({ C, F: (C * 9) / 5 + 32, K: C + 273.15 });
  }, [value, from]);

  return (
    <CalcCard
      title="Temperature Converter"
      icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    >
      <div className="grid grid-cols-2 gap-3 items-end">
        <Row label="Value">
          <NumInput value={value} onChange={setValue} placeholder="98.6" step="any" />
        </Row>
        <Row label="From">
          <Select
            value={from}
            onChange={setFrom}
            options={[
              { value: "F", label: "Fahrenheit (°F)" },
              { value: "C", label: "Celsius (°C)" },
              { value: "K", label: "Kelvin (K)" },
            ]}
          />
        </Row>
      </div>
      <CalcButton onClick={calc} />
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <ResultBox label="Fahrenheit (°F)" value={fmt(result.F, 2)} />
          <ResultBox label="Celsius (°C)" value={fmt(result.C, 2)} />
          <ResultBox label="Kelvin (K)" value={fmt(result.K, 2)} />
        </div>
      )}
    </CalcCard>
  );
}

export function ConvertersTab() {
  return (
    <div className="space-y-4">
      <WeightConverter />
      <LengthConverter />
      <TempConverter />
    </div>
  );
}
