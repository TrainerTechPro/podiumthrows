"use client";

import { useState, useEffect } from "react";
import type { DurationBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function DurationInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<DurationBlock>) {
  const isHMS = block.format === "hh:mm:ss";

  // Parse initial value
  const parts = ((value as string) ?? "").split(":");
  const [hours, setHours] = useState(isHMS ? parts[0] ?? "" : "");
  const [minutes, setMinutes] = useState(
    isHMS ? parts[1] ?? "" : parts[0] ?? ""
  );
  const [seconds, setSeconds] = useState(
    isHMS ? parts[2] ?? "" : parts[1] ?? ""
  );

  useEffect(() => {
    if (isHMS) {
      if (hours || minutes || seconds) {
        const h = hours.padStart(2, "0");
        const m = minutes.padStart(2, "0");
        const s = seconds.padStart(2, "0");
        onChange(`${h}:${m}:${s}`);
      }
    } else {
      if (minutes || seconds) {
        const m = minutes.padStart(1, "0");
        const s = seconds.padStart(2, "0");
        onChange(`${m}:${s}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, minutes, seconds]);

  const inputClass =
    "w-14 px-2 py-2 rounded-lg text-center text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50 tabular-nums";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {isHMS && (
          <>
            <input
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="HH"
              disabled={disabled}
              className={inputClass}
            />
            <span className="text-muted font-bold">:</span>
          </>
        )}
        <input
          type="number"
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="MM"
          disabled={disabled}
          className={inputClass}
        />
        <span className="text-muted font-bold">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          placeholder="SS"
          disabled={disabled}
          className={inputClass}
        />
      </div>
      <p className="text-[10px] text-muted">{block.format}</p>
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
