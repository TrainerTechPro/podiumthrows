import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HeroMask from "@/components/marketing/hero-mask";

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="font-body min-h-screen flex flex-col bg-[#08080a] text-[#e8e4dc] selection:bg-primary-500/30 selection:text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="w-full relative z-10">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Podium Throws home">
            <Image
              src="/logo.png"
              alt="Podium Throws"
              width={28}
              height={28}
              className="w-7 h-7 opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <span className="font-heading font-semibold text-[15px] text-[#e8e4dc]/80 tracking-tight group-hover:text-[#e8e4dc] transition-colors">
              Podium Throws
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#555048] hover:text-[#e8e4dc] transition-colors duration-300"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex items-center relative" aria-label="Hero">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full py-20 sm:py-28 lg:py-36">

          {/* Interactive athlete silhouette — hover to reveal discus thrower */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block"
            style={{ width: "clamp(22rem, 36vw, 32rem)", height: "clamp(28rem, 45vw, 40rem)" }}
          >
            <HeroMask />
          </div>

          <div className="relative max-w-3xl">
            {/* Label */}
            <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-primary-500 mb-10 sm:mb-14">
              Free diagnostic
            </p>

            {/* Headline */}
            <h1
              className="font-heading font-black leading-[0.88] tracking-[-0.035em] mb-8"
              style={{ fontSize: "clamp(2.8rem, 8vw, 5.5rem)" }}
            >
              Your thrower is leaving
              <br />
              <span className="text-primary-500">2–4&nbsp;meters</span>
              <br />
              on the table.
            </h1>

            {/* Divider */}
            <div className="w-16 h-[2px] bg-primary-500/40 mb-8" aria-hidden="true" />

            {/* Subhead */}
            <p className="text-[17px] sm:text-lg leading-[1.7] text-[#7a746b] max-w-md mb-14">
              Strength deficit, technique gap, or wrong implement sequence?
              Find out in 60 seconds — with a corrective recommendation.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Link
                href="/deficit-finder"
                className="group relative font-heading font-bold text-[15px] px-10 py-4 bg-primary-500 text-[#08080a] transition-all duration-300 hover:bg-primary-400 active:scale-[0.97]"
              >
                <span className="relative z-10">Find the Deficit</span>
              </Link>
              <span className="text-[12px] text-[#444039] leading-relaxed self-center">
                No account needed<br className="sm:hidden" />
                <span className="hidden sm:inline">&ensp;/&ensp;</span>
                Based on Bondarchuk research
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you learn ─────────────────────────────────────────────────── */}
      <section aria-label="What you learn">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          {/* Top rule */}
          <div className="h-px bg-[#1a1816]" aria-hidden="true" />

          <div className="py-24 sm:py-32 grid lg:grid-cols-[240px_1fr] gap-12 lg:gap-20">
            {/* Section label */}
            <div>
              <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-[#555048] lg:sticky lg:top-32">
                What you&apos;ll learn
              </p>
            </div>

            {/* Items */}
            <div>
              {[
                ["01", "Whether the deficit is strength, technique, or implement-related"],
                ["02", "A specific corrective recommendation for your next training block"],
                ["03", "How your heavy-to-competition ratio compares to benchmarks"],
                ["04", "Whether your current implement sequence is costing distance"],
                ["05", "Instant results — no waiting, no account required"],
              ].map(([num, text]) => (
                <div
                  key={num}
                  className="group flex items-baseline gap-6 py-6 border-b border-[#1a1816] last:border-0"
                >
                  <span className="font-heading text-[12px] tabular-nums text-[#353129] group-hover:text-primary-500/60 transition-colors duration-300 flex-shrink-0">
                    {num}
                  </span>
                  <p className="text-[15px] leading-relaxed text-[#8a8278] group-hover:text-[#b5afa5] transition-colors duration-300">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Methodology proof ──────────────────────────────────────────────── */}
      <section aria-label="Methodology" className="relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <div className="h-px bg-[#1a1816]" aria-hidden="true" />
        </div>

        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-16 lg:gap-24 items-end">
            {/* Stat */}
            <div>
              <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-[#555048] mb-8">
                The research
              </p>
              <div
                className="font-heading font-black leading-none text-primary-500 select-none"
                style={{
                  fontSize: "clamp(6rem, 18vw, 12rem)",
                  letterSpacing: "-0.05em",
                  lineHeight: 0.8,
                }}
              >
                2–4m
              </div>
            </div>

            {/* Context */}
            <div className="max-w-sm lg:pb-2">
              <p className="text-[15px] leading-[1.8] text-[#8a8278] mb-5">
                The distance every natural athlete loses when implements are
                sequenced light to heavy. Documented across all four throwing events.
              </p>
              <p className="text-[13px] leading-[1.8] text-[#555048] mb-8">
                Bondarchuk, Transfer of Training, Vol.&nbsp;IV, pp.&nbsp;114–117.
                100% of natural athletes in the study were affected.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {["Shot Put", "Discus", "Hammer", "Javelin"].map((event) => (
                  <span
                    key={event}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-[#444039] border border-[#1e1c18] px-3 py-1.5"
                  >
                    {event}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section aria-label="Call to action">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <div className="h-px bg-[#1a1816]" aria-hidden="true" />
        </div>

        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-28 sm:py-36">
          <div className="max-w-xl">
            <p className="text-lg sm:text-xl leading-[1.6] text-[#7a746b] mb-12">
              Every session with the wrong sequence is another day
              leaving distance on the table.
            </p>
            <Link
              href="/deficit-finder"
              className="inline-block font-heading font-bold text-[15px] px-10 py-4 bg-primary-500 text-[#08080a] transition-all duration-300 hover:bg-primary-400 active:scale-[0.97] mb-5"
            >
              Run the Free Diagnostic
            </Link>
            <p className="text-[12px] text-[#444039]">
              60 seconds. No signup. Built on published research.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10">
          <div className="h-px bg-[#1a1816]" aria-hidden="true" />
        </div>
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#2a2620]">
            &copy; {new Date().getFullYear()} Podium Throws
          </p>
          <div className="flex items-center gap-6">
            {[
              { href: "/login", label: "Sign In" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[11px] text-[#444039] hover:text-[#8a8278] transition-colors duration-300"
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
