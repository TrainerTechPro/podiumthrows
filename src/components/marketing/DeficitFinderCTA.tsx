"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   DeficitFinderCTA
   ────────────────
   Full-width card inviting coaches to try the free Deficit Finder tool.
   Two-column layout: left = copy + CTA, right = 3-step flow diagram.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Enter event & distances",
    subtitle: "Competition and heavy implement marks",
  },
  {
    title: "Answer 3 quick questions",
    subtitle: "Training history, sequence, implement weights",
  },
  {
    title: "Get your diagnosis",
    subtitle: "Deficit type + corrective recommendation",
  },
] as const;

// ─── Step item ────────────────────────────────────────────────────────────────

interface StepProps {
  number: number;
  title: string;
  subtitle: string;
  isFirst: boolean;
}

function Step({ number, title, subtitle, isFirst }: StepProps) {
  return (
    <div
      className="deficit-step"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 16,
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* Connector line above (all steps after first) */}
      {!isFirst && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 15,
            top: -24,
            width: 1,
            height: 24,
            background: "var(--landing-border)",
          }}
        />
      )}

      {/* Number circle */}
      <div
        aria-hidden="true"
        className="font-heading"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--landing-amber-glow-strong)",
          color: "#f59e0b",
          fontWeight: 700,
          fontSize: 13,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {number}
      </div>

      {/* Text */}
      <div style={{ paddingTop: 5 }}>
        <div
          className="font-heading"
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "#fff",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--landing-text-muted)",
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeficitFinderCTA() {
  return (
    <section
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "40px 64px 140px",
      }}
    >
      {/* Card */}
      <div
        style={{
          background: "var(--landing-surface)",
          border: "1px solid var(--landing-border)",
          borderRadius: 20,
          padding: 72,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Diagonal beam */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -150,
            right: -50,
            width: 300,
            height: 500,
            background:
              "linear-gradient(135deg, var(--landing-amber-glow-strong) 0%, transparent 60%)",
            transform: "rotate(-25deg)",
            filter: "blur(40px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Grid */}
        <div className="deficit-grid" style={{ position: "relative", zIndex: 1 }}>
          {/* ── Left side ──────────────────────────────────────────────── */}
          <div>
            {/* Section label */}
            <div
              className="flex items-center"
              style={{ gap: 12, marginBottom: 20 }}
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
                Free Tool
              </span>
            </div>

            {/* Title */}
            <h2
              className="font-heading"
              style={{
                fontWeight: 800,
                fontSize: 36,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                color: "var(--landing-text)",
                margin: 0,
                maxWidth: 340,
              }}
            >
              Not ready to commit? Find the deficit first.
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: 16,
                color: "var(--landing-text-secondary)",
                lineHeight: 1.7,
                maxWidth: 320,
                margin: "12px 0 0",
              }}
            >
              Answer a few questions about your training sequence and we&apos;ll
              identify exactly where your transfer is breaking down — for free.
            </p>

            {/* CTA button */}
            <div style={{ marginTop: 28 }}>
              <Link
                href="/deficit-finder"
                className="font-heading"
                style={{
                  display: "inline-block",
                  background: "#f59e0b",
                  color: "#0a0a0a",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "14px 32px",
                  borderRadius: 10,
                  textDecoration: "none",
                  transition:
                    "background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#d97706";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 8px 24px rgba(245,158,11,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#f59e0b";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                Run the Deficit Finder
              </Link>
            </div>

            {/* Note */}
            <p
              style={{
                fontSize: 11,
                color: "var(--landing-text-dim)",
                margin: "10px 0 0",
              }}
            >
              No signup required · Instant results
            </p>
          </div>

          {/* ── Right side: 3-step flow ───────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {STEPS.map((step, i) => (
              <Step
                key={step.title}
                number={i + 1}
                title={step.title}
                subtitle={step.subtitle}
                isFirst={i === 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scoped styles */}
      <style>{`
        .deficit-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          align-items: center;
        }

        @media (min-width: 1024px) {
          .deficit-grid {
            grid-template-columns: 1fr 1fr;
            gap: 72px;
          }
        }

        @media (max-width: 767px) {
          .deficit-grid {
            /* outer card padding already reduced via media query below */
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .deficit-grid a {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
