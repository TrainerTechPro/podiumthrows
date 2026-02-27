import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/marketing/Nav";
import MarketingFooter from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Podium Throws — Elite Track & Field Coaching Platform",
  description:
    "The coaching platform built for throws. Manage shot put, discus, hammer, and javelin athletes with Bondarchuk methodology built in. Trusted by D1 and professional coaches.",
  openGraph: {
    title: "Podium Throws — Elite Track & Field Coaching Platform",
    description:
      "The coaching platform built for throws. Manage shot put, discus, hammer, and javelin athletes with Bondarchuk methodology built in.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Podium Throws — Elite Track & Field Coaching Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Podium Throws — Elite Track & Field Coaching Platform",
    description:
      "The coaching platform built for throws. Bondarchuk methodology built in.",
  },
};

// ─── Throwing circle SVG (hero) ──────────────────────────────────────────────

function ThrowingCircleHero() {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className="w-full h-full"
      aria-hidden="true"
    >
      {/* Outer rings — landing sector marks */}
      <circle cx="200" cy="200" r="190" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.06" />
      <circle cx="200" cy="200" r="165" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.09" />
      <circle cx="200" cy="200" r="138" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.13" />
      <circle cx="200" cy="200" r="110" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.18" />
      <circle cx="200" cy="200" r="82" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.28" />
      {/* Throwing circle */}
      <circle cx="200" cy="200" r="58" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.6" />
      {/* Inner stop board */}
      <path d="M 158 200 A 42 42 0 0 1 242 200" stroke="#f59e0b" strokeWidth="3" strokeOpacity="0.85" strokeLinecap="round" />
      {/* Center mark */}
      <circle cx="200" cy="200" r="4" fill="#f59e0b" fillOpacity="0.9" />
      <circle cx="200" cy="200" r="10" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.4" />
      {/* Sector lines ~45° */}
      <line x1="200" y1="200" x2="334" y2="122" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.22" strokeDasharray="6 4" />
      <line x1="200" y1="200" x2="334" y2="278" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.22" strokeDasharray="6 4" />
      {/* Sector arc */}
      <path d="M 334 122 A 154 154 0 0 1 334 278" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.15" />
      {/* Implement trajectory */}
      <path d="M 200 162 Q 262 110 328 82" stroke="#f59e0b" strokeWidth="1.75" strokeOpacity="0.5" strokeLinecap="round" strokeDasharray="6 4" />
      {/* Implement */}
      <circle cx="328" cy="82" r="7" fill="#f59e0b" fillOpacity="0.75" />
      <circle cx="328" cy="82" r="13" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="font-body overflow-x-hidden" style={{ backgroundColor: "#0d0c09", color: "#f0ede6" }}>
      <MarketingNav />

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex flex-col justify-center pt-[66px]"
        aria-label="Hero"
      >
        {/* Thin amber horizon line */}
        <div className="absolute top-[66px] left-0 right-0 h-px" style={{ backgroundColor: "rgba(245,158,11,0.25)" }} />

        {/* Warm radial glow — subtle */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "30%",
            left: "-10%",
            width: "60vw",
            height: "60vw",
            background: "radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full py-24 lg:py-0 lg:min-h-screen lg:flex lg:items-center">
          <div className="grid lg:grid-cols-[1fr_420px] gap-16 xl:gap-24 items-center w-full">

            {/* Left — text */}
            <div>
              {/* Eyebrow */}
              <p
                className="font-heading text-xs uppercase tracking-[0.22em] mb-10"
                style={{ color: "rgba(245,158,11,0.8)" }}
              >
                Built on Bondarchuk Transfer of Training
              </p>

              {/* Headline */}
              <h1
                className="font-heading font-bold leading-[0.9] tracking-tight mb-8"
                style={{
                  fontSize: "clamp(3.5rem, 9.5vw, 8.5rem)",
                  color: "#f0ede6",
                  letterSpacing: "-0.03em",
                }}
              >
                Built for
                <br />
                <span style={{ color: "#f59e0b" }}>the circle.</span>
              </h1>

              {/* Sub */}
              <p
                className="text-xl leading-relaxed mb-12 max-w-xl"
                style={{ color: "#8a8278" }}
              >
                The first coaching platform built exclusively for throws athletes.
                Shot put, discus, hammer, javelin — with Bondarchuk methodology
                enforced at every step.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-5 mb-16">
                <Link
                  href="/register"
                  className="font-heading font-bold text-base px-8 py-4 hover:bg-primary-400 transition-colors"
                  style={{ backgroundColor: "#f59e0b", color: "#0d0c09" }}
                >
                  Start Free Trial
                </Link>
                <Link
                  href="/#features"
                  className="font-body text-base transition-colors hover:text-white flex items-center gap-2"
                  style={{ color: "#8a8278" }}
                >
                  Explore features
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {/* Stats */}
              <div
                className="flex flex-wrap gap-10 pt-8"
                style={{ borderTop: "1px solid #2a2720" }}
              >
                {[
                  { value: "500+", label: "Coaches" },
                  { value: "10,000+", label: "Athletes tracked" },
                  { value: "50+", label: "D1 programs" },
                  { value: "4", label: "Throwing events" },
                ].map((s) => (
                  <div key={s.label}>
                    <div
                      className="font-heading font-bold text-2xl"
                      style={{ color: "#f59e0b" }}
                    >
                      {s.value}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: "#5a554e" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — throwing circle diagram */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-[380px] h-[380px] xl:w-[420px] xl:h-[420px]">
                <ThrowingCircleHero />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          THE RULE — Bondarchuk methodology
      ══════════════════════════════════════════════════════════ */}
      <section
        id="methodology"
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#f8f6f2", color: "#1a1714" }}
        aria-label="Bondarchuk methodology"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          {/* Section label */}
          <p
            className="font-heading text-xs uppercase tracking-[0.22em] mb-20"
            style={{ color: "#9a9288" }}
          >
            The methodology
          </p>

          <div className="grid lg:grid-cols-2 gap-16 xl:gap-28 items-start">

            {/* Left — the number */}
            <div>
              <div
                className="font-heading font-bold leading-none mb-5"
                style={{
                  fontSize: "clamp(7rem, 18vw, 14rem)",
                  color: "#f59e0b",
                  letterSpacing: "-0.04em",
                  lineHeight: 0.85,
                }}
              >
                2–4m
              </div>
              <p className="text-lg leading-relaxed max-w-sm" style={{ color: "#9a9288" }}>
                The performance loss every natural athlete suffers when implements
                are sequenced light → heavy.
                <br /><br />
                <span style={{ color: "#1a1714", fontWeight: 500 }}>
                  This isn&apos;t a coaching opinion.
                </span>{" "}
                It&apos;s documented in Volume&nbsp;IV of Bondarchuk&apos;s research,
                pages 114–117.
              </p>
            </div>

            {/* Right — explanation */}
            <div className="space-y-10">
              <div>
                <h2
                  className="font-heading font-bold leading-tight mb-5"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.025em" }}
                >
                  Heavy first.
                  <br />
                  Always.
                </h2>
                <p className="text-lg leading-relaxed" style={{ color: "#7a7268" }}>
                  Every session must begin with the heaviest implement and descend
                  from there. Podium Throws is the only platform that validates this
                  automatically — flagging incorrect sequences before they reach your
                  athletes.
                </p>
              </div>

              {/* Sequence diagram */}
              <div
                className="p-6"
                style={{ border: "1px solid #e0dbd4", backgroundColor: "#fff" }}
              >
                <p
                  className="font-heading text-xs uppercase tracking-[0.18em] mb-5"
                  style={{ color: "#9a9288" }}
                >
                  Correct implement sequence
                </p>
                <div className="flex items-start gap-4 flex-wrap">
                  {[
                    { weight: "9 kg", label: "Overweight", dim: false },
                    { weight: "8 kg", label: "Training", dim: false },
                    { weight: "7.26 kg", label: "Competition", dim: false },
                  ].map((item, i, arr) => (
                    <div key={item.weight} className="flex items-start gap-4">
                      <div className="text-center">
                        <div
                          className="font-heading font-bold text-sm px-5 py-2.5 mb-1.5"
                          style={{
                            backgroundColor: "#f59e0b",
                            color: "#0d0c09",
                            opacity: i === 0 ? 1 : i === 1 ? 0.75 : 0.5,
                          }}
                        >
                          {item.weight}
                        </div>
                        <span
                          className="text-xs font-heading uppercase tracking-widest"
                          style={{ color: "#9a9288" }}
                        >
                          {item.label}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <span
                          className="text-xl mt-2"
                          style={{ color: "#c0bab4" }}
                          aria-hidden="true"
                        >
                          →
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="mt-5 flex items-start gap-2 text-xs px-3 py-2.5"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.18)",
                    color: "#c53030",
                  }}
                >
                  <span className="font-bold mt-0.5 flex-shrink-0">✗</span>
                  <span>
                    Reversing this order costs 2–4 meters. Podium flags it before
                    you ever assign it to an athlete.
                  </span>
                </div>
              </div>

              {/* Research stats row */}
              <div
                className="grid grid-cols-3 gap-0"
                style={{ borderTop: "1px solid #e0dbd4", paddingTop: "1.5rem" }}
              >
                {[
                  { value: "100%", label: "Of natural athletes\naffected" },
                  { value: "3", label: "Throwing blocks\nper session" },
                  { value: "15–20%", label: "Max implement\nweight differential" },
                ].map((stat, i) => (
                  <div
                    key={stat.value}
                    className="text-center"
                    style={{
                      borderLeft: i > 0 ? "1px solid #e0dbd4" : undefined,
                      paddingLeft: i > 0 ? "1rem" : undefined,
                    }}
                  >
                    <div
                      className="font-heading font-bold text-2xl mb-1"
                      style={{ color: "#f59e0b" }}
                    >
                      {stat.value}
                    </div>
                    <div
                      className="text-xs leading-tight"
                      style={{ color: "#9a9288", whiteSpace: "pre-line" }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES — numbered list
      ══════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#0d0c09" }}
        aria-label="Features"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-[280px_1fr] gap-16 xl:gap-24">

            {/* Left — sticky label */}
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p
                className="font-heading text-xs uppercase tracking-[0.22em] mb-5"
                style={{ color: "rgba(245,158,11,0.8)" }}
              >
                What&apos;s inside
              </p>
              <h2
                className="font-heading font-bold leading-tight"
                style={{
                  fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                  color: "#f0ede6",
                  letterSpacing: "-0.02em",
                }}
              >
                Everything a throws coach needs.
              </h2>
              <p className="mt-4 leading-relaxed" style={{ color: "#5a554e" }}>
                Nothing a throws coach doesn&apos;t.
              </p>
            </div>

            {/* Right — numbered items */}
            <div style={{ borderTop: "1px solid #2a2720" }}>
              {[
                {
                  num: "01",
                  title: "Bondarchuk Sequencing",
                  desc: "Automatic implement order validation on every session. Flags descending-weight violations before they reach athletes. The only platform that enforces the science.",
                  tags: ["Sequence validation", "Weight differential alerts", "Session warnings"],
                },
                {
                  num: "02",
                  title: "Video Analysis",
                  desc: "Frame-by-frame annotation, drill video library, and AI-assisted technique review. Built for the way throws coaches actually watch film.",
                  tags: ["Frame annotation", "Drill library", "AI analysis"],
                },
                {
                  num: "03",
                  title: "Complete Athlete Tracking",
                  desc: "Throw logs with implement data, multi-factor readiness scores, wellness check-ins, and longitudinal trend charts. Know every athlete, every day.",
                  tags: ["Throw logs", "Readiness scoring", "Trend charts"],
                },
                {
                  num: "04",
                  title: "Smart Programming",
                  desc: "Build mesocycles with Bondarchuk periodization built in. The session wizard enforces correct structure — throwing block, strength block, throwing block.",
                  tags: ["Session wizard", "Block structure", "Volume tracking"],
                },
              ].map((f, i) => (
                <div
                  key={f.num}
                  className="flex gap-8 py-12"
                  style={{
                    borderBottom: "1px solid #2a2720",
                    paddingTop: i === 0 ? "3rem" : undefined,
                  }}
                >
                  {/* Number */}
                  <div
                    className="font-heading font-bold text-5xl leading-none w-16 flex-shrink-0 select-none"
                    style={{ color: "#2a2720" }}
                  >
                    {f.num}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-heading font-bold text-xl mb-3"
                      style={{ color: "#f0ede6" }}
                    >
                      {f.title}
                    </h3>
                    <p className="leading-relaxed mb-5" style={{ color: "#6b655a" }}>
                      {f.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {f.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs font-heading px-2.5 py-1"
                          style={{
                            border: "1px solid #2a2720",
                            color: "#6b655a",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FOUR EVENTS — horizontal rows
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#f8f6f2", color: "#1a1714" }}
        aria-label="Supported events"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          {/* Header */}
          <div
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-10 mb-0"
            style={{ borderBottom: "1px solid #e0dbd4" }}
          >
            <div>
              <p
                className="font-heading text-xs uppercase tracking-[0.22em] mb-4"
                style={{ color: "#9a9288" }}
              >
                Coverage
              </p>
              <h2
                className="font-heading font-bold leading-tight"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3.5rem)",
                  letterSpacing: "-0.025em",
                }}
              >
                All four events.
              </h2>
            </div>
            <p className="text-sm max-w-xs text-right hidden sm:block" style={{ color: "#9a9288" }}>
              The only platform designed specifically for throws — not repurposed
              from a general fitness app.
            </p>
          </div>

          {/* Event rows */}
          <div>
            {[
              {
                event: "Shot Put",
                detail: "Rotational & Glide",
                desc: "16lb, 14lb, 12lb, 8.8lb implement tracking. Competition and training PR separation. Full rotational and glide technique analysis.",
              },
              {
                event: "Discus",
                detail: "Men's & Women's",
                desc: "2kg, 1.75kg, 1.5kg, and 1kg. Video annotation built for rotational technique. Long-term implement comparison charts.",
              },
              {
                event: "Hammer",
                detail: "Wire, Handle & Ball",
                desc: "7.26kg, 9kg, 6kg tracking. Full wire and handle configuration support. Rhythmic timing analysis through throw counts.",
              },
              {
                event: "Javelin",
                detail: "Approach & Release",
                desc: "800g, 700g, 600g. Approach-run and release metrics. Pull-through phase annotation and implement comparison.",
              },
            ].map((ev) => (
              <div
                key={ev.event}
                className="flex flex-col sm:flex-row sm:items-center gap-3 py-8"
                style={{ borderBottom: "1px solid #e0dbd4" }}
              >
                <div className="sm:w-60 flex-shrink-0">
                  <h3 className="font-heading font-bold text-2xl" style={{ letterSpacing: "-0.02em" }}>
                    {ev.event}
                  </h3>
                  <span
                    className="font-heading text-xs uppercase tracking-[0.15em] mt-1 block"
                    style={{ color: "#9a9288" }}
                  >
                    {ev.detail}
                  </span>
                </div>
                <p className="flex-1 leading-relaxed" style={{ color: "#7a7268" }}>
                  {ev.desc}
                </p>
                <span
                  className="text-xl flex-shrink-0 hidden sm:block"
                  style={{ color: "#f59e0b" }}
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS — pull quotes
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#0d0c09" }}
        aria-label="Testimonials"
      >
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <p
            className="font-heading text-xs uppercase tracking-[0.22em] mb-20 text-center"
            style={{ color: "rgba(245,158,11,0.8)" }}
          >
            From coaches in the field
          </p>

          <div className="space-y-24">
            {[
              {
                quote:
                  "Finally a platform that actually understands how throws training works. The implement sequencing validation alone has made me a better programmer.",
                name: "Marcus T.",
                title: "Division I Throws Coach, Mid-American Conference",
                align: "left",
              },
              {
                quote:
                  "I used to run four separate spreadsheets for my shot, disc, hammer, and javelin athletes. Podium replaced all of them in the first week.",
                name: "Jennifer R.",
                title: "Throws Coach, NCAA D2 Program",
                align: "right",
              },
              {
                quote:
                  "The video annotation tools are exactly what I needed. My athletes can see what I'm seeing on film, right inside the app.",
                name: "David K.",
                title: "Professional Hammer Coach, USA Track & Field",
                align: "left",
              },
            ].map((t, i) => (
              <blockquote
                key={i}
                className={`max-w-3xl ${t.align === "right" ? "ml-auto text-right" : ""}`}
              >
                <p
                  className="font-heading font-bold leading-tight mb-6"
                  style={{
                    fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
                    color: "#f0ede6",
                    letterSpacing: "-0.02em",
                  }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer>
                  <cite className="not-italic">
                    <span
                      className="font-heading font-semibold text-sm block"
                      style={{ color: "#f59e0b" }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="text-xs mt-0.5 block"
                      style={{ color: "#5a554e" }}
                    >
                      {t.title}
                    </span>
                  </cite>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS — three steps
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#111009" }}
        aria-label="How it works"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <p
            className="font-heading text-xs uppercase tracking-[0.22em] mb-16"
            style={{ color: "rgba(245,158,11,0.8)" }}
          >
            Get started
          </p>

          <div
            className="grid lg:grid-cols-3 gap-0"
            style={{ borderTop: "1px solid #2a2720" }}
          >
            {[
              {
                num: "1",
                title: "Invite Your Athletes",
                desc: "Add your roster, assign events, and configure implement weights for each athlete. Athletes onboard in minutes.",
              },
              {
                num: "2",
                title: "Log Every Session",
                desc: "Build sessions with correct Bondarchuk sequencing. Log throws, track wellness, and upload video — all in one flow.",
              },
              {
                num: "3",
                title: "Analyze & Improve",
                desc: "Compare implement performance over time, review technique video, and identify where each athlete is leaving meters on the table.",
              },
            ].map((s, i) => (
              <div
                key={s.num}
                className="pt-10 pb-10"
                style={{
                  paddingLeft: i > 0 ? "3rem" : undefined,
                  paddingRight: i < 2 ? "3rem" : undefined,
                  borderLeft: i > 0 ? "1px solid #2a2720" : undefined,
                }}
              >
                <div
                  className="font-heading font-bold text-6xl mb-6 leading-none"
                  style={{ color: "#f59e0b" }}
                >
                  {s.num}
                </div>
                <h3
                  className="font-heading font-bold text-xl mb-3"
                  style={{ color: "#f0ede6" }}
                >
                  {s.title}
                </h3>
                <p className="leading-relaxed" style={{ color: "#6b655a" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════════ */}
      <section
        id="pricing"
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#f8f6f2", color: "#1a1714" }}
        aria-label="Pricing"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="mb-16">
            <p
              className="font-heading text-xs uppercase tracking-[0.22em] mb-5"
              style={{ color: "#9a9288" }}
            >
              Pricing
            </p>
            <h2
              className="font-heading font-bold leading-tight"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                letterSpacing: "-0.025em",
              }}
            >
              Start free.
              <br />
              Scale as you grow.
            </h2>
          </div>

          {/* Table */}
          <div
            className="grid md:grid-cols-3"
            style={{ border: "1px solid #e0dbd4" }}
          >
            {[
              {
                plan: "Free",
                price: "Free",
                sub: "For coaches just getting started",
                features: [
                  "Up to 3 athletes",
                  "Basic throw logging",
                  "Session tracking",
                  "1 GB video storage",
                ],
                cta: "Get Started Free",
                href: "/register",
                highlight: false,
              },
              {
                plan: "Pro",
                price: "$100",
                sub: "For active collegiate programs",
                features: [
                  "Up to 25 athletes",
                  "Bondarchuk sequence validation",
                  "Video annotation tools",
                  "Advanced analytics",
                  "50 GB video storage",
                  "Priority support",
                ],
                cta: "Start Pro Trial",
                href: "/register",
                highlight: true,
              },
              {
                plan: "Elite",
                price: "$199",
                sub: "For large programs & pro coaches",
                features: [
                  "Unlimited athletes",
                  "Everything in Pro",
                  "Dedicated success manager",
                  "500 GB video storage",
                  "API access",
                ],
                cta: "Contact Us",
                href: "/register",
                highlight: false,
              },
            ].map((p, i) => (
              <div
                key={p.plan}
                className="p-8 flex flex-col"
                style={{
                  borderLeft: i > 0 ? "1px solid #e0dbd4" : undefined,
                  backgroundColor: p.highlight ? "#1a1714" : "transparent",
                  color: p.highlight ? "#f0ede6" : "#1a1714",
                }}
              >
                {p.highlight && (
                  <span
                    className="font-heading text-xs uppercase tracking-[0.18em] mb-4"
                    style={{ color: "#f59e0b" }}
                  >
                    Most Popular
                  </span>
                )}
                <div className="mb-6">
                  <p
                    className="font-heading text-xs uppercase tracking-[0.18em] mb-2"
                    style={{ color: p.highlight ? "#6b655a" : "#9a9288" }}
                  >
                    {p.plan}
                  </p>
                  <div className="font-heading font-bold text-4xl leading-none mb-2">
                    {p.price}
                    {p.price !== "Free" && (
                      <span
                        className="text-base font-normal ml-1"
                        style={{ color: p.highlight ? "#6b655a" : "#9a9288" }}
                      >
                        /mo
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: p.highlight ? "#6b655a" : "#9a9288" }}
                  >
                    {p.sub}
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-sm"
                      style={{ color: p.highlight ? "#a09880" : "#7a7268" }}
                    >
                      <span
                        className="font-bold mt-0.5 flex-shrink-0 text-base leading-none"
                        style={{ color: "#f59e0b" }}
                      >
                        ·
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
                  className="text-center py-3.5 text-sm font-heading font-bold transition-colors"
                  style={
                    p.highlight
                      ? { backgroundColor: "#f59e0b", color: "#0d0c09" }
                      : {
                          border: "1px solid #e0dbd4",
                          color: "#1a1714",
                          backgroundColor: "transparent",
                        }
                  }
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="text-sm transition-colors hover:underline"
              style={{ color: "#9a9288" }}
            >
              See full pricing and feature comparison →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-32 lg:py-40"
        style={{ backgroundColor: "#0d0c09" }}
        aria-label="Call to action"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div
            className="pt-16"
            style={{ borderTop: "1px solid #2a2720" }}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-12">
              <h2
                className="font-heading font-bold leading-[0.9] max-w-3xl"
                style={{
                  fontSize: "clamp(2.5rem, 7vw, 6rem)",
                  color: "#f0ede6",
                  letterSpacing: "-0.03em",
                }}
              >
                Every meter counts.
                <br />
                <span style={{ color: "#f59e0b" }}>Now you&apos;ll know why.</span>
              </h2>

              <div className="flex flex-col items-start lg:items-center gap-3 flex-shrink-0">
                <Link
                  href="/register"
                  className="font-heading font-bold text-base px-10 py-4 hover:bg-primary-400 transition-colors"
                  style={{ backgroundColor: "#f59e0b", color: "#0d0c09" }}
                >
                  Start Free Trial
                </Link>
                <p className="text-xs" style={{ color: "#3a3530" }}>
                  No credit card required
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
