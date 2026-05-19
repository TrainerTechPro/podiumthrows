"use client";

import { useState, useEffect } from "react";

import { logger } from "@/lib/logger";
/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ThrowsSessionTemplate {
  id: string;
  name: string;
  event: string;
  sessionType: string;
  blocks: { id: string }[];
}

interface TemplatePickerProps {
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

function formatEventName(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function TemplatePicker({ value, onChange, className }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<ThrowsSessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/throws/sessions");
        if (!res.ok) throw new Error("Couldn’t load templates");
        const json = await res.json();
        if (!cancelled) {
          setTemplates(json.data ?? []);
        }
      } catch (err) {
        logger.error("[TemplatePicker] fetch error:", {
          context: "coach/schedule/template-picker",
          error: err,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full space-y-1.5">
      <label htmlFor="template-picker" className="label">
        Template
      </label>
      <select
        id="template-picker"
        className={`input ${className ?? ""}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? "Loading templates…" : "Select a template…"}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} — {formatEventName(t.event)} ({t.blocks.length} block
            {t.blocks.length !== 1 ? "s" : ""})
          </option>
        ))}
      </select>
    </div>
  );
}
