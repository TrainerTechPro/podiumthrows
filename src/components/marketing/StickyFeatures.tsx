"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   StickyFeatures
   ──────────────
   Scroll-linked features section. Left column has text blocks that scroll
   while right column stays pinned with an IntersectionObserver-driven
   mockup crossfade. On mobile: single column with inline mockups.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import SessionMockup from "./SessionMockup";
import VideoMockup from "./VideoMockup";
import ProgrammingMockup from "./ProgrammingMockup";
import ScrollReveal from "./ScrollReveal";

// ─── Feature Data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    number: "01",
    label: "Session Builder",
    title: "Build sessions the way Bondarchuk intended.",
    description:
      "Real-time implement sequencing validation. Drill progression from stand to full \u2014 with every implement tracked. If an athlete\u2019s session goes light\u2192heavy, Podium flags it before they touch the ring.",
    tag: "\u2713 Bondarchuk-validated",
  },
  {
    number: "02",
    label: "Video Analysis",
    title: "Draw on throws. Share instantly.",
    description:
      "Frame-by-frame annotation. Draw release angles, mark positions, add voice notes. Share a link \u2014 your athlete sees exactly what to fix.",
    tag: null,
  },
  {
    number: "03",
    label: "Programming",
    title: "Periodize across your entire roster.",
    description:
      "Build training blocks, assign programs by event group, and push updates to every athlete at once. See who\u2019s in what phase at a glance.",
    tag: null,
  },
] as const;

const MOCKUP_COMPONENTS = [SessionMockup, VideoMockup, ProgrammingMockup];

// ─── Feature Block ──────────────────────────────────────────────────────────

interface FeatureBlockProps {
  feature: (typeof FEATURES)[number];
  isLast: boolean;
}

function FeatureBlock({ feature, isLast }: FeatureBlockProps) {
  return (
    <div
      className="flex flex-col justify-center"
      style={{
        minHeight: "70vh",
        borderBottom: isLast ? "none" : "1px solid var(--landing-border)",
      }}
    >
      {/* Number with extending line */}
      <div
        className="flex items-center"
        style={{ gap: 12, marginBottom: 20 }}
      >
        <span
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontSize: 11,
            color: "var(--landing-text-dim)",
            flexShrink: 0,
          }}
        >
          {feature.number}
        </span>
        <span
          className="flex-1"
          style={{ height: 1, background: "var(--landing-border)" }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.28em",
          color: "#f59e0b",
          marginBottom: 14,
        }}
      >
        {feature.label}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          fontWeight: 800,
          fontSize: 34,
          lineHeight: 1.08,
          letterSpacing: "-0.035em",
          color: "var(--landing-text)",
          margin: 0,
          marginBottom: 18,
        }}
      >
        {feature.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: "var(--landing-text-secondary)",
          maxWidth: 380,
          margin: 0,
          marginBottom: feature.tag ? 20 : 0,
        }}
      >
        {feature.description}
      </p>

      {/* Optional tag */}
      {feature.tag && (
        <span
          className="inline-flex"
          style={{
            fontSize: 11,
            color: "#f59e0b",
            padding: "5px 12px",
            background: "var(--landing-amber-glow-strong)",
            borderRadius: 6,
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontWeight: 600,
            alignSelf: "flex-start",
          }}
        >
          {feature.tag}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StickyFeatures() {
  const [activeFeature, setActiveFeature] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // IntersectionObserver to track which feature block is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((ref, index) => {
      if (!ref) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveFeature(index);
            }
          });
        },
        { threshold: 0.5 }
      );

      observer.observe(ref);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  const ActiveMockup = MOCKUP_COMPONENTS[activeFeature];

  return (
    <section
      style={{ maxWidth: 1400, margin: "0 auto" }}
    >
      {/* ── Desktop Layout ─────────────────────────────────────────── */}
      <div className="hidden lg:grid" style={{ gridTemplateColumns: "1fr 1fr", minHeight: "240vh" }}>
        {/* Left column — scrolling text */}
        <div
          style={{ padding: "180px 64px" }}
        >
          {FEATURES.map((feature, i) => (
            <div
              key={feature.number}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
            >
              <FeatureBlock
                feature={feature}
                isLast={i === FEATURES.length - 1}
              />
            </div>
          ))}
        </div>

        {/* Right column — sticky mockup */}
        <div
          className="lg:sticky lg:top-1/2 lg:-translate-y-1/2"
          style={{
            borderLeft: "1px solid var(--landing-border)",
            padding: "48px 64px",
            height: "fit-content",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.02 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.98 }
              }
              transition={{ duration: 0.25 }}
            >
              <ActiveMockup />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile Layout ──────────────────────────────────────────── */}
      <div className="lg:hidden" style={{ padding: "64px 24px" }}>
        {FEATURES.map((feature, i) => {
          const Mockup = MOCKUP_COMPONENTS[i];
          return (
            <div key={feature.number}>
              <FeatureBlock
                feature={feature}
                isLast={i === FEATURES.length - 1}
              />
              <ScrollReveal>
                <div style={{ padding: "32px 0 48px" }}>
                  <Mockup />
                </div>
              </ScrollReveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
