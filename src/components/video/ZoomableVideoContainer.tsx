"use client";

import type { ReactNode } from "react";
import type { UseZoomPanReturn } from "./useZoomPan";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  zoomPan: UseZoomPanReturn;
  children: ReactNode;
  showIndicator?: boolean;
  className?: string;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function ZoomableVideoContainer({
  zoomPan,
  children,
  showIndicator = true,
  className,
}: Props) {
  const { state, containerRef, isZoomed, isTransitioning, resetZoom } = zoomPan;

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{
        touchAction: "none",
        cursor: isZoomed ? "grab" : "default",
      }}
    >
      {/* Transform container — holds video + canvas, scales together */}
      <div
        className={
          isTransitioning
            ? "transition-transform duration-300 ease-out"
            : undefined
        }
        style={{
          transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
          willChange: isZoomed ? "transform" : "auto",
        }}
      >
        {children}
      </div>

      {/* ── Zoom indicator (top-left, shown when zoomed) ── */}
      {showIndicator && isZoomed && (
        <div className="absolute top-3 left-3 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-auto">
          {/* Zoom level */}
          <span className="text-[11px] font-mono text-white/90 tabular-nums">
            {state.scale.toFixed(1)}×
          </span>

          {/* Zoom slider (compact) */}
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={state.scale}
            onChange={(e) => {
              const newScale = parseFloat(e.target.value);
              zoomPan.zoomTo(newScale);
            }}
            className="w-14 h-1 accent-primary-500 cursor-pointer"
            aria-label="Zoom level"
          />

          {/* Reset button */}
          <button
            onClick={resetZoom}
            className="text-[10px] text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            title="Reset zoom (0)"
          >
            Reset
          </button>
        </div>
      )}

      {/* Zoom hint on first hover (subtle) */}
      {!isZoomed && (
        <div className="absolute bottom-2 right-2 z-40 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[9px] text-white/40 bg-black/30 rounded px-1.5 py-0.5">
            Scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}
