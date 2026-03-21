"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BondarchukProof
   ───────────────
   "2–4m" stat section backed by Bondarchuk's research.
   Left: giant animated stat with lamp glow effect.
   Right: research quote, citation, and event tags.
   ═══════════════════════════════════════════════════════════════════════════ */

import { motion, useReducedMotion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

// ─── Event tags ───────────────────────────────────────────────────────────────

const EVENTS = ["Shot Put", "Discus", "Hammer", "Javelin"] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function BondarchukProof() {
  const shouldReduce = useReducedMotion();

  return (
    <section
      style={{
        position: "relative",
        padding: "180px 64px",
        overflow: "hidden",
      }}
    >
      {/* ── Lamp glow effect ──────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -20,
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 350,
          background:
            "conic-gradient(from 90deg at 50% -5%, transparent 0deg, var(--landing-amber-glow-strong) 60deg, transparent 120deg)",
          filter: "blur(80px)",
          opacity: 0.5,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Inner container ───────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="bondarchuk-proof-grid">
          {/* ── Left — Animated stat ──────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Stroke echo — positioned behind */}
              <div
                aria-hidden="true"
                className="font-heading"
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  fontSize: "clamp(9rem, 18vw, 16rem)",
                  fontWeight: 900,
                  lineHeight: 0.75,
                  letterSpacing: "-0.07em",
                  WebkitTextStroke: "1px rgba(245,158,11,0.1)",
                  color: "transparent",
                  zIndex: -1,
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                2–4m
              </div>

              {/* Animated stat */}
              <motion.div
                className="font-heading"
                initial={
                  shouldReduce
                    ? undefined
                    : { opacity: 0, scale: 0.8, filter: "blur(12px)" }
                }
                whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                }}
                style={{
                  fontSize: "clamp(9rem, 18vw, 16rem)",
                  fontWeight: 900,
                  lineHeight: 0.75,
                  letterSpacing: "-0.07em",
                  color: "#f59e0b",
                  whiteSpace: "nowrap",
                  position: "relative",
                }}
              >
                2–4m
              </motion.div>
            </div>
          </div>

          {/* ── Right — Context ───────────────────────────────────────── */}
          <ScrollReveal delay={0.15}>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Section label */}
              <div
                className="flex items-center"
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
                  The Research
                </span>
              </div>

              {/* Quote */}
              <blockquote
                style={{
                  margin: 0,
                  fontSize: 19,
                  color: "var(--landing-text)",
                  lineHeight: 1.65,
                  fontStyle: "italic",
                  fontWeight: 500,
                }}
              >
                {`"Every natural athlete lost `}
                <strong
                  style={{
                    color: "#f59e0b",
                    fontStyle: "normal",
                    fontWeight: 700,
                  }}
                >
                  2–4 meters
                </strong>
                {` when implements were sequenced ascending. One hundred percent of them."`}
              </blockquote>

              {/* Citation */}
              <div
                style={{
                  fontSize: 13,
                  color: "var(--landing-text-muted)",
                  lineHeight: 1.6,
                  paddingTop: 20,
                  marginTop: 20,
                  borderTop: "1px solid var(--landing-border)",
                }}
              >
                Dr. Anatoliy Bondarchuk,{" "}
                <em>Transfer of Training in Sports</em>, Volume IV, pp.
                114–117. Documented across all four throwing events.
              </div>

              {/* Event tags */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 20,
                }}
              >
                {EVENTS.map((event, i) => (
                  <ScrollReveal key={event} delay={0.15 + i * 0.06}>
                    <span className="bondarchuk-event-tag font-heading">
                      {event}
                    </span>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* ── Scoped styles ─────────────────────────────────────────────── */}
      <style>{`
        .bondarchuk-proof-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          align-items: center;
        }

        @media (min-width: 1024px) {
          .bondarchuk-proof-grid {
            grid-template-columns: auto 1fr;
            gap: 100px;
            align-items: center;
          }
        }

        @media (max-width: 1023px) {
          .bondarchuk-proof-grid > :first-child {
            justify-content: center;
          }
        }

        .bondarchuk-event-tag {
          display: inline-block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--landing-text-dim);
          border: 1px solid var(--landing-border);
          padding: 5px 12px;
          transition: border-color 0.2s ease, color 0.2s ease;
          cursor: default;
        }

        .bondarchuk-event-tag:hover {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        @media (prefers-reduced-motion: reduce) {
          .bondarchuk-event-tag {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
