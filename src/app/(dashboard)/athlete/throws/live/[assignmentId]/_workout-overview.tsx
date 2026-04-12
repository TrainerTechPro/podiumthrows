"use client";

import type { WorkoutData, BlockState } from "./_types";
import {
  parseConfig,
  getThrowCount,
  getImplement,
  getImplementKg,
  getRestSeconds,
  getBlockAccent,
  getExerciseName,
  CHAMFER_LG,
} from "./_utils";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  WORKOUT OVERVIEW (all blocks at a glance)                              */
/* ═══════════════════════════════════════════════════════════════════════ */

export function WorkoutOverview({ data, blockStates }: { data: WorkoutData; blockStates: Map<string, BlockState> }) {
  return (
    <div className="space-y-6 pb-8">
      {/* Session title */}
      <div className="text-center pt-2">
        <h2
          className="text-lg font-heading font-bold tracking-wider"
          style={{ color: "#FFC800" }}
        >
          {data.sessionName}
        </h2>
        <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "#ffffff33" }}>
          {data.sessionType.replace(/_/g, " ")} · {data.event.replace(/_/g, " ")}
        </p>
      </div>

      {/* Quick stats */}
      <div className="flex justify-center gap-4">
        <div className="text-center">
          <span className="text-xl font-bold tabular-nums" style={{ color: "#FFC800" }}>
            {data.blocks.length}
          </span>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Blocks
          </p>
        </div>
        <div className="text-center">
          {(() => {
            const loggedThrows = Array.from(blockStates.values())
              .reduce((sum, s) => sum + s.throws.filter((t) => t.distance !== null && t.distance > 0).length, 0);
            const totalThrows = data.blocks
              .filter((b) => b.blockType === "THROWING")
              .reduce((sum, b) => sum + getThrowCount(parseConfig(b.config)), 0);
            return (
              <>
                <span className="text-xl font-bold tabular-nums" style={{ color: loggedThrows > 0 ? "#00FF88" : "#FFC800" }}>
                  {loggedThrows}
                </span>
                <span className="text-sm font-medium tabular-nums" style={{ color: "#ffffff33" }}>
                  /{totalThrows}
                </span>
              </>
            );
          })()}
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Throws Logged
          </p>
        </div>
        <div className="text-center">
          <span className="text-xl font-bold tabular-nums" style={{ color: "#FFC800" }}>
            {Array.from(blockStates.values()).reduce((sum, s) => sum + s.sets.length, 0)}
          </span>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Sets
          </p>
        </div>
      </div>

      {/* All blocks */}
      {data.blocks.map((block, i) => {
        const cfg = parseConfig(block.config);
        const accent = getBlockAccent(block);
        const bt = block.blockType.toUpperCase();
        const state = blockStates.get(block.id);
        const loggedCount = state ? state.throws.length + state.sets.length + state.warmupChecked.size : 0;
        const hasProgress = loggedCount > 0;

        return (
          <div key={block.id} className="space-y-2">
            {/* Block header */}
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-sm" style={{ background: accent }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {bt === "THROWING"
                  ? getExerciseName(block)
                  : bt}
              </span>
              <span className="text-[9px] text-white/30 ml-auto flex items-center gap-1.5">
                {hasProgress && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                )}
                Block {i + 1}
              </span>
            </div>

            {/* Block content */}
            <div
              className="px-4 py-3 space-y-2"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}22`,
                clipPath: CHAMFER_LG,
              }}
            >
              {bt === "WARMUP" || bt === "COOLDOWN" ? (
                <>
                  {((cfg.drills as Array<string | { name: string; duration?: number }>) ?? []).map(
                    (d, j) => {
                      const name = typeof d === "string" ? d : d.name;
                      const dur = typeof d === "object" ? d.duration : undefined;
                      return (
                        <div key={j} className="flex items-center justify-between">
                          <span className="text-sm" style={{ color: "#E8E8E8" }}>
                            {name}
                          </span>
                          {dur && (
                            <span className="text-[10px] tabular-nums" style={{ color: `${accent}44` }}>
                              {dur}min
                            </span>
                          )}
                        </div>
                      );
                    },
                  )}
                  {(cfg.totalDuration ?? cfg.duration) && (
                    <div className="flex justify-end pt-1">
                      <span className="text-xs font-semibold tabular-nums" style={{ color: `${accent}88` }}>
                        {String(cfg.totalDuration ?? cfg.duration)} min total
                      </span>
                    </div>
                  )}
                </>
              ) : bt === "THROWING" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                      {getImplement(cfg) || `${getImplementKg(cfg)}kg`}
                    </span>
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      {(cfg.classification as string) ?? ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums" style={{ color: accent }}>
                      {getThrowCount(cfg)}
                    </span>
                    <span className="text-xs ml-1" style={{ color: `${accent}66` }}>
                      throws
                    </span>
                    {getRestSeconds(cfg) > 0 && (
                      <p className="text-[10px] tabular-nums" style={{ color: "#ffffff33" }}>
                        {getRestSeconds(cfg)}s rest
                      </p>
                    )}
                  </div>
                </div>
              ) : bt === "STRENGTH" ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                    {(cfg.exerciseName as string) ?? "Strength"}
                  </span>
                  <div className="text-right text-xs tabular-nums" style={{ color: `${accent}88` }}>
                    {(cfg.sets as number) ?? 0} × {(cfg.reps as number) ?? 0}
                    {(cfg.loadKg as number) ? ` @ ${cfg.loadKg}kg` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
