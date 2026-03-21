"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroSection
   ───────────
   Full-width hero with animated text (left) and a 3D-perspective device
   mockup (right). Floating gradient orbs + grid overlay for depth.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
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
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduce = useReducedMotion();

  // Scroll-linked parallax for the device mockup
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const scrollRotateX = useTransform(scrollYProgress, [0, 1], [3, 0]);
  const scrollRotateY = useTransform(scrollYProgress, [0, 1], [-3, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      {/* ── Background effects ─────────────────────────────────────────── */}

      {/* Floating gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Orb 1 — amber, top-left */}
        <div
          className="absolute animate-float"
          style={{
            width: 550,
            height: 550,
            top: "-10%",
            left: "-5%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
            filter: "blur(100px)",
            animationDuration: "22s",
          }}
        />
        {/* Orb 2 — indigo, center-right */}
        <div
          className="absolute animate-float"
          style={{
            width: 650,
            height: 650,
            top: "20%",
            right: "-10%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)",
            filter: "blur(100px)",
            animationDuration: "22s",
            animationDelay: "-7s",
          }}
        />
        {/* Orb 3 — amber, bottom-center */}
        <div
          className="absolute animate-float"
          style={{
            width: 450,
            height: 450,
            bottom: "-5%",
            left: "30%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)",
            filter: "blur(100px)",
            animationDuration: "22s",
            animationDelay: "-14s",
          }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
        }}
      />

      {/* ── Content grid ───────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-24 sm:py-28 lg:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 sm:gap-16 lg:gap-20 items-center">

          {/* ── Left column: text ──────────────────────────────────────── */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <FadeUp delay={0.15}>
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-8 sm:mb-10">
                <div
                  className="flex-shrink-0"
                  style={{
                    width: 32,
                    height: 2,
                    background: "#f59e0b",
                    borderRadius: 1,
                  }}
                  aria-hidden="true"
                />
                <span
                  className="font-heading"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase" as const,
                    color: "#f59e0b",
                  }}
                >
                  For Throws Coaches
                </span>
              </div>
            </FadeUp>

            {/* Title */}
            <h1
              className="font-heading font-black mb-6 sm:mb-8"
              style={{
                fontSize: "clamp(3.2rem, 6.5vw, 5.8rem)",
                lineHeight: 0.88,
                letterSpacing: "-0.05em",
                color: "var(--landing-text)",
              }}
            >
              <TextReveal delay={0.25}>Stop coaching</TextReveal>
              <TextReveal delay={0.38}>from a</TextReveal>
              <TextReveal delay={0.5}>
                <span
                  className="text-primary-500"
                  style={{ textShadow: "0 0 60px rgba(245,158,11,0.25)" }}
                >
                  spreadsheet.
                </span>
              </TextReveal>
            </h1>

            {/* Subtitle */}
            <FadeUp delay={0.75}>
              <p
                className="mx-auto lg:mx-0"
                style={{
                  fontSize: 17,
                  lineHeight: 1.8,
                  color: "var(--landing-text-secondary)",
                  maxWidth: 440,
                }}
              >
                Session planning, video analysis, and performance tracking
                built for the way throws coaches actually work.
              </p>
            </FadeUp>

            {/* Buttons */}
            <FadeUp delay={0.9}>
              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 mt-8 sm:mt-10">
                <Link
                  href="/register"
                  className="font-heading font-bold text-center transition-all duration-200 hover:brightness-110 active:scale-[0.97] w-full sm:w-auto"
                  style={{
                    fontSize: 14,
                    padding: "14px 32px",
                    background: "#f59e0b",
                    color: "#0a0a0a",
                    borderRadius: 10,
                    boxShadow: "0 0 40px rgba(245,158,11,0.25), 0 0 80px rgba(245,158,11,0.1)",
                  }}
                >
                  Start Free
                </Link>
                <Link
                  href="/deficit-finder"
                  className="font-heading font-bold text-center transition-all duration-200 hover:brightness-125 active:scale-[0.97] w-full sm:w-auto"
                  style={{
                    fontSize: 14,
                    padding: "14px 32px",
                    background: "transparent",
                    color: "var(--landing-text-secondary)",
                    borderRadius: 10,
                    border: "1px solid var(--landing-border)",
                  }}
                >
                  Free Deficit Finder &rarr;
                </Link>
              </div>
            </FadeUp>

            {/* Trust meta */}
            <FadeUp delay={1.05}>
              <p
                className="mt-6 flex items-center justify-center lg:justify-start gap-1 flex-wrap"
                style={{
                  fontSize: 12,
                  color: "var(--landing-text-dim)",
                }}
              >
                <span>No credit card</span>
                <span style={{ color: "#f59e0b", opacity: 0.5 }} aria-hidden="true">&middot;</span>
                <span>3 athletes free</span>
                <span style={{ color: "#f59e0b", opacity: 0.5 }} aria-hidden="true">&middot;</span>
                <span>Cancel anytime</span>
              </p>
            </FadeUp>
          </div>

          {/* ── Right column: device mockup ────────────────────────────── */}
          <div
            className="relative"
            style={{ perspective: shouldReduce ? "none" : "1200px" }}
          >
            {shouldReduce ? (
              /* Static mockup for reduced-motion */
              <div className="w-full">
                <HeroDeviceMockup />
              </div>
            ) : (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 100,
                  rotateX: 12,
                  rotateY: -6,
                  scale: 0.92,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  rotateX: 3,
                  rotateY: -3,
                  scale: 1,
                }}
                transition={{
                  duration: 1.6,
                  delay: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{
                  rotateX: 0,
                  rotateY: 0,
                  transition: { type: "spring", stiffness: 200, damping: 20 },
                }}
                style={{
                  rotateX: scrollRotateX,
                  rotateY: scrollRotateY,
                  transformStyle: "preserve-3d",
                }}
              >
                <HeroDeviceMockup />
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
