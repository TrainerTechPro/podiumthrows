"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   PricingPreview
   ──────────────
   Three-tier pricing section: Free / Pro (featured, animated border) / Elite.
   Pro card has a conic-gradient spinning border beam and floats above the others.
   Mobile: stacks vertically with Pro reordered to top via CSS `order`.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";

// ─── Pricing data ─────────────────────────────────────────────────────────────

interface PricingTier {
  tier: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
  ctaVariant: "outline" | "filled";
}

const TIERS: PricingTier[] = [
  {
    tier: "Free",
    price: "$0",
    description: "Full tools, small roster. Get started today.",
    features: [
      "Up to 3 athletes",
      "Session builder + validation",
      "Performance tracking",
      "Deficit Finder",
      "Practice tools",
    ],
    cta: "Start Free",
    href: "/register",
    ctaVariant: "outline",
  },
  {
    tier: "Pro",
    price: "$20",
    description: "The full toolkit for serious programs.",
    features: [
      "Up to 25 athletes",
      "Everything in Free",
      "Video analysis & annotation",
      "Programming & periodization",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    href: "/register",
    featured: true,
    ctaVariant: "filled",
  },
  {
    tier: "Elite",
    price: "$50",
    description: "Unlimited athletes. Full control.",
    features: [
      "Unlimited athletes",
      "Everything in Pro",
      "Event group management",
      "Custom questionnaires",
      "Dedicated support",
    ],
    cta: "Contact Us",
    href: "mailto:support@podiumthrows.com",
    ctaVariant: "outline",
  },
];

// ─── Feature list item ────────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12,
        color: "var(--landing-text-secondary)",
        padding: "6px 0",
        listStyle: "none",
        margin: 0,
      }}
    >
      {/* Amber dot */}
      <span
        aria-hidden="true"
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "#f59e0b",
          flexShrink: 0,
        }}
      />
      {text}
    </li>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────

function PricingCard({ tier }: { tier: PricingTier }) {
  const isMailto = tier.href.startsWith("mailto:");

  const ctaStyles: React.CSSProperties =
    tier.ctaVariant === "filled"
      ? {
          background: "#f59e0b",
          color: "#0a0a0a",
          border: "none",
        }
      : {
          background: "transparent",
          color: "#fff",
          border: "1px solid var(--landing-border)",
        };

  return (
    <div
      className={`pricing-card${tier.featured ? " pricing-card--featured" : ""}`}
      style={{
        background: "var(--landing-surface)",
        border: `1px solid ${tier.featured ? "#f59e0b" : "var(--landing-border)"}`,
        borderRadius: 16,
        padding: 32,
        position: "relative",
        overflow: "hidden",
        transform: tier.featured ? "translateY(-8px)" : "none",
        boxShadow: tier.featured
          ? "0 24px 64px rgba(0,0,0,0.35), 0 0 40px rgba(245,158,11,0.12)"
          : "none",
        transition: "0.4s cubic-bezier(0.16,1,0.3,1)",
        transitionProperty: "transform, box-shadow",
      }}
    >
      {/* Animated border beam — Pro only */}
      {tier.featured && (
        <>
          <div aria-hidden="true" className="border-beam" />
          {/* "Most Popular" tag */}
          <div
            className="font-heading"
            style={{
              position: "absolute",
              top: -11,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#f59e0b",
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 14px",
              borderRadius: 9999,
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            Most Popular
          </div>
        </>
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Tier label */}
        <div
          className="font-heading"
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--landing-text-muted)",
            marginBottom: 16,
          }}
        >
          {tier.tier}
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            className="font-heading"
            style={{
              fontWeight: 900,
              fontSize: 42,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {tier.price}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--landing-text-dim)",
            }}
          >
            /mo
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: "var(--landing-text-secondary)",
            lineHeight: 1.6,
            margin: "10px 0 20px",
          }}
        >
          {tier.description}
        </p>

        {/* Features list */}
        <ul style={{ padding: 0, margin: 0 }}>
          {tier.features.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
        </ul>

        {/* CTA button */}
        {isMailto ? (
          <a
            href={tier.href}
            className="font-heading"
            style={{
              ...ctaStyles,
              display: "block",
              width: "100%",
              marginTop: 20,
              padding: "12px 0",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              textDecoration: "none",
              boxSizing: "border-box",
              transition: "opacity 0.2s ease",
            }}
          >
            {tier.cta}
          </a>
        ) : (
          <Link
            href={tier.href}
            className="font-heading"
            style={{
              ...ctaStyles,
              display: "block",
              width: "100%",
              marginTop: 20,
              padding: "12px 0",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              textDecoration: "none",
              boxSizing: "border-box",
              transition: "opacity 0.2s ease",
            }}
          >
            {tier.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PricingPreview() {
  return (
    <section className="pricing-section" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <ScrollReveal>
        <div style={{ marginBottom: 56 }}>
          {/* Label */}
          <div
            className="flex items-center"
            style={{ gap: 12, marginBottom: 16 }}
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
              Pricing
            </span>
          </div>

          {/* Title */}
          <h2
            className="font-heading"
            style={{
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "var(--landing-text)",
              margin: 0,
              marginBottom: 12,
            }}
          >
            Start free. Scale when your roster does.
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 16,
              color: "var(--landing-text-secondary)",
              lineHeight: 1.7,
              maxWidth: 480,
              margin: 0,
            }}
          >
            Every plan includes session validation, performance tracking, and
            practice tools.
          </p>
        </div>
      </ScrollReveal>

      {/* ── Pricing cards grid ───────────────────────────────────────────── */}
      <div className="pricing-grid">
        {TIERS.map((tier, i) => (
          <ScrollReveal key={tier.tier} delay={i * 0.06}>
            <div className={tier.featured ? "pricing-pro-wrapper" : ""}>
              <PricingCard tier={tier} />
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* ── Scoped styles ────────────────────────────────────────────────── */}
      <style>{`
        .pricing-section {
          padding: 64px 16px;
        }

        @media (min-width: 640px) {
          .pricing-section {
            padding: 80px 40px;
          }
        }

        @media (min-width: 1024px) {
          .pricing-section {
            padding: 120px 64px;
          }
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
        }

        @media (min-width: 768px) {
          .pricing-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* Mobile: Pro appears first */
        @media (max-width: 767px) {
          .pricing-pro-wrapper {
            order: -1;
          }
        }

        /* Hover lift */
        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.35);
        }

        .pricing-card--featured:hover {
          transform: translateY(-12px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 48px rgba(245,158,11,0.18);
        }

        /* Animated spinning border beam */
        @keyframes border-spin {
          to { transform: rotate(360deg); }
        }

        .border-beam {
          position: absolute;
          inset: -1px;
          border-radius: 17px;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            #f59e0b 60deg,
            transparent 120deg
          );
          z-index: 0;
          animation: border-spin 4s linear infinite;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 1px;
        }

        @media (prefers-reduced-motion: reduce) {
          .border-beam {
            animation: none;
          }
          .pricing-card,
          .pricing-card--featured {
            transition: none;
          }
          .pricing-card:hover,
          .pricing-card--featured:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
