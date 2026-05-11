"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   PoseAnalysisTile
   ────────────────
   Marketing landing tile showing a video pose-overlay frame with a
   throws-specific measurements panel. Two-column layout: SVG pose on
   left, angle readouts vs ideal ranges on right.

   Color rule (per spec):
     - success-green if value is inside target range (subtitle gets ✓)
     - brand amber if value is outside target range but close
     - dim/neutral text for readings without a target comparison
   ═══════════════════════════════════════════════════════════════════════════ */

interface MeasurementProps {
  label: string;
  value: string;
  /** 0..1 — fraction of how the value sits within the target range */
  fill: number;
  /** Italic subtitle like "target 38–42° ✓" */
  subtitle: string;
  /** Color of the value text + fill bar */
  tone: "in-range" | "close" | "neutral";
}

function Measurement({ label, value, fill, subtitle, tone }: MeasurementProps) {
  const color =
    tone === "in-range" ? "#00ff88" : tone === "close" ? "#FFC800" : "var(--landing-text)";
  const barColor =
    tone === "in-range" ? "#00ff88" : tone === "close" ? "#FFC800" : "var(--landing-text-muted)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: "var(--landing-text-secondary)" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 13,
            color,
            fontWeight: 600,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: "var(--landing-border-light)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: `${Math.round(fill * 100)}%`, height: "100%", background: barColor }}
        />
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--landing-text-secondary)",
          fontStyle: "italic",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function PoseOverlaySvg() {
  // Side-view stylization of a shot-putter at release.
  // Body lines green, throwing arm + shot brand-amber.
  return (
    <svg
      viewBox="0 0 200 200"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      {/* Ground */}
      <line
        x1="0"
        y1="180"
        x2="200"
        y2="180"
        stroke="var(--landing-border-light)"
        strokeWidth="1"
      />

      {/* Body lines */}
      <line x1="80" y1="180" x2="100" y2="120" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="115" y1="180" x2="100" y2="120" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="100" y1="120" x2="112" y2="80" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="112" y1="80" x2="135" y2="62" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="112" y1="80" x2="95" y2="85" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="135" y1="62" x2="165" y2="52" stroke="#FFC800" strokeWidth="3" />

      {/* Head */}
      <circle cx="115" cy="68" r="7" fill="none" stroke="#00ff88" strokeWidth="2" opacity="0.9" />

      {/* Joint dots */}
      <circle cx="80" cy="180" r="3" fill="#FFC800" />
      <circle cx="115" cy="180" r="3" fill="#FFC800" />
      <circle cx="100" cy="120" r="3" fill="#FFC800" />
      <circle cx="112" cy="80" r="3" fill="#FFC800" />
      <circle cx="135" cy="62" r="3" fill="#FFC800" />
      <circle cx="165" cy="52" r="3" fill="#FFC800" />

      {/* Shot */}
      <circle cx="172" cy="49" r="4.5" fill="#FFC800" />
    </svg>
  );
}

export function PoseAnalysisTile() {
  return (
    <div
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "var(--landing-neo-raised)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--landing-text)",
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        minHeight: 220,
      }}
    >
      {/* Left — video frame */}
      <div
        style={{
          position: "relative",
          background: "linear-gradient(160deg, var(--landing-bg), #000)",
          overflow: "hidden",
        }}
      >
        <PoseOverlaySvg />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 10,
            color: "var(--landing-text-secondary)",
            letterSpacing: "0.06em",
          }}
        >
          00:02.47
        </div>
      </div>

      {/* Right — measurements panel */}
      <div
        style={{
          background: "var(--landing-bg)",
          borderLeft: "1px solid var(--landing-border-light)",
          padding: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "var(--landing-text-secondary)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Release frame
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Measurement
            label="Trunk lean"
            value="28°"
            fill={0.72}
            subtitle="target 30–35°"
            tone="close"
          />
          <Measurement
            label="Release angle"
            value="42°"
            fill={0.95}
            subtitle="target 38–42° ✓"
            tone="in-range"
          />
          <Measurement
            label="Knee drive"
            value="138°"
            fill={0.8}
            subtitle="target 130–140° ✓"
            tone="neutral"
          />
        </div>
      </div>
    </div>
  );
}
