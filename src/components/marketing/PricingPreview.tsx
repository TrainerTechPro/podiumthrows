"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   PricingPreview
   ──────────────
   Three-tier pricing section: Free / Pro (featured, elevated) / Elite. Pro
   is anchored with brand-amber border, CornerMarks, a "Most Popular" pill,
   and an amber glow shadow; it sits 8px above the other two cards at rest.
   Mobile: stacks vertically with Pro reordered to top via CSS `order`.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";
import MonoLabel from "./MonoLabel";
import CornerMark from "./CornerMark";

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
    cta: "Get Pro",
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
        gap: 10,
        fontSize: 13,
        color: "var(--landing-text-secondary)",
        padding: "6px 0",
        listStyle: "none",
        margin: 0,
        lineHeight: 1.45,
      }}
    >
      {/* Neutral dot — amber is reserved for primary CTAs and the one stat */}
      <span
        aria-hidden="true"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--landing-text-muted)",
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
          background: "#FFC800",
          color: "#0a0a0a",
          border: "none",
        }
      : {
          background: "transparent",
          color: "var(--landing-text)",
          border: "1px solid var(--landing-border)",
        };

  return (
    <div
      className={`pricing-card${tier.featured ? " pricing-card--featured" : ""}`}
      style={{
        background: "var(--landing-surface)",
        border: `1px solid ${tier.featured ? "#FFC800" : "var(--landing-border)"}`,
        borderRadius: 16,
        padding: 32,
        position: "relative",
        overflow: "hidden",
        transform: tier.featured ? "translateY(-8px)" : "none",
        boxShadow: tier.featured
          ? "var(--landing-neo-raised), 0 24px 64px rgba(0,0,0,0.35)"
          : "var(--landing-neo-raised)",
        transition: "0.4s cubic-bezier(0.16,1,0.3,1)",
        transitionProperty: "transform, box-shadow",
      }}
    >
      {/* Corner marks + tag — Pro only */}
      {tier.featured && (
        <>
          <CornerMark position="top-right" />
          <CornerMark position="bottom-left" />
          {/* "Most Popular" tag */}
          <div
            className="font-heading"
            style={{
              position: "absolute",
              top: -11,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#FFC800",
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
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
        {/* Tier label — mono engineering register */}
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase" as const,
            letterSpacing: "0.22em",
            color: "var(--landing-text-muted)",
            fontWeight: 600,
            marginBottom: 18,
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
              fontSize: tier.featured ? 52 : 44,
              color: "var(--landing-text)",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
            }}
          >
            {tier.price}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--landing-text-dim)",
              letterSpacing: "0.04em",
            }}
          >
            /mo
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: "var(--landing-text-secondary)",
            lineHeight: 1.6,
            margin: "12px 0 22px",
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
            className="font-heading pricing-cta"
            style={{
              ...ctaStyles,
              display: "block",
              width: "100%",
              marginTop: 24,
              padding: "14px 0",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.02em",
              borderRadius: 8,
              textDecoration: "none",
              boxSizing: "border-box",
              transition: "filter 0.2s ease, border-color 0.2s ease, color 0.2s ease",
            }}
          >
            {tier.cta}
          </a>
        ) : (
          <Link
            href={tier.href}
            className="font-heading pricing-cta"
            style={{
              ...ctaStyles,
              display: "block",
              width: "100%",
              marginTop: 24,
              padding: "14px 0",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.02em",
              borderRadius: 8,
              textDecoration: "none",
              boxSizing: "border-box",
              transition: "filter 0.2s ease, border-color 0.2s ease, color 0.2s ease",
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
    <section className="pricing-section" style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <ScrollReveal>
        <div style={{ marginBottom: 64, maxWidth: 720 }}>
          <MonoLabel>Pricing</MonoLabel>

          {/* Title */}
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
              marginBottom: 16,
            }}
          >
            Start free. Scale when your roster does.
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 16,
              color: "var(--landing-text-secondary)",
              lineHeight: 1.65,
              maxWidth: 560,
              margin: 0,
            }}
          >
            Every plan includes session validation, performance tracking, and practice tools.
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

      {/* Class styles for .pricing-section / .pricing-grid / .pricing-card live
          in src/app/globals.css to avoid SSR/CSR hydration drift (React #425). */}
    </section>
  );
}
