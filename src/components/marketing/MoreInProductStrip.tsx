"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MoreInProductStrip
   ──────────────────
   Single text strip below the 3 feature tiles. Lists the remaining product
   surface as a numbered spec line — engineering-register chrome matching the
   hero and StickyFeatures spec line treatment.
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
        marginTop: 40,
        paddingTop: 28,
        borderTop: "1px solid var(--landing-border-light)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-8">
        {/* Overline */}
        <div
          style={{
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: "var(--landing-text-muted)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          More in the product
        </div>

        {/* Numbered spec list */}
        <ul
          className="flex flex-wrap"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            gap: "10px 18px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--landing-text-secondary)",
            flex: 1,
          }}
        >
          {FEATURES.map((feature, i) => (
            <li key={feature} className="inline-flex items-baseline" style={{ gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  color: "var(--landing-text-dim)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
