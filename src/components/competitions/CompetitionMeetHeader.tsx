"use client";
import { useState } from "react";

export type MeetHeaderValue = {
  id: string;
  name: string;
  date: string;
  event: string;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
  venueType: "INDOOR" | "OUTDOOR" | null;
  weather: string | null;
  windMps: number | null;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
};

type Props = {
  value: MeetHeaderValue;
  onChange: (patch: Partial<MeetHeaderValue>) => Promise<void>;
  canMakeFinals: boolean;
};

export function CompetitionMeetHeader({ value, onChange, canMakeFinals }: Props) {
  const [dirty, setDirty] = useState<Partial<MeetHeaderValue>>({});

  const merged = { ...value, ...dirty };

  const handleField = <K extends keyof MeetHeaderValue>(key: K, v: MeetHeaderValue[K]) => {
    setDirty((d) => ({ ...d, [key]: v }));
  };

  const handleBlur = async () => {
    if (Object.keys(dirty).length === 0) return;
    await onChange(dirty);
    setDirty({});
  };

  return (
    <div className="card space-y-3 p-4" onBlur={handleBlur}>
      <div className="flex items-center gap-3">
        <input
          value={merged.name}
          onChange={(e) => handleField("name", e.target.value)}
          className="flex-1 bg-transparent font-heading text-xl"
          aria-label="Meet name"
        />
        <input
          type="date"
          value={merged.date}
          onChange={(e) => handleField("date", e.target.value)}
          className="rounded bg-surface-800 px-2 py-1 text-sm"
          aria-label="Meet date"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">Place</span>
          <input
            type="number"
            min={1}
            value={merged.placeFinish ?? ""}
            onChange={(e) =>
              handleField("placeFinish", e.target.value ? Number(e.target.value) : null)
            }
            className="w-16 rounded bg-surface-800 px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Status</span>
          <select
            value={merged.meetStatus}
            onChange={(e) =>
              handleField("meetStatus", e.target.value as MeetHeaderValue["meetStatus"])
            }
            className="rounded bg-surface-800 px-2 py-1"
          >
            {(["COMPLETED", "DNS", "DNF", "DQ"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Venue</span>
          <select
            value={merged.venueType ?? ""}
            onChange={(e) =>
              handleField(
                "venueType",
                (e.target.value || null) as MeetHeaderValue["venueType"],
              )
            }
            className="rounded bg-surface-800 px-2 py-1"
          >
            <option value="">—</option>
            <option value="INDOOR">Indoor</option>
            <option value="OUTDOOR">Outdoor</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Wind (m/s)</span>
          <input
            type="number"
            step="0.1"
            value={merged.windMps ?? ""}
            onChange={(e) =>
              handleField("windMps", e.target.value ? Number(e.target.value) : null)
            }
            className="w-20 rounded bg-surface-800 px-2 py-1 font-mono tabular-nums"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 items-center gap-2">
          <span className="text-muted">Weather</span>
          <input
            value={merged.weather ?? ""}
            onChange={(e) => handleField("weather", e.target.value || null)}
            placeholder="e.g. 70°F sunny"
            className="flex-1 rounded bg-surface-800 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Format</span>
          <select
            value={merged.format}
            onChange={(e) =>
              handleField("format", e.target.value as MeetHeaderValue["format"])
            }
            className="rounded bg-surface-800 px-2 py-1"
          >
            <option value="THREE_PLUS_THREE">3 + 3</option>
            <option value="FOUR_STRAIGHT">4 straight</option>
          </select>
        </label>
        {merged.format === "THREE_PLUS_THREE" && canMakeFinals && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={merged.madeFinals ?? false}
              onChange={(e) => handleField("madeFinals", e.target.checked)}
            />
            <span>Made finals</span>
          </label>
        )}
      </div>
    </div>
  );
}
