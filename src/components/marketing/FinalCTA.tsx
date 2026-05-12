"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   FinalCTA
   ────────
   Centered closing section. Headline with amber accent on the loss, single
   primary CTA (the page has already pitched Deficit Finder twice), and a
   plain trust-meta row. No decorative glow.
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
      }}
    >
      <div style={{ position: "relative" }}>
        {/* Section label */}
        <ScrollReveal>
          <div
            className="font-heading"
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              textTransform: "uppercase" as const,
              color: "var(--landing-text-muted)",
              marginBottom: 28,
            }}
          >
            Ready?
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
            <span style={{ color: "#FFC800" }}>distance on the table.</span>
          </h2>
        </ScrollReveal>

        {/* Single CTA */}
        <ScrollReveal delay={0.14}>
          <div className="flex justify-center">
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
                transition: "filter 0.2s ease, transform 0.2s ease",
              }}
            >
              Start Free Today
            </Link>
          </div>
        </ScrollReveal>

        {/* Trust meta — plain body, no decorative dots */}
        <ScrollReveal delay={0.2}>
          <p
            style={{
              marginTop: 24,
              fontSize: 13,
              color: "var(--landing-text-muted)",
            }}
          >
            {TRUST_ITEMS.join(" · ")}
          </p>
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
        }

        @media (prefers-reduced-motion: reduce) {
          .final-cta-btn-primary {
            transition: none !important;
          }
          .final-cta-btn-primary:hover {
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
