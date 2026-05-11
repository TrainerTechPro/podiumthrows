"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BentoFeatures (rebuild — 2026-05-11)
   ────────────────────────────────────
   Section header + three hand-tuned mockup tiles + dense "more in the product"
   strip. Replaces the previous 7-card icon+title+desc template per
   Frontend Audit Prompt 8. See:
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
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "64px 16px",
      }}
    >
      {/* Section header */}
      <ScrollReveal>
        <div style={{ marginBottom: 40 }}>
          <MonoLabel>The Three Things</MonoLabel>
          <h2
            className="font-heading"
            style={{
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "var(--landing-text)",
              margin: 0,
              marginTop: 8,
            }}
          >
            Built specifically for throws coaches.
          </h2>
        </div>
      </ScrollReveal>

      {/* Three tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <ScrollReveal delay={0}>
          <ValidatedSessionTile />
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <UnifiedPRTile />
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <PoseAnalysisTile />
        </ScrollReveal>
      </div>

      {/* More-in-product strip */}
      <ScrollReveal delay={0.3}>
        <MoreInProductStrip />
      </ScrollReveal>
    </section>
  );
}
