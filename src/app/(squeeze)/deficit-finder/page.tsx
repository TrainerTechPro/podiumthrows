import type { Metadata } from "next";
import { DeficitFinderClient } from "./_deficit-finder-client";

export const metadata: Metadata = {
  title: "Free Deficit Finder for Throws Coaches — Podium Throws",
  description:
    "Find your thrower's #1 limiting factor in 2 minutes. Enter 3 numbers, get a Bondarchuk-based deficit analysis with specific training adjustments.",
  openGraph: {
    title: "Find Your Thrower's #1 Limiting Factor in 2 Minutes",
    description:
      "Enter your athlete's competition PR, heavy implement mark, and best squat. Get a Bondarchuk-based deficit analysis with specific training adjustments.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DeficitFinderPage() {
  return (
    <main
      className="min-h-screen font-body"
      style={{ backgroundColor: "#0d0c09" }}
    >
      {/* Minimal logo header */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-center"
        style={{ backgroundColor: "rgba(13,12,9,0.9)", backdropFilter: "blur(12px)" }}
      >
        <a href="/" className="flex items-center gap-2.5 group" aria-label="Podium Throws home">
          <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
            <circle cx="18" cy="18" r="16" stroke="#f59e0b" strokeWidth="1.75" />
            <circle cx="18" cy="18" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2.5" />
            <circle cx="18" cy="18" r="4.5" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="18" cy="18" r="1.75" fill="#f59e0b" />
          </svg>
          <span
            className="font-heading font-bold text-sm tracking-wide"
            style={{ color: "#f0ede6" }}
          >
            Podium Throws
          </span>
        </a>
      </header>

      {/* Warm radial glow behind hero */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Hero + Form */}
      <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <p
            className="font-heading text-xs uppercase tracking-[0.22em] mb-5"
            style={{ color: "rgba(245,158,11,0.8)" }}
          >
            Free Diagnostic Tool
          </p>

          {/* Headline */}
          <h1
            className="font-heading font-bold leading-[1.08] mb-5"
            style={{
              fontSize: "clamp(2.2rem, 6vw, 3.8rem)",
              letterSpacing: "-0.03em",
              color: "#f0ede6",
            }}
          >
            Find Your Thrower&rsquo;s #1{" "}
            <span style={{ color: "#f59e0b" }}>Limiting Factor</span>{" "}
            in 2 Minutes
          </h1>

          {/* Subhead */}
          <p
            className="font-body text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10"
            style={{ color: "#8a8278" }}
          >
            Enter your athlete&rsquo;s competition PR, heavy implement mark, and best squat.
            Get a Bondarchuk-based deficit analysis with specific training adjustments.
          </p>

          {/* Benefit bullets */}
          <ul className="text-left max-w-md mx-auto space-y-3 mb-10">
            {[
              "Identify the exact deficit type — heavy implement, light implement, strength, or balanced",
              "Get a specific training recommendation you can apply tomorrow",
              "Based on Bondarchuk KPI standards calibrated to your athlete's distance band",
              "Detect \"overpowered\" athletes whose strength exceeds their technique",
              "Takes less than 2 minutes — you already know these numbers",
            ].map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 mt-0.5 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <circle cx="10" cy="10" r="10" fill="rgba(245,158,11,0.15)" />
                  <path
                    d="M6 10.5l2.5 2.5L14 7.5"
                    stroke="#f59e0b"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="font-body text-sm leading-snug"
                  style={{ color: "#a09a90" }}
                >
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The interactive client form */}
        <DeficitFinderClient />

        {/* Micro-proof */}
        <p
          className="text-center mt-10 font-body text-xs"
          style={{ color: "#6b655a" }}
        >
          Built on the methodology behind 80+ Olympic medals in throwing events.
        </p>
      </section>

      {/* Minimal footer */}
      <footer
        className="py-6 px-6 text-center"
        style={{ borderTop: "1px solid #1a1714" }}
      >
        <p className="font-body text-xs" style={{ color: "#5a554e" }}>
          &copy; {new Date().getFullYear()} Podium Throws. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
