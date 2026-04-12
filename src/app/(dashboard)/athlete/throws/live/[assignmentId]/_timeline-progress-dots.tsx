"use client";

/**
 * TimelineProgressDots — 8px dot grid showing throw progress per exercise.
 * Filled dots = logged throws, current dot = pulsing amber, unfilled = pending.
 */

interface TimelineProgressDotsProps {
  total: number;
  completed: number;
  accentColor?: string;
}

export function TimelineProgressDots({
  total,
  completed,
  accentColor = "#FFC800",
}: TimelineProgressDotsProps) {
  // Clamp to reasonable max for display
  const displayTotal = Math.min(total, 30);

  return (
    <div className="flex flex-wrap gap-1.5 py-1" role="progressbar" aria-valuenow={completed} aria-valuemax={total}>
      {Array.from({ length: displayTotal }, (_, i) => {
        const isFilled = i < completed;
        const isCurrent = i === completed && completed < total;

        return (
          <div
            key={i}
            className={isCurrent ? "timeline-dot-pulse" : ""}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: isFilled
                ? accentColor
                : isCurrent
                  ? accentColor
                  : "rgba(255,255,255,0.08)",
              boxShadow: isFilled
                ? `0 0 6px ${accentColor}44`
                : isCurrent
                  ? `0 0 8px ${accentColor}66`
                  : "none",
              transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
