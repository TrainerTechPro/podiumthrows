"use client";

import { Check } from "lucide-react";
import type { BlockData, BlockState } from "./_types";
import { parseConfig, getBlockAccent, CHAMFER, CHAMFER_LG } from "./_utils";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  WARMUP/COOLDOWN BLOCK VIEW                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

export function WarmupCooldownView({
  block,
  state,
  onToggleDrill,
  onAdvance,
  isLastBlock,
}: {
  block: BlockData;
  state: BlockState;
  onToggleDrill: (idx: number) => void;
  onAdvance?: () => void;
  isLastBlock?: boolean;
}) {
  const accent = getBlockAccent(block);
  const cfg = parseConfig(block.config);
  // Drills can be strings (legacy) or objects { name, duration, notes } (from start-live)
  const rawDrills =
    (cfg.drills as Array<string | { name: string; duration?: number; notes?: string }>) ?? [];
  const drills = rawDrills.map((d) =>
    typeof d === "string" ? { name: d, duration: undefined as number | undefined } : d
  );
  const duration = (cfg.duration ?? cfg.totalDuration) as number | undefined;

  return (
    <div className="space-y-4">
      {/* ── Duration Badge ── */}
      {duration && (
        <div className="text-center">
          <p
            className="text-nano uppercase font-semibold mb-0.5"
            style={{ letterSpacing: "4px", color: `${accent}44` }}
          >
            Duration
          </p>
          <span
            className="font-heading font-extrabold tabular-nums"
            style={{ fontSize: "32px", lineHeight: 1, color: accent }}
          >
            {duration}
          </span>
          <span className="ml-1 text-sm font-semibold" style={{ color: `${accent}66` }}>
            min
          </span>
        </div>
      )}

      {/* ── Drill Checklist ── */}
      {drills.length > 0 ? (
        <div className="space-y-2">
          <p
            className="text-nano uppercase font-semibold"
            style={{ letterSpacing: "3px", color: `${accent}55` }}
          >
            {block.blockType === "WARMUP" ? "Warm-Up Drills" : "Cool-Down Drills"}
          </p>
          {drills.map((drill, i) => {
            const checked = state.warmupChecked.has(i);
            return (
              <button
                key={i}
                onClick={() => onToggleDrill(i)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-all min-h-[52px]"
                style={{
                  backgroundColor: checked ? `${accent}11` : "#08080a",
                  border: `1px solid ${checked ? `${accent}33` : "#ffffff08"}`,
                  clipPath: CHAMFER,
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-5 h-5 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: checked ? accent : "transparent",
                    border: `2px solid ${checked ? accent : `${accent}33`}`,
                    clipPath: CHAMFER,
                  }}
                >
                  {checked && (
                    <Check
                      size={11}
                      strokeWidth={2.5}
                      style={{ color: "#000" }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {/* Drill text */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm font-medium transition-all block"
                    style={{
                      color: checked ? `${accent}55` : "#E8E8E8",
                      textDecoration: checked ? "line-through" : "none",
                    }}
                  >
                    {drill.name}
                  </span>
                  {drill.duration && (
                    <span className="text-nano tabular-nums" style={{ color: `${accent}44` }}>
                      {drill.duration}min
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Progress indicator */}
          {drills.length > 0 && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1"
                style={{
                  backgroundColor: `${accent}11`,
                  border: `1px solid ${accent}22`,
                  clipPath: CHAMFER_LG,
                }}
              >
                <span
                  className="text-nano uppercase font-bold"
                  style={{ letterSpacing: "2px", color: `${accent}77` }}
                >
                  {state.warmupChecked.size} / {drills.length}
                </span>
              </div>
            </div>
          )}

          {/* CONTINUE button — shown when all drills checked */}
          {state.warmupChecked.size >= drills.length && drills.length > 0 && onAdvance && (
            <button
              onClick={onAdvance}
              className="w-full mt-4 py-4 text-sm font-bold tracking-widest animate-fade-slide-in"
              style={{
                background: isLastBlock ? "#00FF88" : accent,
                color: "#000",
                clipPath: CHAMFER_LG,
              }}
            >
              {isLastBlock ? "FINISH SESSION" : "CONTINUE →"}
            </button>
          )}
        </div>
      ) : (
        <div
          className="text-center py-6"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #ffffff08",
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-xs font-medium uppercase"
            style={{ letterSpacing: "2px", color: `${accent}66` }}
          >
            Complete your {block.blockType.toLowerCase()} routine
          </p>
        </div>
      )}
    </div>
  );
}
