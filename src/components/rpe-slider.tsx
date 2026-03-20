"use client";

import { useState, useCallback } from "react";
import { NumberFlow } from "./ui/NumberFlow";

interface RPESliderProps {
  value: number | "";
  onChange: (value: number) => void;
  label?: string;
  showDescriptions?: boolean;
}

const RPE_DESCRIPTIONS: Record<number, string> = {
  1: "Very Light",
  2: "Light",
  3: "Moderate",
  4: "Somewhat Hard",
  5: "Hard",
  6: "Hard+",
  7: "Very Hard",
  8: "Very Hard+",
  9: "Near Max",
  10: "Max Effort",
};

function getRPEColor(value: number): string {
  if (value <= 3) return "bg-green-500";
  if (value <= 5) return "bg-yellow-500";
  if (value <= 7) return "bg-orange-500";
  if (value <= 8) return "bg-red-400";
  return "bg-red-600";
}

function getRPETextColor(value: number): string {
  if (value <= 3) return "text-green-600 dark:text-green-400";
  if (value <= 5) return "text-yellow-600 dark:text-yellow-400";
  if (value <= 7) return "text-orange-600 dark:text-orange-400";
  if (value <= 8) return "text-red-500 dark:text-red-400";
  return "text-red-700 dark:text-red-300";
}

function getRPETrackColor(value: number): string {
  if (value <= 3) return "from-green-400 to-green-500";
  if (value <= 5) return "from-green-400 via-yellow-400 to-yellow-500";
  if (value <= 7) return "from-green-400 via-yellow-400 to-orange-500";
  if (value <= 8) return "from-green-400 via-yellow-400 via-orange-400 to-red-400";
  return "from-green-400 via-yellow-400 via-orange-400 to-red-600";
}

export function RPESlider({ value, onChange, label = "RPE", showDescriptions = true }: RPESliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const currentValue = value || 5;
  const percentage = ((currentValue - 1) / 9) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="label mb-0">{label} (1-10)</label>
          <span
            className={`text-2xl font-bold transition-colors ${
              value ? getRPETextColor(currentValue) : "text-gray-300 dark:text-gray-600"
            }`}
          >
            {value ? <NumberFlow value={currentValue} decimals={1} /> : "–"}
          </span>
        </div>
      )}

      <div className="relative pt-1 pb-2">
        {/* Track background */}
        <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          {/* Filled track */}
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getRPETrackColor(currentValue)} transition-all duration-150`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Range input */}
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={currentValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="rpe-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`RPE rating: ${currentValue}`}
        />

        {/* Thumb indicator */}
        <div
          className={`absolute top-0 w-6 h-6 -mt-1.5 rounded-full border-2 border-white dark:border-gray-900 shadow-md pointer-events-none transition-transform ${
            getRPEColor(currentValue)
          } ${isDragging ? "scale-125" : "scale-100"}`}
          style={{ left: `calc(${percentage}% - 12px)` }}
        />
      </div>

      {/* Scale markers */}
      <div className="flex justify-between px-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-6 h-6 rounded-full text-xs font-medium transition-all ${
              currentValue === n
                ? `${getRPEColor(n)} text-white shadow-sm`
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Description */}
      {showDescriptions && value && (
        <p className={`text-sm font-medium text-center ${getRPETextColor(currentValue)}`}>
          {RPE_DESCRIPTIONS[Math.round(currentValue)] || ""}
        </p>
      )}
    </div>
  );
}

/* Compact version for wellness metrics */
interface WellnessSliderProps {
  value: number | "";
  onChange: (value: number) => void;
  label: string;
  lowLabel: string;
  highLabel: string;
  invert?: boolean; // true = high is bad (fatigue, soreness, stress)
}

export function WellnessSlider({
  value,
  onChange,
  label,
  lowLabel,
  highLabel,
  invert = false,
}: WellnessSliderProps) {
  const currentValue = value || 5;
  const percentage = ((currentValue - 1) / 9) * 100;

  function getColor(val: number): string {
    const effective = invert ? 11 - val : val;
    if (effective <= 3) return "bg-red-400";
    if (effective <= 5) return "bg-yellow-400";
    if (effective <= 7) return "bg-green-400";
    return "bg-green-500";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
        <span className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">
          {value || "–"}
        </span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${getColor(currentValue)} transition-all duration-150`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={currentValue}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`${label}: ${currentValue}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
