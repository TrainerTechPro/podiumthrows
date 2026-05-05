"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export type BasicsData = {
  name: string;
  description: string;
  event: string;
};

const EVENT_OPTIONS = [
  { value: "", label: "General (All Events)" },
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

export function StepBasics({
  data,
  onChange,
}: {
  data: BasicsData;
  onChange: (data: BasicsData) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Session Basics</h2>
        <p className="text-sm text-muted mt-1">
          Name your session and optionally scope it to a specific event.
        </p>
      </div>

      <Input
        label="Session Name"
        placeholder="e.g. Heavy Shot Put Day, Competition Prep Week 4"
        value={data.name}
        onChange={(e) => onChange({ ...data, name: e.target.value })}
        required
      />

      <Select
        label="Event"
        options={EVENT_OPTIONS}
        value={data.event}
        onChange={(v) => onChange({ ...data, event: v })}
        helper="Filters the exercise list to event-specific exercises."
      />

      <Textarea
        label="Description (optional)"
        placeholder="Session goals, focus areas, or notes for yourself..."
        value={data.description}
        onChange={(next) => onChange({ ...data, description: next })}
        rows={3}
      />
    </div>
  );
}
