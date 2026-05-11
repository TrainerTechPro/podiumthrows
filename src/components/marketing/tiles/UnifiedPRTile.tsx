"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   UnifiedPRTile
   ─────────────
   Marketing landing tile showing per-implement PRs for a single athlete.
   Catalog-keyed records — one row per implement weight, no duplicates.
   ═══════════════════════════════════════════════════════════════════════════ */

interface PRRowProps {
  weight: string;
  distance: string;
  marker: string;
  isComp?: boolean;
}

function PRRow({ weight, distance, marker, isComp }: PRRowProps) {
  const border = isComp ? "rgba(255,200,0,0.35)" : "var(--landing-border-light)";
  const bg = isComp ? "rgba(255,200,0,0.05)" : "var(--landing-bg)";
  const labelColor = isComp ? "#FFC800" : "var(--landing-text-secondary)";
  const valueColor = isComp ? "#FFC800" : "var(--landing-text)";
  const markerColor = isComp ? "#FFC800" : "var(--landing-text-secondary)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: `1px solid ${border}`,
        borderRadius: 8,
        background: bg,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: labelColor,
          fontWeight: 600,
          letterSpacing: "0.08em",
          width: 60,
        }}
      >
        {weight}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
          fontSize: 15,
          fontWeight: 600,
          color: valueColor,
        }}
      >
        {distance}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: markerColor,
          fontWeight: isComp ? 600 : 400,
        }}
      >
        {marker}
      </span>
    </div>
  );
}

export function UnifiedPRTile() {
  return (
    <div
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        padding: 18,
        boxShadow: "var(--landing-neo-raised)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--landing-text)",
      }}
    >
      {/* Header — avatar + name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FFC800, #e6b400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#0a0a0c",
            fontSize: 13,
          }}
        >
          MJ
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--landing-text)" }}>
            Marcus Johnson
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--landing-text-secondary)",
              letterSpacing: "0.06em",
            }}
          >
            SHOT PUT · M · NCAA D1
          </div>
        </div>
      </div>

      {/* Overline */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "var(--landing-text-secondary)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Personal bests
      </div>

      {/* PR rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <PRRow weight="6 KG" distance="19.42m" marker="2 weeks ago" />
        <PRRow weight="7.26 KG" distance="18.05m" marker="↑ comp · last Fri" isComp />
        <PRRow weight="8 KG" distance="17.20m" marker="3 weeks ago" />
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          color: "var(--landing-text-secondary)",
          fontStyle: "italic",
          lineHeight: 1.45,
        }}
      >
        One record per implement. Catalog-keyed — no duplicates from &quot;6kg shot&quot; vs
        &quot;6kg shot put&quot;.
      </div>
    </div>
  );
}
