"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MoreInProductStrip
   ──────────────────
   Single text strip below the 3 feature tiles. Lists the remaining product
   surface in dense plain-text form — no icons, no card grid, no chrome.
   ═══════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  "Athlete profiles & readiness",
  "Questionnaire builder",
  "Event groups (shot / discus / hammer / javelin)",
  "Practice tools (plate calc, rest timer, RPE logger)",
  "Performance analytics",
];

export function MoreInProductStrip() {
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 24,
        borderTop: "1px solid var(--landing-border-light)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "var(--landing-text-secondary)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        More in the product
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--landing-text-secondary)",
        }}
      >
        {FEATURES.map((f, i) => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <span>{f}</span>
            {i < FEATURES.length - 1 && (
              <span aria-hidden="true" style={{ color: "var(--landing-text-muted)" }}>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
