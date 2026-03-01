import type { Metadata } from "next";
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

// ─── Throwing circle SVG (compact hero visual) ───────────────────────────────

function ThrowingCircle() {
  return (
    <svg
      viewBox="0 0 320 320"
      fill="none"
      className="w-full h-full"
      aria-hidden="true"
    >
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

// ─── Inline logo ─────────────────────────────────────────────────────────────

function Logo() {
  return (
    <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7" aria-hidden="true">
      <circle cx="18" cy="18" r="16" stroke="#f59e0b" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="18" cy="18" r="4.5" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="1.75" fill="#f59e0b" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div
      className="font-body overflow-x-hidden min-h-screen flex flex-col"
      style={{ backgroundColor: "#0d0c09", color: "#f0ede6" }}
    >
      {/* ────────────────────────────────────────────────────────────────────
          MINIMAL HEADER — logo + sign in only
      ──────────────────────────────────────────────────────────────────── */}
      <header className="w-full">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group" aria-label="Podium Throws home">
            <Logo />
            <span className="font-heading font-bold text-[15px] text-white tracking-tight">
              Podium Throws
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm transition-colors hover:text-white"
            style={{ color: "#5a554e" }}
          >
            Coach? Sign In →
          </Link>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────
          HERO — headline, subhead, single CTA
      ──────────────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex items-center" aria-label="Hero">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 w-full py-16 sm:py-20 lg:py-0">
          <div className="grid lg:grid-cols-[1fr_300px] gap-12 xl:gap-20 items-center">

            {/* Left — copy */}
            <div>
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2 text-xs font-heading uppercase tracking-[0.2em] mb-8 px-3 py-1.5"
                style={{
                  color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.2)",
                  backgroundColor: "rgba(245,158,11,0.04)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#f59e0b" }}
                  aria-hidden="true"
                />
                Free 60-Second Diagnostic
              </div>

              {/* Headline */}
              <h1
                className="font-heading font-bold leading-[0.92] tracking-tight mb-6"
                style={{
                  fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                Your thrower is
                <br />
                leaving{" "}
                <span style={{ color: "#f59e0b" }}>2–4 meters</span>
                <br />
                on the table.
              </h1>

              {/* Subhead */}
              <p
                className="text-lg sm:text-xl leading-relaxed mb-10 max-w-lg"
                style={{ color: "#8a8278" }}
              >
                Is it a strength deficit, a technique gap, or the wrong implement
                sequence? Find out in 60 seconds — with a specific fix.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link
                  href="/deficit-finder"
                  className="font-heading font-bold text-base px-8 py-4 transition-all hover:brightness-110"
                  style={{ backgroundColor: "#f59e0b", color: "#0d0c09" }}
                >
                  Find Your Thrower&apos;s Deficit →
                </Link>
              </div>

              {/* Trust line */}
              <p className="text-xs" style={{ color: "#3a3530" }}>
                No account needed · Free forever · Based on Bondarchuk research
              </p>
            </div>

            {/* Right — throwing circle visual */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-[280px] h-[280px] xl:w-[300px] xl:h-[300px]">
                <ThrowingCircle />
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
            style={{ color: "#5a554e" }}
          >
            What you&apos;ll learn
          </p>

          <div className="grid sm:grid-cols-2 gap-x-16 gap-y-6">
            {[
              "Whether the deficit is strength, technique, or implement-related",
              "A specific corrective recommendation for your next training block",
              "How your thrower's heavy-to-competition ratio compares to benchmarks",
              "Whether your current implement sequence is costing distance",
              "Instant results — no waiting, no fluff, no account required",
            ].map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-3 py-3"
                style={{ borderBottom: "1px solid #1a1814" }}
              >
                <span
                  className="mt-1.5 w-2 h-2 flex-shrink-0"
                  style={{ backgroundColor: "#f59e0b" }}
                  aria-hidden="true"
                />
                <p className="text-[15px] leading-relaxed" style={{ color: "#8a8278" }}>
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
        className="py-20 sm:py-24"
        style={{
          borderTop: "1px solid #1a1814",
          backgroundColor: "#0f0e0a",
        }}
        aria-label="Methodology"
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-[auto_1fr] gap-10 lg:gap-16 items-start">
            {/* The number — the hook */}
            <div
              className="font-heading font-bold leading-none"
              style={{
                fontSize: "clamp(5rem, 14vw, 9rem)",
                color: "#f59e0b",
                letterSpacing: "-0.04em",
                lineHeight: 0.85,
                opacity: 0.9,
              }}
            >
              2–4m
            </div>

            {/* The context */}
            <div className="max-w-md">
              <p
                className="text-lg leading-relaxed mb-4"
                style={{ color: "#8a8278" }}
              >
                The distance every natural athlete loses when implements are
                sequenced light → heavy.
              </p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#5a554e" }}>
                Documented in Bondarchuk&apos;s Transfer of Training, Volume IV,
                pages 114–117. 100% of natural athletes in the study were affected.
                This diagnostic checks whether your programming has this problem.
              </p>
              <p
                className="font-heading text-xs uppercase tracking-[0.18em]"
                style={{ color: "#3a3530" }}
              >
                Shot Put · Discus · Hammer · Javelin
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          SECOND CTA — urgency close
      ──────────────────────────────────────────────────────────────────── */}
      <section
        className="py-24 sm:py-32"
        style={{ borderTop: "1px solid #1a1814" }}
        aria-label="Call to action"
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8 text-center">
          <p
            className="text-lg sm:text-xl leading-relaxed mb-8 max-w-lg mx-auto"
            style={{ color: "#6b655a" }}
          >
            Every session with the wrong sequence is another day losing distance.
            Find out where the gap is.
          </p>

          <Link
            href="/deficit-finder"
            className="inline-block font-heading font-bold text-base px-10 py-4 transition-all hover:brightness-110 mb-4"
            style={{ backgroundColor: "#f59e0b", color: "#0d0c09" }}
          >
            Run the Free Diagnostic →
          </Link>

          <p className="text-xs" style={{ color: "#2a2520" }}>
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
          <p className="text-xs" style={{ color: "#2a2520" }}>
            © {new Date().getFullYear()} Podium Throws
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs transition-colors hover:text-white"
              style={{ color: "#3a3530" }}
            >
              Sign In
            </Link>
            <Link
              href="/privacy"
              className="text-xs transition-colors hover:text-white"
              style={{ color: "#3a3530" }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs transition-colors hover:text-white"
              style={{ color: "#3a3530" }}
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
