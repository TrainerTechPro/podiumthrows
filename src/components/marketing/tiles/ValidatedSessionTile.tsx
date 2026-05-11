"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   ValidatedSessionTile
   ────────────────────
   Marketing landing tile showing a Bondarchuk-validated descending session.
   Three throwing blocks (9kg → 7.26kg → 6kg shot) with "strength block
   between" markers, plus a footer citing Vol IV.

   See docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md
   for the full spec.
   ═══════════════════════════════════════════════════════════════════════════ */

interface BlockProps {
  classification: string;
  implement: string;
  marker: string;
  emphasized?: boolean;
}

function Block({ classification, implement, marker, emphasized }: BlockProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        border: "1px solid var(--landing-border-light)",
        borderRadius: 8,
        background: "var(--landing-bg)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--landing-text-secondary)",
          fontWeight: 600,
          letterSpacing: "0.1em",
          width: 28,
        }}
      >
        {classification}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: emphasized ? "#FFC800" : "var(--landing-text)",
        }}
      >
        {implement}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--landing-text-secondary)",
        }}
      >
        {marker}
      </span>
    </div>
  );
}

export function ValidatedSessionTile() {
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
      {/* Top row — overline + valid status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "var(--landing-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          Session · Tue 09:00
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#00ff88",
            letterSpacing: "0.12em",
          }}
        >
          ✓ VALID
        </div>
      </div>

      {/* Block stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Block classification="CE" implement="9kg shot" marker="heaviest →" emphasized />
        <Block classification="CE" implement="7.26kg shot" marker="→ comp" />
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            color: "var(--landing-text-secondary)",
            letterSpacing: "0.05em",
            margin: "2px 0",
            fontStyle: "italic",
          }}
        >
          strength block between
        </div>
        <Block classification="CE" implement="6kg shot" marker="→ lightest" />
      </div>

      {/* Footer citation */}
      <div
        style={{
          marginTop: 12,
          padding: "8px 10px",
          borderRadius: 6,
          background: "rgba(0,255,136,0.04)",
          borderLeft: "2px solid #00ff88",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--landing-text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.45,
          }}
        >
          Descending sequence per{" "}
          <strong style={{ color: "var(--landing-text)", fontStyle: "normal" }}>Vol IV</strong>.
          Strength between throwing blocks enables passive activation transfer.
        </div>
      </div>
    </div>
  );
}
