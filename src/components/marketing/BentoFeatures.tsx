"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BentoFeatures
   ─────────────
   Asymmetric 12-column bento grid showcasing 7 feature cards.
   Each card has a cursor spotlight effect via CSS custom properties.
   Cards animate in with staggered ScrollReveal on viewport entry.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useRef, useCallback, useEffect, useState } from "react";
import {
  CirclePlus,
  Target,
  RefreshCw,
  PenLine,
  Grid3x3,
  Zap,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CardData {
  icon: LucideIcon;
  title: string;
  desc: string;
  span: string;
  featured?: boolean;
}

// ─── Card data ───────────────────────────────────────────────────────────────

const CARDS: CardData[] = [
  {
    icon: CirclePlus,
    title: "Athlete Profiles & Readiness",
    desc: "Full profiles with event history, implement preferences, and daily readiness check-ins. Know who's ready to throw heavy before they walk in.",
    span: "md:col-span-8",
    featured: true,
  },
  {
    icon: Target,
    title: "PR Tracking",
    desc: "Automatic detection with celebration. Track across all implements and competition weights.",
    span: "md:col-span-4",
  },
  {
    icon: RefreshCw,
    title: "Bondarchuk Codex",
    desc: "Exercise database classified by transfer type — CE, SDE, SPE, GPE.",
    span: "md:col-span-4",
  },
  {
    icon: PenLine,
    title: "Questionnaires",
    desc: "Custom check-in forms. Weekly reviews, meet prep, injury screening.",
    span: "md:col-span-4",
  },
  {
    icon: Grid3x3,
    title: "Event Groups",
    desc: "Manage shot put, discus, hammer, javelin as separate groups with shared programming.",
    span: "md:col-span-4",
  },
  {
    icon: Zap,
    title: "Practice Tools",
    desc: "Plate calculator, rest timer, RPE logger, voice recorder — tools you actually use during practice.",
    span: "md:col-span-5",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    desc: "Heavy-to-competition ratios, trend analysis, implement comparison. See who's transferring — before competition day.",
    span: "md:col-span-7",
  },
];

// ─── Readiness mini-mockup (featured card only) ───────────────────────────────

function ReadinessMockup() {
  const cells = [
    { label: "Readiness", value: "8.2", valueStyle: { color: "#10b981" } },
    { label: "Sleep", value: "7.5h", valueStyle: {} },
    { label: "Soreness", value: "3/10", valueStyle: { color: "#f59e0b" } },
    { label: "Stress", value: "Low", valueStyle: {} },
  ];

  return (
    <div
      style={{
        marginTop: 18,
        background: "var(--landing-bg)",
        border: "1px solid var(--landing-border)",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cells.map((cell) => (
          <div
            key={cell.label}
            style={{
              flex: "1 1 calc(50% - 4px)",
              minWidth: 0,
              background: "var(--landing-surface)",
              border: "1px solid var(--landing-border)",
              borderRadius: 5,
              padding: 7,
            }}
          >
            <div
              style={{
                fontSize: 8,
                color: "var(--landing-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 2,
              }}
            >
              {cell.label}
            </div>
            <div
              className="font-heading"
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: "var(--landing-text)",
                ...cell.valueStyle,
              }}
            >
              {cell.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Individual bento card ────────────────────────────────────────────────────

interface BentoCardProps {
  card: CardData;
  spotlightEnabled: boolean;
}

function BentoCard({ card, spotlightEnabled }: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const Icon = card.icon;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!spotlightEnabled) return;
      if (rafRef.current !== null) return; // already scheduled

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    },
    [spotlightEnabled]
  );

  // Cancel any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`bento-card ${card.span}`}
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        padding: 28,
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Spotlight pseudo-element — implemented via inline ::after simulation */}
      {spotlightEnabled && (
        <div
          aria-hidden="true"
          className="bento-spotlight"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            background: "radial-gradient(circle 250px at var(--mx, 50%) var(--my, 50%), var(--landing-amber-glow), transparent)",
            transition: "opacity 0.3s",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Content above spotlight */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "var(--landing-amber-glow-strong)",
            color: "#f59e0b",
            display: "grid",
            placeItems: "center",
            marginBottom: 18,
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>

        {/* Title */}
        <h3
          className="font-heading"
          style={{
            fontWeight: 700,
            fontSize: 17,
            color: "#fff",
            marginBottom: 6,
            lineHeight: 1.3,
          }}
        >
          {card.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: "var(--landing-text-secondary)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {card.desc}
        </p>

        {/* Featured mini-mockup */}
        {card.featured && <ReadinessMockup />}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BentoFeatures() {
  // Only enable spotlight on pointer-capable (non-touch) devices
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    setSpotlightEnabled(mq.matches);

    const handler = (e: MediaQueryListEvent) => setSpotlightEnabled(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <section className="bento-section" style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Section header ─────────────────────────────────────────────── */}
      <ScrollReveal>
        <div style={{ marginBottom: 48 }}>
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
              Everything Else
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
            Built for the ring, not the weight room.
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
            Every feature designed specifically for throws coaches. Not adapted
            from a gym app.
          </p>
        </div>
      </ScrollReveal>

      {/* ── Bento grid ─────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 md:grid-cols-12"
        style={{ gap: 12 }}
      >
        {CARDS.map((card, i) => (
          <ScrollReveal
            key={card.title}
            delay={i * 0.03}
            className={card.span}
          >
            <BentoCard card={card} spotlightEnabled={spotlightEnabled} />
          </ScrollReveal>
        ))}
      </div>

      {/* ── Spotlight hover styles ──────────────────────────────────────── */}
      <style>{`
        .bento-section {
          padding: 64px 16px;
        }

        @media (min-width: 640px) {
          .bento-section {
            padding: 80px 40px;
          }
        }

        @media (min-width: 1024px) {
          .bento-section {
            padding: 80px 64px;
          }
        }

        .bento-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.35);
          border-color: var(--landing-border-light);
        }
        .bento-card:hover .bento-spotlight {
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .bento-card:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
