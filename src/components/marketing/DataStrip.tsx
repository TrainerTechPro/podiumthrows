import ScrollReveal from "./ScrollReveal";

/**
 * DataStrip — telemetry-style horizontal readout strip.
 * Key stats in a row with dividers, IBM Plex Mono for values.
 */

const STATS = [
  { label: "Implements", value: "4" },
  { label: "Session Validation", value: "100%" },
  { label: "Methodology", value: "Vol I–IV" },
  { label: "Exercise Types", value: "5" },
] as const;

export default function DataStrip() {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(245, 158, 11, 0.12)",
        borderBottom: "1px solid rgba(245, 158, 11, 0.12)",
        background: "rgba(245, 158, 11, 0.02)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "40px 16px",
        }}
      >
        <ScrollReveal>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 0,
            }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                }}
              >
                {/* Stat cell */}
                <div
                  style={{
                    textAlign: "center",
                    padding: "0 32px",
                  }}
                >
                  {/* Label */}
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--landing-text-muted)",
                      marginBottom: 6,
                    }}
                  >
                    {stat.label}
                  </div>
                  {/* Value */}
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 32,
                      fontWeight: 600,
                      color: "var(--landing-text)",
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {stat.value}
                  </div>
                </div>

                {/* Divider (not after last) */}
                {i < STATS.length - 1 && (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 1,
                      height: 40,
                      background: "rgba(245, 158, 11, 0.12)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
