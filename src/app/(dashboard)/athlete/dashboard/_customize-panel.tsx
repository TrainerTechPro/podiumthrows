"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Heart,
  Dumbbell,
  Calendar,
  Award,
  Hash,
  Target,
  TrendingUp,
  CalendarDays,
  Video,
  ClipboardList,
  Sparkles,
  Zap,
  BarChart3,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import {
  WIDGET_CATALOG,
  PRESETS,
  DEFAULT_PRESET,
  WIDGET_IDS,
  type WidgetId,
  type PresetId,
  type DashboardConfig,
} from "./_widget-registry";

/* ─── Icon map ──────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  Dumbbell,
  Calendar,
  Award,
  Hash,
  Target,
  TrendingUp,
  CalendarDays,
  Video,
  ClipboardList,
};

const PRESET_ICONS: Record<PresetId, LucideIcon> = {
  minimal: Sparkles,
  performance: Zap,
  detailed: BarChart3,
  recovery: Leaf,
};

const PRESET_DESCRIPTIONS: Record<PresetId, string> = {
  minimal: "Just the essentials",
  performance: "Track your progress",
  detailed: "Everything at a glance",
  recovery: "Focus on wellness",
};

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface CustomizePanelProps {
  currentConfig: DashboardConfig;
  onClose: () => void;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function CustomizePanel({ currentConfig, onClose }: CustomizePanelProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [config, setConfig] = useState<DashboardConfig>({ ...currentConfig });
  const [saving, setSaving] = useState(false);

  /* ── Save to API ────────────────────────────────────────────────────── */

  const saveConfig = useCallback(
    async (next: DashboardConfig) => {
      setSaving(true);
      try {
        // Determine if this matches a preset (send preset name only)
        const presetEntry = (Object.entries(PRESETS) as [PresetId, DashboardConfig][]).find(
          ([, p]) =>
            JSON.stringify(p.widgets) === JSON.stringify(next.widgets) &&
            JSON.stringify(p.order) === JSON.stringify(next.order),
        );

        const body = presetEntry
          ? { preset: presetEntry[0] }
          : { widgets: next.widgets, order: next.order };

        const res = await fetch("/api/athlete/dashboard-config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const saved = await res.json();
          setConfig(saved);
          router.refresh();
        }
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  /* ── Preset select ──────────────────────────────────────────────────── */

  const applyPreset = useCallback(
    (presetId: PresetId) => {
      const next = { ...PRESETS[presetId] };
      setConfig(next);
      saveConfig(next);
    },
    [saveConfig],
  );

  /* ── Widget toggle ──────────────────────────────────────────────────── */

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      if (id === "readiness") return; // Can't disable readiness

      const enabled = config.widgets.includes(id);
      let nextWidgets: WidgetId[];
      let nextOrder: WidgetId[];

      if (enabled) {
        nextWidgets = config.widgets.filter((w) => w !== id);
        nextOrder = config.order.filter((w) => w !== id);
      } else {
        nextWidgets = [...config.widgets, id];
        nextOrder = [...config.order, id];
      }

      const next: DashboardConfig = {
        preset: "custom",
        widgets: nextWidgets,
        order: nextOrder,
      };
      setConfig(next);
      saveConfig(next);
    },
    [config, saveConfig],
  );

  /* ── Reorder ────────────────────────────────────────────────────────── */

  const moveWidget = useCallback(
    (id: WidgetId, direction: "up" | "down") => {
      if (id === "readiness") return; // readiness stays at top
      const order = [...config.order];
      const idx = order.indexOf(id);
      if (idx < 0) return;

      // Can't move above readiness (index 0)
      if (direction === "up" && idx <= 1) return;
      if (direction === "down" && idx >= order.length - 1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      // Don't swap with readiness
      if (order[swapIdx] === "readiness") return;

      [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];

      const next: DashboardConfig = {
        preset: "custom",
        widgets: config.widgets,
        order,
      };
      setConfig(next);
      saveConfig(next);
    },
    [config, saveConfig],
  );

  /* ── Reset ──────────────────────────────────────────────────────────── */

  const resetToDefault = useCallback(() => {
    applyPreset(DEFAULT_PRESET);
  }, [applyPreset]);

  /* ── Active preset detection ────────────────────────────────────────── */

  const activePreset: PresetId | "custom" = (() => {
    for (const [name, p] of Object.entries(PRESETS) as [PresetId, DashboardConfig][]) {
      if (
        JSON.stringify(p.widgets) === JSON.stringify(config.widgets) &&
        JSON.stringify(p.order) === JSON.stringify(config.order)
      ) {
        return name;
      }
    }
    return "custom";
  })();

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", damping: 30, stiffness: 300 }
          }
          className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto custom-scrollbar rounded-t-2xl"
          style={{
            backgroundColor: "var(--card-bg)",
            borderTop: "1px solid var(--card-border)",
          }}
        >
          {/* Drag handle */}
          <div className="sticky top-0 z-10 flex items-center justify-center pt-3 pb-1" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="h-1 w-10 rounded-full bg-surface-300 dark:bg-surface-600" />
          </div>

          <div className="px-5 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-bold text-[var(--foreground)]">
                Customize Dashboard
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                aria-label="Close customize panel"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>

            {/* Saving indicator */}
            {saving && (
              <div className="text-xs text-muted mb-3 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
                Saving...
              </div>
            )}

            {/* Preset selector */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Presets
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(PRESETS) as PresetId[]).map((presetId) => {
                  const isActive = activePreset === presetId;
                  const Icon = PRESET_ICONS[presetId];
                  return (
                    <button
                      key={presetId}
                      onClick={() => applyPreset(presetId)}
                      className={`card p-3 text-left transition-all duration-150 ${
                        isActive
                          ? "ring-2 ring-primary-500 bg-primary-500/5"
                          : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={
                            isActive ? "text-primary-500" : "text-muted"
                          }
                        />
                        <span
                          className={`text-sm font-semibold capitalize ${
                            isActive
                              ? "text-primary-500"
                              : "text-[var(--foreground)]"
                          }`}
                        >
                          {presetId}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        {PRESET_DESCRIPTIONS[presetId]}
                      </p>
                      <p className="text-[10px] text-muted mt-1">
                        {PRESETS[presetId].widgets.length} widgets
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Widget toggles */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Widgets
              </h3>
              <div className="space-y-1">
                {config.order
                  .concat(
                    WIDGET_IDS.filter((w) => !config.order.includes(w)),
                  )
                  .map((widgetId) => {
                    const meta = WIDGET_CATALOG.find((w) => w.id === widgetId);
                    if (!meta) return null;

                    const enabled = config.widgets.includes(widgetId);
                    const isPinned = widgetId === "readiness";
                    const IconComp = ICON_MAP[meta.icon];
                    const orderIdx = config.order.indexOf(widgetId);
                    const canMoveUp = enabled && !isPinned && orderIdx > 1;
                    const canMoveDown =
                      enabled &&
                      !isPinned &&
                      orderIdx >= 0 &&
                      orderIdx < config.order.length - 1;

                    return (
                      <div
                        key={widgetId}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          enabled
                            ? "bg-surface-50 dark:bg-surface-800/30"
                            : "opacity-50"
                        }`}
                      >
                        {/* Icon */}
                        {IconComp && (
                          <IconComp
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden="true"
                            className={
                              enabled ? "text-primary-500" : "text-muted"
                            }
                          />
                        )}

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-[var(--foreground)] truncate block">
                            {meta.name}
                          </span>
                        </div>

                        {/* Reorder arrows */}
                        {enabled && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => moveWidget(widgetId, "up")}
                              disabled={!canMoveUp}
                              className={`p-1 rounded transition-colors ${
                                canMoveUp
                                  ? "hover:bg-surface-200 dark:hover:bg-surface-700 text-muted"
                                  : "text-surface-300 dark:text-surface-700 cursor-not-allowed"
                              }`}
                              aria-label={`Move ${meta.name} up`}
                            >
                              <ChevronUp
                                size={14}
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              onClick={() => moveWidget(widgetId, "down")}
                              disabled={!canMoveDown}
                              className={`p-1 rounded transition-colors ${
                                canMoveDown
                                  ? "hover:bg-surface-200 dark:hover:bg-surface-700 text-muted"
                                  : "text-surface-300 dark:text-surface-700 cursor-not-allowed"
                              }`}
                              aria-label={`Move ${meta.name} down`}
                            >
                              <ChevronDown
                                size={14}
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        )}

                        {/* Toggle */}
                        <button
                          onClick={() => toggleWidget(widgetId)}
                          disabled={isPinned}
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${meta.name}`}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                            isPinned
                              ? "bg-primary-500/60 cursor-not-allowed"
                              : enabled
                                ? "bg-primary-500 cursor-pointer"
                                : "bg-surface-300 dark:bg-surface-600 cursor-pointer"
                          }`}
                        >
                          <span
                            className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              enabled ? "translate-x-[22px]" : "translate-x-[3px]"
                            }`}
                            style={{ width: 18, height: 18 }}
                          />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Reset button */}
            <button
              onClick={resetToDefault}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              Reset to Default
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
