"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   VideoMockup
   ─────────────
   Static visual mockup of the video analysis feature. Displays a video
   player area with SVG annotation overlay (angle measurement) and a
   timeline scrubber bar. Used inside the StickyFeatures section when
   the "Video Analysis" feature is active.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VideoMockup() {
  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: 14,
        border: "1px solid var(--landing-border)",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02)",
        overflow: "hidden",
        background: "var(--landing-surface)",
      }}
      aria-hidden="true"
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "10px 14px" }}
      >
        <span
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--landing-text)",
          }}
        >
          Video Analysis — Shot Put
        </span>

        <span
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 500,
            color: "var(--landing-text-muted)",
            background: "var(--landing-surface-3)",
            border: "1px solid var(--landing-border-light)",
            borderRadius: 6,
            padding: "3px 8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Frame 42 / 118
        </span>
      </div>

      {/* ── Video player area ────────────────────────────────────────── */}
      <div style={{ padding: "0 14px" }}>
        <div
          className="relative w-full"
          style={{
            background: "var(--landing-bg)",
            borderRadius: 10,
            height: 200,
            overflow: "hidden",
          }}
        >
          {/* Play button */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 2 }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "2px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(245,158,11,0.06)",
              }}
            >
              {/* Play triangle via CSS border trick */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "10px solid transparent",
                  borderBottom: "10px solid transparent",
                  borderLeft: "17px solid rgba(245,158,11,0.7)",
                  marginLeft: 4,
                }}
              />
            </div>
          </div>

          {/* SVG annotation overlay */}
          <svg
            viewBox="0 0 400 200"
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 3 }}
            preserveAspectRatio="none"
          >
            {/* Point A — ~30% from left, 25% from top → (120, 50) */}
            <circle
              cx="120"
              cy="50"
              r="7"
              fill="none"
              stroke="rgba(245,158,11,0.75)"
              strokeWidth="1.5"
            />
            <circle
              cx="120"
              cy="50"
              r="2"
              fill="rgba(245,158,11,0.85)"
            />

            {/* Point B — ~70% from left, 75% from top → (280, 150) */}
            <circle
              cx="280"
              cy="150"
              r="7"
              fill="none"
              stroke="rgba(245,158,11,0.75)"
              strokeWidth="1.5"
            />
            <circle
              cx="280"
              cy="150"
              r="2"
              fill="rgba(245,158,11,0.85)"
            />

            {/* Dashed line connecting A to B */}
            <line
              x1="120"
              y1="50"
              x2="280"
              y2="150"
              stroke="rgba(245,158,11,0.55)"
              strokeWidth="1.5"
              strokeDasharray="6,4"
            />

            {/* Small horizontal reference line at B to show angle */}
            <line
              x1="230"
              y1="150"
              x2="300"
              y2="150"
              stroke="rgba(245,158,11,0.3)"
              strokeWidth="1"
              strokeDasharray="4,3"
            />

            {/* Angle arc near point B */}
            <path
              d="M 255,150 A 25,25 0 0,0 268,130"
              fill="none"
              stroke="rgba(245,158,11,0.5)"
              strokeWidth="1"
            />

            {/* Angle label "42°" near second point */}
            <text
              x="300"
              y="148"
              fontSize="10"
              fill="rgba(245,158,11,0.85)"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              42°
            </text>
          </svg>
        </div>
      </div>

      {/* ── Timeline bar ─────────────────────────────────────────────── */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: "10px 14px 14px 14px",
        }}
      >
        {/* Small play icon — 6px amber square */}
        <div
          style={{
            width: 6,
            height: 6,
            background: "#f59e0b",
            borderRadius: 1,
            flexShrink: 0,
          }}
        />

        {/* Progress track */}
        <div
          className="relative flex-1"
          style={{
            height: 4,
            background: "var(--landing-border)",
            borderRadius: 9999,
          }}
        >
          {/* Filled portion — 35% */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: "35%",
              background: "#f59e0b",
              borderRadius: 9999,
            }}
          />
          {/* Scrubber dot at 35% */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "35%",
              transform: "translate(-50%, -50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 0 0 2px rgba(245,158,11,0.5)",
            }}
          />
        </div>

        {/* Timestamp */}
        <span
          style={{
            fontSize: 10,
            color: "var(--landing-text-muted)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          0:42 / 1:18
        </span>
      </div>
    </div>
  );
}
