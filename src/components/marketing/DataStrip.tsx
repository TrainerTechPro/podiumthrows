import ScrollReveal from "./ScrollReveal";

/**
 * DataStrip — telemetry-style readout, asymmetric hierarchy.
 * One hero number anchors the row; three supporting facts sit to the right.
 */

const SUPPORTING = [
  { label: "Events", value: "4", detail: "Shot · Discus · Hammer · Javelin" },
  { label: "Methodology", value: "Vol I–IV", detail: "Transfer of Training" },
  { label: "Exercise Types", value: "5", detail: "CE · SDE · GPE · SPE · Comp" },
] as const;

export default function DataStrip() {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(255, 200, 0, 0.12)",
        borderBottom: "1px solid rgba(255, 200, 0, 0.12)",
        background: "rgba(255, 200, 0, 0.02)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "64px 20px",
        }}
      >
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 lg:gap-20 items-center">
            {/* ── Hero stat ───────────────────────────────────────────── */}
            <div className="text-center lg:text-left">
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "var(--landing-text-muted)",
                  marginBottom: 12,
                }}
              >
                Session validation
              </div>
              <div
                className="font-heading font-black"
                style={{
                  fontSize: "clamp(5rem, 11vw, 9rem)",
                  fontWeight: 900,
                  color: "#FFC800",
                  lineHeight: 0.85,
                  letterSpacing: "-0.05em",
                }}
              >
                100%
              </div>
              <div
                className="mx-auto lg:mx-0"
                style={{
                  marginTop: 14,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--landing-text-secondary)",
                  maxWidth: 360,
                }}
              >
                of throwing sessions checked against the descending-implement rule. The engine
                refuses ascending sequences.
              </div>
            </div>

            {/* ── Supporting facts ────────────────────────────────────── */}
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-px"
              style={{ background: "var(--landing-border-light)" }}
            >
              {SUPPORTING.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "var(--landing-bg)",
                    padding: "20px 18px",
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color: "var(--landing-text-muted)",
                      marginBottom: 10,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    className="font-heading"
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--landing-text)",
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      marginBottom: 10,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      color: "var(--landing-text-dim)",
                      lineHeight: 1.5,
                    }}
                  >
                    {stat.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
