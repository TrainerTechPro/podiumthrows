import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════════════
   SQUEEZE PAGE — podiumthrows.com
   ─────────────────────────────────
   One page. One goal: get throws coaches to the Deficit Finder.
   No pricing. No feature lists. No distractions.
   ═══════════════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "Find Your Thrower's Hidden Deficit — Podium Throws",
  description:
    "Free 60-second diagnostic reveals whether your thrower is losing distance to a strength deficit, technique gap, or implement mismatch. Built on Bondarchuk methodology.",
  openGraph: {
    title: "Find Your Thrower's Hidden Deficit — Podium Throws",
    description:
      "Free 60-second diagnostic reveals if your thrower is losing 2–4 meters to a hidden deficit. Takes 60 seconds. No signup required.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Podium Throws — Find Your Thrower's Hidden Deficit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find Your Thrower's Hidden Deficit — Podium Throws",
    description:
      "Free 60-second diagnostic. Find out if your thrower is losing 2–4 meters to a strength, technique, or implement deficit.",
  },
};

// ─── Throwing circle SVG (hero visual) ──────────────────────────────────────

function ThrowingCircle() {
  return (
    <svg
      viewBox="0 0 320 320"
      fill="none"
      className="w-full h-full"
      aria-hidden="true"
    >
      {/* Ambient glow behind circle */}
      <defs>
        <radialGradient id="circleGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="160" r="140" fill="url(#circleGlow)" />

      {/* Outer distance rings */}
      <circle cx="160" cy="160" r="152" stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.06" />
      <circle cx="160" cy="160" r="128" stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.1" />
      <circle cx="160" cy="160" r="102" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.15" />

      {/* Throwing circle */}
      <circle cx="160" cy="160" r="52" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.5" />

      {/* Stop board arc */}
      <path
        d="M 122 160 A 38 38 0 0 1 198 160"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeOpacity="0.8"
        strokeLinecap="round"
      />

      {/* Center mark */}
      <circle cx="160" cy="160" r="3" fill="#f59e0b" fillOpacity="0.85" />
      <circle cx="160" cy="160" r="8" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.35" />

      {/* Sector lines */}
      <line x1="160" y1="160" x2="280" y2="90" stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="5 3" />
      <line x1="160" y1="160" x2="280" y2="230" stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="5 3" />

      {/* Trajectory arc — the implement in flight */}
      <path
        d="M 160 125 Q 218 78 272 56"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeOpacity="0.45"
        strokeLinecap="round"
        strokeDasharray="5 3"
      />

      {/* Implement (shot) */}
      <circle cx="272" cy="56" r="6" fill="#f59e0b" fillOpacity="0.7" />
      <circle cx="272" cy="56" r="11" stroke="#f59e0b" strokeWidth="0.75" strokeOpacity="0.25" />

      {/* Gap indicator — the "hidden meters" visual */}
      <path
        d="M 272 56 Q 290 46 308 40"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
      <circle cx="308" cy="40" r="5" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />
    </svg>
  );
}

// ─── Benefit item ────────────────────────────────────────────────────────────

const BENEFITS = [
  "Whether the deficit is strength, technique, or implement-related",
  "A specific corrective recommendation for your next training block",
  "How your thrower's heavy-to-competition ratio compares to benchmarks",
  "Whether your current implement sequence is costing distance",
  "Instant results — no waiting, no fluff, no account required",
];
// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div
      className="font-body overflow-x-hidden min-h-screen flex flex-col"
      style={{ backgroundColor: "#0d0c09", color: "#f0ede6" }}
    >
      {/* ────────────────────────────────────────────────────────────────────
          FLOATING HEADER — logo + sign in
      ──────────────────────────────────────────────────────────────────── */}
      <header
        className="w-full sticky top-0 z-50"
        style={{
          backgroundColor: "rgba(13,12,9,0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(245,158,11,0.06)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Podium Throws home">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/logo.png"
                alt="Podium Throws"
                width={32}
                height={32}
                className="w-8 h-8"
              />
            </div>
            <span className="font-heading font-bold text-[15px] text-white tracking-tight">
              Podium Throws
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium transition-colors duration-200"
            style={{ color: "#6b655a" }}
          >
            Coach? Sign In <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────
          HERO — headline, subhead, single CTA
      ──────────────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex items-center relative" aria-label="Hero">
        {/* Ambient background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 30% 40%, rgba(245,158,11,0.04) 0%, transparent 70%), " +
              "radial-gradient(ellipse 40% 40% at 70% 60%, rgba(245,158,11,0.02) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto px-6 sm:px-8 w-full py-16 sm:py-20 lg:py-0 relative">
          <div className="grid lg:grid-cols-[1fr_300px] gap-12 xl:gap-20 items-center">

            {/* Left — copy */}
            <div>
              {/* Eyebrow */}
              <div
                className="animate-spring-up inline-flex items-center gap-2 text-xs font-heading uppercase tracking-[0.2em] mb-8 px-3.5 py-2 rounded-full"
                style={{
                  color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.2)",
                  backgroundColor: "rgba(245,158,11,0.06)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "#f59e0b" }}
                  aria-hidden="true"
                />
                Free 60-Second Diagnostic
              </div>

              {/* Headline */}
              <h1
                className="animate-spring-up animate-delay-100 font-heading font-bold leading-[0.92] tracking-tight mb-6"
                style={{
                  fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                Your thrower is
                <br />
                leaving{" "}
                <span
                  style={{
                    color: "#f59e0b",
                    textShadow: "0 0 40px rgba(245,158,11,0.3)",
                  }}
                >
                  2–4&nbsp;meters
                </span>
                <br />
                on the table.
              </h1>

              {/* Subhead */}
              <p
                className="animate-spring-up animate-delay-200 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg"
                style={{ color: "#8a8278" }}
              >
                Is it a strength deficit, a technique gap, or the wrong implement
                sequence? Find out in 60 seconds — with a specific fix.
              </p>

              {/* Primary CTA */}
              <div className="animate-spring-up animate-delay-300 flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link
                  href="/deficit-finder"
                  className="relative font-heading font-bold text-base px-8 py-4 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-glow-lg"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#0d0c09",
                    boxShadow: "0 0 24px rgba(245,158,11,0.2), 0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  Find Your Thrower&apos;s Deficit <span aria-hidden="true">→</span>
                </Link>
              </div>

              {/* Trust line */}
              <p
                className="animate-spring-up animate-delay-400 text-xs tracking-wide"
                style={{ color: "#5a554e" }}
              >
                No account needed · Free forever · Based on Bondarchuk research
              </p>
            </div>

            {/* Right — throwing circle visual (visible at all sizes, larger on desktop) */}
            <div className="flex items-center justify-center order-first lg:order-last">
              <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] lg:w-[280px] lg:h-[280px] xl:w-[300px] xl:h-[300px] animate-fade-in animate-delay-200">
                <div className="animate-float">
                  <ThrowingCircle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          BENEFITS — 5 sharp bullets
      ──────────────────────────────────────────────────────────────────── */}
      <section
        className="py-20 sm:py-24"
        style={{ borderTop: "1px solid #1a1814" }}
        aria-label="What you will learn"
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <p
            className="font-heading text-xs uppercase tracking-[0.2em] mb-10"
            style={{ color: "#6b655a" }}
          >
            What you&apos;ll learn
          </p>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
            {BENEFITS.map((bullet) => (
              <div
                key={bullet}
                className="group flex items-start gap-3.5 py-4 px-4 -mx-4 rounded-xl transition-colors duration-200 hover:bg-[rgba(245,158,11,0.03)]"
                style={{
                  borderBottom: "1px solid rgba(26,24,20,0.8)",
                }}
              >
                <span
                  className="mt-2 w-2 h-2 rounded-full flex-shrink-0 transition-shadow duration-200 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ backgroundColor: "#f59e0b" }}
                  aria-hidden="true"
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "#9e9589" }}>
                  {bullet}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          METHODOLOGY PROOF — credibility, not education
      ──────────────────────────────────────────────────────────────────── */}
      <section
        className="py-20 sm:py-24 relative overflow-hidden"
        style={{
          borderTop: "1px solid #1a1814",
          backgroundColor: "#0f0e0a",
        }}
        aria-label="Methodology"
      >
        {/* Subtle glow behind the number */}
        <div
          className="absolute top-1/2 left-0 -translate-y-1/2 w-[400px] h-[300px] pointer-events-none"
          aria-hidden="true"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto px-6 sm:px-8 relative">
          <div className="grid lg:grid-cols-[auto_1fr] gap-10 lg:gap-16 items-start">
            {/* The number — the hook */}
            <div
              className="font-heading font-bold leading-none select-none"
              style={{
                fontSize: "clamp(5rem, 14vw, 9rem)",
                color: "#f59e0b",
                letterSpacing: "-0.04em",
                lineHeight: 0.85,
                textShadow: "0 0 60px rgba(245,158,11,0.25), 0 0 120px rgba(245,158,11,0.1)",
              }}
            >
              2–4m
            </div>

            {/* The context */}
            <div className="max-w-md">
              <p
                className="text-lg leading-relaxed mb-4"
                style={{ color: "#9e9589" }}
              >
                The distance every natural athlete loses when implements are
                sequenced light → heavy.
              </p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#6b655a" }}>
                Documented in Bondarchuk&apos;s Transfer of Training, Volume IV,
                pages 114–117. 100% of natural athletes in the study were affected.
                This diagnostic checks whether your programming has this problem.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {["Shot Put", "Discus", "Hammer", "Javelin"].map((event) => (
                  <span
                    key={event}
                    className="font-heading text-xs uppercase tracking-[0.15em] px-3 py-1.5 rounded-full"
                    style={{
                      color: "#5a554e",
                      border: "1px solid #1a1814",
                      backgroundColor: "rgba(245,158,11,0.02)",
                    }}
                  >
                    {event}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          SECOND CTA — urgency close
      ──────────────────────────────────────────────────────────────────── */}
      <section
        className="py-24 sm:py-32 relative"
        style={{ borderTop: "1px solid #1a1814" }}
        aria-label="Call to action"
      >
        {/* Centered amber glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(245,158,11,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto px-6 sm:px-8 text-center relative">
          <p
            className="text-lg sm:text-xl leading-relaxed mb-10 max-w-lg mx-auto"
            style={{ color: "#8a8278" }}
          >
            Every session with the wrong sequence is another day losing distance.
            Find out where the gap is.
          </p>

          <Link
            href="/deficit-finder"
            className="inline-block font-heading font-bold text-base px-10 py-4 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-glow-lg mb-5"
            style={{
              backgroundColor: "#f59e0b",
              color: "#0d0c09",
              boxShadow: "0 0 24px rgba(245,158,11,0.2), 0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            Run the Free Diagnostic <span aria-hidden="true">→</span>
          </Link>

          <p className="text-xs tracking-wide" style={{ color: "#5a554e" }}>
            60 seconds. No signup. Built on published research.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          MINIMAL FOOTER
      ──────────────────────────────────────────────────────────────────── */}
      <footer
        className="py-8"
        style={{ borderTop: "1px solid #1a1814" }}
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "#3a3530" }}>
            © {new Date().getFullYear()} Podium Throws
          </p>
          <div className="flex items-center gap-5">
            {[
              { href: "/login", label: "Sign In" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs transition-colors duration-200 hover:text-white"
                style={{ color: "#5a554e" }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
