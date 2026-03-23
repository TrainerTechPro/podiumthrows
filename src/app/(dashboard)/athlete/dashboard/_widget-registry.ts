// src/app/(dashboard)/athlete/dashboard/_widget-registry.ts

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type WidgetId =
  | "readiness"
  | "today-workout"
  | "calendar"
  | "prs"
  | "quick-stats"
  | "goals"
  | "volume"
  | "upcoming-sessions"
  | "videos"
  | "questionnaires";

export const WIDGET_IDS: WidgetId[] = [
  "readiness",
  "today-workout",
  "calendar",
  "prs",
  "quick-stats",
  "goals",
  "volume",
  "upcoming-sessions",
  "videos",
  "questionnaires",
];

export type WidgetMeta = {
  id: WidgetId;
  name: string;
  description: string;
  icon: string;
  pinned?: boolean;
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: "readiness", name: "Readiness Score", description: "Today's readiness check-in and score", icon: "Heart", pinned: true },
  { id: "today-workout", name: "Today's Workout", description: "Preview timeline of today's sessions", icon: "Dumbbell" },
  { id: "calendar", name: "Workout Calendar", description: "Month view with session indicators", icon: "Calendar" },
  { id: "prs", name: "Personal Bests", description: "Latest PRs across events", icon: "Award" },
  { id: "quick-stats", name: "Quick Stats", description: "Sessions this week, streak, total", icon: "Hash" },
  { id: "goals", name: "Goals Progress", description: "Active goals with progress bars", icon: "Target" },
  { id: "volume", name: "Training Volume", description: "Weekly throws/lifts volume chart", icon: "TrendingUp" },
  { id: "upcoming-sessions", name: "Upcoming Sessions", description: "Next 5 scheduled sessions", icon: "CalendarDays" },
  { id: "videos", name: "Recent Videos", description: "Latest coaching videos", icon: "Video" },
  { id: "questionnaires", name: "Pending Questionnaires", description: "Unanswered coach questionnaires", icon: "ClipboardList" },
];

/* ─── Dashboard Config ───────────────────────────────────────────────────── */

export type PresetId = "minimal" | "performance" | "detailed" | "recovery";

export type DashboardConfig = {
  preset: PresetId | "custom";
  widgets: WidgetId[];
  order: WidgetId[];
};

export const PRESETS: Record<PresetId, DashboardConfig> = {
  minimal: {
    preset: "minimal",
    widgets: ["readiness", "today-workout", "quick-stats"],
    order: ["readiness", "today-workout", "quick-stats"],
  },
  performance: {
    preset: "performance",
    widgets: ["readiness", "today-workout", "calendar", "prs", "quick-stats"],
    order: ["readiness", "today-workout", "calendar", "prs", "quick-stats"],
  },
  detailed: {
    preset: "detailed",
    widgets: ["readiness", "today-workout", "calendar", "prs", "quick-stats", "goals", "volume", "upcoming-sessions"],
    order: ["readiness", "today-workout", "calendar", "prs", "quick-stats", "goals", "volume", "upcoming-sessions"],
  },
  recovery: {
    preset: "recovery",
    widgets: ["readiness", "today-workout", "calendar", "goals"],
    order: ["readiness", "today-workout", "calendar", "goals"],
  },
};

export const DEFAULT_PRESET: PresetId = "performance";

/* ─── Config Helpers ─────────────────────────────────────────────────────── */

export function resolveConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== "object") return PRESETS[DEFAULT_PRESET];
  const cfg = raw as Record<string, unknown>;
  const preset = cfg.preset as string;
  const widgets = cfg.widgets as string[];
  const order = cfg.order as string[];

  if (!Array.isArray(widgets) || !Array.isArray(order)) return PRESETS[DEFAULT_PRESET];

  const validWidgets = widgets.filter((w): w is WidgetId => WIDGET_IDS.includes(w as WidgetId));
  const validOrder = order.filter((w): w is WidgetId => validWidgets.includes(w as WidgetId));

  if (!validWidgets.includes("readiness")) validWidgets.unshift("readiness");
  if (!validOrder.includes("readiness")) validOrder.unshift("readiness");
  else if (validOrder[0] !== "readiness") {
    const idx = validOrder.indexOf("readiness");
    validOrder.splice(idx, 1);
    validOrder.unshift("readiness");
  }

  return {
    preset: (preset as PresetId | "custom") ?? "custom",
    widgets: validWidgets,
    order: validOrder,
  };
}

export function isWidgetEnabled(config: DashboardConfig, id: WidgetId): boolean {
  return config.widgets.includes(id);
}
