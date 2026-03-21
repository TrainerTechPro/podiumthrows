"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   FinalCTA
   ────────
   Centered closing section with ambient amber glow from below, bold headline
   with glowing amber accent, two action buttons, and trust meta row.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

// ─── Trust meta items ─────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  "No credit card",
  "Cancel anytime",
  "Built on published research",
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinalCTA() {
  return (
    <section
      style={{
        padding: "200px 64px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Bottom ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -50,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background:
            "radial-gradient(ellipse at 50% 100%, var(--landing-amber-glow-strong) 0%, transparent 55%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Section label — centered */}
        <ScrollReveal>
          <div
            className="flex items-center justify-center"
            style={{ gap: 12, marginBottom: 28 }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 20,
                height: 2,
                background: "#f59e0b",
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            <span
              className="font-heading"
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#f59e0b",
              }}
            >
              Ready?
            </span>
            <div
              aria-hidden="true"
              style={{
                width: 20,
                height: 2,
                background: "#f59e0b",
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
          </div>
        </ScrollReveal>

        {/* Headline */}
        <ScrollReveal delay={0.08}>
          <h2
            className="font-heading"
            style={{
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              maxWidth: 680,
              margin: "0 auto 40px",
              color: "var(--landing-text)",
            }}
          >
            Every session with the wrong sequence is another day leaving{" "}
            <span
              className="final-cta-amber"
              style={{
                color: "#f59e0b",
                textShadow:
                  "0 0 32px rgba(245,158,11,0.45), 0 0 64px rgba(245,158,11,0.2)",
              }}
            >
              distance on the table.
            </span>
          </h2>
        </ScrollReveal>

        {/* Buttons */}
        <ScrollReveal delay={0.14}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/register"
              className="font-heading final-cta-btn-primary"
              style={{
                background: "#f59e0b",
                color: "#0a0a0a",
                fontWeight: 700,
                fontSize: 15,
                padding: "16px 36px",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-block",
                transition:
                  "background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              Start Free Today
            </Link>

            <Link
              href="/deficit-finder"
              className="font-heading final-cta-btn-ghost"
              style={{
                background: "transparent",
                color: "var(--landing-text)",
                fontWeight: 600,
                fontSize: 15,
                padding: "15px 32px",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-block",
                border: "1px solid var(--landing-border)",
                transition:
                  "border-color 0.2s ease, color 0.2s ease, transform 0.2s ease",
              }}
            >
              Run the Deficit Finder →
            </Link>
          </div>
        </ScrollReveal>

        {/* Trust meta */}
        <ScrollReveal delay={0.2}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 20,
            }}
          >
            {TRUST_ITEMS.map((item, i) => (
              <span
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12,
                  color: "var(--landing-text-dim)",
                }}
              >
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      background: "#f59e0b",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
                {item}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </div>

      {/* Scoped styles */}
      <style>{`
        .final-cta-btn-primary:hover {
          background: #d97706;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(245,158,11,0.35);
        }

        .final-cta-btn-ghost:hover {
          border-color: rgba(245,158,11,0.4);
          color: #f59e0b;
          transform: translateY(-2px);
        }

        @media (prefers-reduced-motion: reduce) {
          .final-cta-btn-primary,
          .final-cta-btn-ghost {
            transition: none !important;
          }
          .final-cta-btn-primary:hover,
          .final-cta-btn-ghost:hover {
            transform: none !important;
          }
          .final-cta-amber {
            text-shadow: none !important;
          }
        }
      `}</style>
    </section>
  );
}
