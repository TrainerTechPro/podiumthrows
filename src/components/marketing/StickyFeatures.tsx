"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   StickyFeatures (now Alternating rows)
   ─────────────────────────────────────
   Two feature blocks shown as alternating side-by-side rows. The file name
   is kept for import stability — the sticky-pin scrolljack was removed in
   favor of a calmer editorial rhythm: text + mockup, then mockup + text.
   ═══════════════════════════════════════════════════════════════════════════ */

import SessionMockup from "./SessionMockup";
import ProgrammingMockup from "./ProgrammingMockup";
import ScrollReveal from "./ScrollReveal";

// ─── Feature data ────────────────────────────────────────────────────────────

type Feature = {
  number: string;
  label: string;
  title: string;
  description: string;
  spec: string;
  tag?: string;
};

const FEATURES: readonly Feature[] = [
  {
    number: "01",
    label: "Session Builder",
    title: "Build sessions the way Bondarchuk intended.",
    description:
      "Real-time implement sequencing validation. Drill progression from stand to full — every implement tracked. If a session goes light → heavy, Podium flags it before the athlete touches the ring.",
    spec: "Enforces: descending sequences · session structure · 15–20% differentials",
    tag: "✓ Bondarchuk-validated",
  },
  {
    number: "02",
    label: "Programming",
    title: "Periodize across your entire roster.",
    description:
      "Build training blocks, assign programs by event group, and push updates to every athlete at once. See who's in what phase at a glance.",
    spec: "Per-athlete blocks · event-group assignments · phase visibility",
  },
] as const;

const MOCKUPS = [SessionMockup, ProgrammingMockup] as const;

// ─── Components ──────────────────────────────────────────────────────────────

function FeatureCopy({ feature }: { feature: Feature }) {
  return (
    <div className="flex flex-col justify-center">
      {/* Number + extending line */}
      <div className="flex items-center mb-5" style={{ gap: 12 }}>
        <span
          className="font-heading"
          style={{
            fontSize: 11,
            color: "var(--landing-text-dim)",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {feature.number}
        </span>
        <span
          className="flex-1"
          style={{ height: 1, background: "var(--landing-border)" }}
          aria-hidden="true"
        />
      </div>

      {/* Eyebrow */}
      <div
        className="font-heading mb-4"
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.28em",
          color: "#FFC800",
        }}
      >
        {feature.label}
      </div>

      {/* Title */}
      <h3
        className="font-heading mb-5"
        style={{
          fontWeight: 800,
          fontSize: "clamp(1.6rem, 2.6vw, 2.25rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.035em",
          color: "var(--landing-text)",
        }}
      >
        {feature.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.75,
          color: "var(--landing-text-secondary)",
          maxWidth: 460,
          marginBottom: 22,
        }}
      >
        {feature.description}
      </p>

      {/* Spec line */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--landing-text-muted)",
          paddingTop: 16,
          borderTop: "1px solid var(--landing-border)",
          maxWidth: 460,
        }}
      >
        {feature.spec}
      </div>

      {/* Optional tag — quieter, outline-only */}
      {feature.tag && (
        <span
          className="font-heading inline-flex self-start mt-5"
          style={{
            fontSize: 11,
            color: "#FFC800",
            padding: "5px 12px",
            border: "1px solid rgba(255, 200, 0, 0.25)",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {feature.tag}
        </span>
      )}
    </div>
  );
}

function FeatureMockup({ Mockup }: { Mockup: (typeof MOCKUPS)[number] }) {
  return (
    <div className="relative">
      <Mockup />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StickyFeatures() {
  return (
    <section aria-label="Product features" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="px-5 sm:px-8 lg:px-12 py-20 sm:py-28 lg:py-36">
        {FEATURES.map((feature, i) => {
          const Mockup = MOCKUPS[i];
          const mockupOnRight = i % 2 === 0;
          const gridCols = mockupOnRight
            ? "grid-cols-1 lg:grid-cols-[5fr_7fr]"
            : "grid-cols-1 lg:grid-cols-[7fr_5fr]";

          return (
            <div
              key={feature.number}
              className={`grid ${gridCols} gap-10 lg:gap-16 xl:gap-20 items-center ${
                i === 0 ? "" : "mt-24 sm:mt-32 lg:mt-40"
              }`}
            >
              {mockupOnRight ? (
                <>
                  <ScrollReveal>
                    <FeatureCopy feature={feature} />
                  </ScrollReveal>
                  <ScrollReveal delay={0.1}>
                    <FeatureMockup Mockup={Mockup} />
                  </ScrollReveal>
                </>
              ) : (
                <>
                  <ScrollReveal>
                    <FeatureMockup Mockup={Mockup} />
                  </ScrollReveal>
                  <ScrollReveal delay={0.1}>
                    <FeatureCopy feature={feature} />
                  </ScrollReveal>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
