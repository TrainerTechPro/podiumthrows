"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BentoFeatures
   ─────────────
   Section header + three hand-tuned mockup tiles in a real bento layout
   (top row asymmetric, bottom row full-width) + dense "more in the product"
   strip. ValidatedSessionTile gets the dominant slot — it's the methodology
   differentiator.

   Prior rebuild spec:
     docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md
   ═══════════════════════════════════════════════════════════════════════════ */

import ScrollReveal from "./ScrollReveal";
import MonoLabel from "./MonoLabel";
import { ValidatedSessionTile } from "./tiles/ValidatedSessionTile";
import { UnifiedPRTile } from "./tiles/UnifiedPRTile";
import { PoseAnalysisTile } from "./tiles/PoseAnalysisTile";
import { MoreInProductStrip } from "./MoreInProductStrip";

export default function BentoFeatures() {
  return (
    <section
      id="features"
      aria-label="Product feature highlights"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "96px 20px",
        scrollMarginTop: 80,
      }}
    >
      {/* ── Section header ─────────────────────────────────────────────── */}
      <ScrollReveal>
        <div style={{ marginBottom: 56, maxWidth: 720 }}>
          <MonoLabel>The Three Things</MonoLabel>
          <h2
            className="font-heading"
            style={{
              fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "var(--landing-text)",
              margin: 0,
              marginTop: 14,
            }}
          >
            Built specifically for throws coaches.
          </h2>
          <p
            style={{
              marginTop: 16,
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--landing-text-secondary)",
              maxWidth: 560,
            }}
          >
            Three pieces of the product that nothing else on the market does the same way. The rest
            of the surface backs them up.
          </p>
        </div>
      </ScrollReveal>

      {/* ── Bento grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        <ScrollReveal delay={0} className="lg:col-span-2">
          <ValidatedSessionTile />
        </ScrollReveal>
        <ScrollReveal delay={0.08}>
          <UnifiedPRTile />
        </ScrollReveal>
        <ScrollReveal delay={0.16} className="lg:col-span-3">
          <PoseAnalysisTile />
        </ScrollReveal>
      </div>

      {/* ── More-in-product strip ──────────────────────────────────────── */}
      <ScrollReveal delay={0.24}>
        <MoreInProductStrip />
      </ScrollReveal>
    </section>
  );
}
