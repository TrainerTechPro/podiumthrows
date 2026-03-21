"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   TrustMarquee
   ────────────
   CSS-only infinite scroll strip showing events and concepts the platform
   covers. Sits between the Hero and the Sticky Features section.
   ═══════════════════════════════════════════════════════════════════════════ */

const ITEMS = [
  "Shot Put",
  "Discus",
  "Hammer Throw",
  "Javelin",
  "Bondarchuk Methodology",
  "D1 Programs",
  "Session Validation",
  "Video Analysis",
];

function Dot() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 3,
        height: 3,
        borderRadius: "50%",
        backgroundColor: "var(--color-primary-600, #d97706)",
        flexShrink: 0,
      }}
    />
  );
}

function MarqueeRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 40,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {ITEMS.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 40,
            fontFamily: "var(--font-heading, Outfit, sans-serif)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "var(--landing-text-dim)",
          }}
        >
          {item}
          <Dot />
        </span>
      ))}
    </div>
  );
}

export default function TrustMarquee() {
  return (
    <>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .trust-marquee-track {
          animation: marquee-scroll 35s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .trust-marquee-track {
            animation-play-state: paused;
          }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: "1px solid var(--landing-border)",
          borderBottom: "1px solid var(--landing-border)",
          paddingTop: 16,
          paddingBottom: 16,
          width: "100%",
        }}
      >
        {/* Left fade */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            right: "auto",
            width: 160,
            background:
              "linear-gradient(to right, var(--landing-bg), transparent)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Right fade */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            left: "auto",
            width: 160,
            background:
              "linear-gradient(to left, var(--landing-bg), transparent)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Scrolling track — two copies for seamless loop */}
        <div
          className="trust-marquee-track"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            width: "max-content",
          }}
        >
          <MarqueeRow />
          <MarqueeRow />
        </div>
      </div>
    </>
  );
}
