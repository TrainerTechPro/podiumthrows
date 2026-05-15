"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroSection
   ───────────
   Dashboard-as-hero. Short, confident text + CTAs sit above. The product
   mockup is the centerpiece — a full-width session calendar showing the
   Bondarchuk descending-implement rule and a validation rejection.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import TextReveal from "@/components/marketing/TextReveal";
import HeroDeviceMockup from "@/components/marketing/HeroDeviceMockup";

// ─── Animation helpers ────────────────────────────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={shouldReduce ? undefined : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeroSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="relative flex flex-col overflow-hidden" aria-label="Hero">
      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-36 sm:pt-40 lg:pt-44 pb-20 lg:pb-28">
        {/* ── Top: headline + CTAs ───────────────────────────────────── */}
        <div className="max-w-[860px] mx-auto text-center mb-14 sm:mb-20">
          {/* Eyebrow */}
          <FadeUp delay={0.15}>
            <div
              className="font-heading mb-7 sm:mb-9"
              style={{
                fontSize: 11,
                letterSpacing: "0.32em",
                textTransform: "uppercase" as const,
                color: "var(--landing-text-muted)",
              }}
            >
              For Throws Coaches
            </div>
          </FadeUp>

          {/* Headline — re-anchored to the research finding (the only
              uncontestable claim on the page). */}
          <h1
            className="font-heading font-black mb-7"
            style={{
              fontSize: "clamp(2.6rem, 6.4vw, 5.4rem)",
              lineHeight: 0.96,
              letterSpacing: "-0.045em",
              color: "var(--landing-text)",
            }}
          >
            <TextReveal delay={0.25}>Ascending implements cost</TextReveal>
            <TextReveal delay={0.4}>
              <span style={{ color: "#FFC800" }}>2–4 meters.</span> Every time.
            </TextReveal>
          </h1>

          {/* Subtitle */}
          <FadeUp delay={0.65}>
            <p
              className="mx-auto"
              style={{
                fontSize: 18,
                lineHeight: 1.65,
                color: "var(--landing-text-secondary)",
                maxWidth: 620,
              }}
            >
              Podium is the only coaching platform that enforces Bondarchuk implement sequencing —
              so every session your athletes touch is set up to transfer, not regress.
            </p>
          </FadeUp>

          {/* CTAs */}
          <FadeUp delay={0.8}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-9">
              <Link
                href="/register"
                className="font-heading font-bold text-center transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{
                  fontSize: 14,
                  padding: "15px 36px",
                  background: "#FFC800",
                  color: "#0a0a0a",
                  borderRadius: 8,
                  letterSpacing: "0.02em",
                }}
              >
                Start Free
              </Link>
              <Link
                href="/deficit-finder"
                className="font-heading font-bold text-center transition-all duration-200 hover:brightness-125 active:scale-[0.97] inline-flex items-center justify-center gap-2"
                style={{
                  fontSize: 14,
                  padding: "15px 28px",
                  background: "transparent",
                  color: "var(--landing-text-secondary)",
                  borderRadius: 8,
                  border: "1px solid var(--landing-border)",
                  letterSpacing: "0.02em",
                }}
              >
                Free Deficit Finder
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </FadeUp>

          {/* Trust meta */}
          <FadeUp delay={0.95}>
            <p
              className="mt-5"
              style={{
                fontSize: 13,
                color: "var(--landing-text-muted)",
              }}
            >
              No credit card · 3 athletes free · Cancel anytime
            </p>
          </FadeUp>
        </div>

        {/* ── Bottom: dashboard mockup ────────────────────────────────── */}
        <FadeUp delay={1.1}>
          <div className="relative max-w-[1180px] mx-auto w-full">
            {/* Mockup with a slight 3D rest pose */}
            {shouldReduce ? (
              <div className="relative">
                <HeroDeviceMockup />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 60, rotateX: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, rotateX: 1.5, scale: 1 }}
                transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  transformOrigin: "50% 100%",
                  transformStyle: "preserve-3d",
                  perspective: 1400,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <HeroDeviceMockup />
              </motion.div>
            )}

            {/* Caption — events covered */}
            <div
              className="mt-6 text-center"
              style={{
                fontSize: 13,
                color: "var(--landing-text-muted)",
              }}
              aria-hidden="true"
            >
              Shot Put · Discus · Hammer · Javelin
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
