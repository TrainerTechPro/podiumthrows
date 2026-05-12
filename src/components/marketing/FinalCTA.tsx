"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   FinalCTA
   ────────
   Centered closing section with ambient amber glow from below, bold headline
   with glowing amber accent, two action buttons, and mono trust meta row.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

// ─── Trust meta items ─────────────────────────────────────────────────────────

const TRUST_ITEMS = ["No credit card", "Cancel anytime", "Built on published research"] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinalCTA() {
  return (
    <section
      className="final-cta-section"
      style={{
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
        {/* Section label — centered, flanked rules */}
        <ScrollReveal>
          <div className="flex items-center justify-center" style={{ gap: 12, marginBottom: 28 }}>
            <div
              aria-hidden="true"
              style={{
                width: 24,
                height: 1,
                background: "#FFC800",
                flexShrink: 0,
              }}
            />
            <span
              className="font-heading"
              style={{
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase" as const,
                color: "#FFC800",
              }}
            >
              Ready?
            </span>
            <div
              aria-hidden="true"
              style={{
                width: 24,
                height: 1,
                background: "#FFC800",
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
              fontSize: "clamp(1.9rem, 4.6vw, 3.4rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              maxWidth: 700,
              margin: "0 auto 40px",
              color: "var(--landing-text)",
            }}
          >
            Every session with the wrong sequence is another day leaving{" "}
            <span
              className="final-cta-amber"
              style={{
                color: "#FFC800",
                textShadow: "0 0 32px rgba(255, 200, 0,0.45), 0 0 64px rgba(255, 200, 0,0.2)",
              }}
            >
              distance on the table.
            </span>
          </h2>
        </ScrollReveal>

        {/* Buttons */}
        <ScrollReveal delay={0.14}>
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center flex-wrap"
            style={{ gap: 12 }}
          >
            <Link
              href="/register"
              className="font-heading final-cta-btn-primary"
              style={{
                background: "#FFC800",
                color: "#0a0a0a",
                fontWeight: 700,
                fontSize: 14,
                padding: "15px 36px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
                letterSpacing: "0.02em",
                boxShadow: "0 0 40px rgba(255, 200, 0, 0.22), 0 0 80px rgba(255, 200, 0, 0.08)",
                transition: "filter 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              Start Free Today
            </Link>

            <Link
              href="/deficit-finder"
              className="font-heading final-cta-btn-ghost"
              style={{
                background: "transparent",
                color: "var(--landing-text-secondary)",
                fontWeight: 600,
                fontSize: 14,
                padding: "15px 28px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
                border: "1px solid var(--landing-border)",
                letterSpacing: "0.02em",
                transition: "border-color 0.2s ease, color 0.2s ease, transform 0.2s ease",
              }}
            >
              Run the Deficit Finder →
            </Link>
          </div>
        </ScrollReveal>

        {/* Trust meta — mono engineering register */}
        <ScrollReveal delay={0.2}>
          <div
            className="flex justify-center items-center flex-wrap font-mono"
            style={{
              gap: 14,
              marginTop: 28,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "var(--landing-text-dim)",
            }}
          >
            {TRUST_ITEMS.map((item, i) => (
              <span key={item} className="flex items-center" style={{ gap: 14 }}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      background: "#FFC800",
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
        .final-cta-section {
          padding: 88px 20px;
        }

        @media (min-width: 640px) {
          .final-cta-section {
            padding: 120px 40px;
          }
        }

        @media (min-width: 1024px) {
          .final-cta-section {
            padding: 144px 64px;
          }
        }

        .final-cta-btn-primary:hover {
          filter: brightness(1.08);
          transform: translateY(-2px);
          box-shadow:
            0 12px 36px rgba(255, 200, 0, 0.35),
            0 0 80px rgba(255, 200, 0, 0.18);
        }

        .final-cta-btn-ghost:hover {
          border-color: rgba(255, 200, 0, 0.4);
          color: #FFC800;
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
