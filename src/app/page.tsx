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

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function SequenceIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <circle cx="6" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="25" cy="14" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M11.5 14h2M21 14h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M19 10l7-3v11l-7-3" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M8 10.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrackingIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <path d="M3 22h22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5 22V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 22V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 22V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 22V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 16 Q10 12 15 13 Q18 14 20 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2" />
    </svg>
  );
}

function ProgramIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="5" width="22" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 5V3M20 5V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 11h22" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="15" width="4" height="4" rx="0.75" fill="currentColor" fillOpacity="0.4" />
      <rect x="12" y="15" width="4" height="4" rx="0.75" fill="currentColor" />
      <rect x="17" y="15" width="4" height="4" rx="0.75" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 1l1.8 4.3H14l-3.4 2.5 1.3 4.2L8 9.5l-3.9 2.5 1.3-4.2L2 5.3h4.2z" />
    </svg>
  );
}

// ─── Hero throwing circle visual ─────────────────────────────────────────────

function HeroVisual() {
  return (
    <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-[420px] lg:h-[420px] flex items-center justify-center flex-shrink-0">
      {/* Glow blur */}
      <div className="absolute inset-8 rounded-full bg-primary-500/10 blur-3xl" />

      <svg viewBox="0 0 300 300" fill="none" className="w-full h-full" aria-hidden="true">
        {/* Outer rings */}
        <circle cx="150" cy="150" r="138" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.12" />
        <circle cx="150" cy="150" r="118" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.18" />
        <circle cx="150" cy="150" r="98" stroke="#f59e0b" strokeWidth="1.25" strokeOpacity="0.25" />
        <circle cx="150" cy="150" r="78" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.35" />
        {/* The throwing circle */}
        <circle cx="150" cy="150" r="56" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.75" />
        {/* Inner circle / toe board indicator */}
        <circle cx="150" cy="150" r="32" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.5" />
        {/* Center */}
        <circle cx="150" cy="150" r="6" fill="#f59e0b" fillOpacity="0.9" />
        {/* Sector lines — shot put sector ~45° */}
        <line x1="150" y1="150" x2="248" y2="92" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="5 4" />
        <line x1="150" y1="150" x2="248" y2="208" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="5 4" />
        {/* Sector arc */}
        <path d="M 248 92 A 113 113 0 0 1 248 208" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.25" fill="none" />
        {/* Implement trajectory */}
        <path d="M 150 118 Q 200 80 245 65" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.55" strokeLinecap="round" strokeDasharray="5 3" />
        {/* Implement dot */}
        <circle cx="245" cy="65" r="5" fill="#f59e0b" fillOpacity="0.8" />
      </svg>
    </div>
  );
}

// ─── Stat item ────────────────────────────────────────────────────────────────

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl sm:text-3xl font-heading font-bold text-primary-400">{value}</span>
      <span className="text-sm text-surface-400 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  description,
  highlights,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlights: string[];
}) {
  return (
    <div className="group relative bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-surface-800 rounded-2xl p-7 hover:border-primary-500/40 hover:shadow-glow transition-all duration-300">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 mb-5">
        {icon}
      </div>
      <h3 className="font-heading font-semibold text-xl text-surface-900 dark:text-white mb-3">{title}</h3>
      <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed mb-5">{description}</p>
      <ul className="space-y-2">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2.5 text-sm text-surface-600 dark:text-surface-400">
            <CheckIcon className="w-4.5 h-4.5 text-primary-500 flex-shrink-0 mt-0.5" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Step (how it works) ──────────────────────────────────────────────────────

function Step({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary-500 text-white font-heading font-bold text-xl flex items-center justify-center mb-5 shadow-glow">
        {num}
      </div>
      <h3 className="font-heading font-semibold text-lg text-surface-900 dark:text-white mb-3">{title}</h3>
      <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed max-w-[240px]">{description}</p>
    </div>
  );
}

// ─── Pricing preview card ─────────────────────────────────────────────────────

function PriceCard({
  plan,
  price,
  description,
  features,
  cta,
  highlight,
}: {
  plan: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-7 flex flex-col gap-5 ${
        highlight
          ? "bg-primary-500 text-white shadow-glow-lg"
          : "bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-surface-800"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-heading font-bold px-4 py-1 rounded-full uppercase tracking-widest">
          Most Popular
        </div>
      )}
      <div>
        <p className={`font-heading font-semibold text-sm uppercase tracking-widest mb-2 ${highlight ? "text-primary-100" : "text-primary-500"}`}>
          {plan}
        </p>
        <div className="flex items-end gap-1">
          <span className={`font-heading font-bold text-4xl ${highlight ? "text-white" : "text-surface-900 dark:text-white"}`}>
            {price}
          </span>
          {price !== "Free" && (
            <span className={`text-sm mb-1.5 ${highlight ? "text-primary-100" : "text-surface-500"}`}>/month</span>
          )}
        </div>
        <p className={`text-sm mt-1.5 ${highlight ? "text-primary-100" : "text-surface-500 dark:text-surface-400"}`}>
          {description}
        </p>
      </div>
      <ul className="space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className={`flex items-start gap-2.5 text-sm ${highlight ? "text-primary-50" : "text-surface-600 dark:text-surface-400"}`}>
            <CheckIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-white" : "text-primary-500"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className={`text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          highlight
            ? "bg-white text-primary-600 hover:bg-primary-50"
            : "btn-primary"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

// ─── Testimonial card ─────────────────────────────────────────────────────────

function Testimonial({
  quote,
  name,
  title,
}: {
  quote: string;
  name: string;
  title: string;
}) {
  return (
    <div className="bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-surface-800 rounded-2xl p-7">
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} className="w-4 h-4 text-primary-500" />
        ))}
      </div>
      <blockquote className="text-surface-700 dark:text-surface-300 text-sm leading-relaxed mb-5">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div>
        <p className="font-heading font-semibold text-surface-900 dark:text-white text-sm">{name}</p>
        <p className="text-xs text-surface-500 mt-0.5">{title}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen font-body bg-[var(--background)] text-[var(--foreground)]">
      <MarketingNav />

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center bg-[#060606] overflow-hidden pt-[66px]"
        aria-label="Hero"
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #f59e0b 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        {/* Amber radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 py-20 lg:py-28 flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
          {/* Text */}
          <div className="flex-1 min-w-0 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-semibold font-heading px-3.5 py-1.5 rounded-full mb-7 uppercase tracking-widest">
              Built on Bondarchuk Methodology
            </div>
            <h1 className="font-heading font-bold text-display-xl text-white leading-[1.1] mb-6">
              The Coaching Platform
              <br />
              <span className="text-primary-400">Built for Throws</span>
            </h1>
            <p className="text-lg text-surface-400 leading-relaxed mb-9 max-w-xl mx-auto lg:mx-0">
              Manage shot put, discus, hammer, and javelin athletes with the only platform that
              enforces correct implement sequencing. Bondarchuk&rsquo;s Transfer of Training — built in.
            </p>
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href="/register"
                className="btn-primary px-8 py-3.5 text-base font-semibold rounded-xl shadow-glow flex items-center gap-2"
              >
                Start Free Trial
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <Link
                href="/#features"
                className="px-8 py-3.5 text-base font-medium rounded-xl border border-surface-700 text-surface-300 hover:border-surface-500 hover:text-white transition-colors"
              >
                See Features
              </Link>
            </div>
            <p className="mt-6 text-xs text-surface-600">
              Free plan available — no credit card required
            </p>
          </div>

          {/* Hero visual */}
          <HeroVisual />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="bg-surface-900 border-y border-surface-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatItem value="500+" label="Coaches" />
          <StatItem value="10,000+" label="Athletes Tracked" />
          <StatItem value="50+" label="D1 Programs" />
          <StatItem value="4" label="Events Covered" />
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section
        id="features"
        className="py-24 lg:py-32 bg-surface-50 dark:bg-[#0a0a0a]"
        aria-label="Features"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-500 text-sm font-semibold font-heading uppercase tracking-widest mb-3">
              Everything You Need
            </p>
            <h2 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white mb-4">
              Built for the throws room
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-lg max-w-2xl mx-auto">
              Every feature was designed with a throws coach in mind. No generic fitness app templates — purpose-built for the circle and the sector.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<SequenceIcon />}
              title="Bondarchuk Sequencing"
              description="The only platform that validates your implement order against Bondarchuk's research. Heavy → light, always."
              highlights={[
                "Automatic sequence validation",
                "Flags ascending-weight errors",
                "15–20% differential alerts",
              ]}
            />
            <FeatureCard
              icon={<VideoIcon />}
              title="Video Analysis"
              description="Frame-by-frame annotation, drill library, and technique comparison tools built for throws coaches."
              highlights={[
                "Frame-by-frame annotation",
                "Drill video library",
                "Athlete-facing playback",
              ]}
            />
            <FeatureCard
              icon={<TrackingIcon />}
              title="Complete Athlete Tracking"
              description="Throws logs, wellness check-ins, readiness scores, and session history — all in one place."
              highlights={[
                "Throw logs with implement data",
                "Multi-factor readiness scores",
                "Trend and comparison charts",
              ]}
            />
            <FeatureCard
              icon={<ProgramIcon />}
              title="Smart Programming"
              description="Build mesocycles and training blocks using Bondarchuk periodization principles with built-in structure."
              highlights={[
                "Session wizard with sequencing",
                "Training block templates",
                "Volume and intensity tracking",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── BONDARCHUK METHODOLOGY ── */}
      <section
        id="methodology"
        className="py-24 lg:py-32 bg-surface-900"
        aria-label="Bondarchuk methodology"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Text */}
            <div className="flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-primary-500/15 border border-primary-500/25 text-primary-400 text-xs font-semibold font-heading px-3 py-1.5 rounded-full mb-7 uppercase tracking-widest">
                Dr. Anatoliy Bondarchuk
              </div>
              <h2 className="font-heading font-bold text-display-lg text-white mb-5">
                Heavy first.
                <br />
                <span className="text-primary-400">Always.</span>
              </h2>
              <p className="text-surface-300 leading-relaxed mb-7">
                Bondarchuk&rsquo;s research proved that ascending implement sequences
                (light → heavy) cause athletes to <strong className="text-white">lose 2–4 meters</strong> in competition
                performance. Natural athletes must always throw the heaviest implement first.
              </p>
              <p className="text-surface-400 text-sm leading-relaxed mb-10">
                Podium Throws is the only coaching platform that enforces this rule automatically —
                flagging any session where implements are sequenced incorrectly before you assign it to
                athletes.
              </p>

              {/* Sequence diagram */}
              <div className="bg-surface-800 rounded-2xl p-6">
                <p className="text-xs font-heading font-semibold text-surface-500 uppercase tracking-widest mb-4">
                  Correct Implement Sequence
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { weight: "9 kg", label: "Overweight", color: "bg-primary-500" },
                    { weight: "8 kg", label: "Training", color: "bg-primary-500/70" },
                    { weight: "7.26 kg", label: "Competition", color: "bg-primary-500/40" },
                  ].map((item, i, arr) => (
                    <div key={item.weight} className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`${item.color} text-white font-heading font-bold text-sm px-4 py-2 rounded-xl min-w-[80px] text-center`}
                        >
                          {item.weight}
                        </div>
                        <span className="text-xs text-surface-500">{item.label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <ArrowRightIcon className="w-4 h-4 text-surface-600 flex-shrink-0 -mt-4" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs px-3 py-2 rounded-lg">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                  </svg>
                  <span>Reversing this order causes a 2–4m performance decrease (Volume IV, p.114)</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-sm">
              {[
                {
                  metric: "2–4m",
                  label: "Performance loss from wrong sequencing",
                  color: "text-danger-400",
                },
                {
                  metric: "100%",
                  label: "Of natural athletes showed this effect",
                  color: "text-primary-400",
                },
                {
                  metric: "3 blocks",
                  label: "Throwing blocks per session for optimal transfer",
                  color: "text-primary-400",
                },
                {
                  metric: "15–20%",
                  label: "Max weight differential for implement pairing",
                  color: "text-primary-400",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-surface-800 border border-surface-700 rounded-2xl p-6 text-center"
                >
                  <div className={`font-heading font-bold text-3xl ${item.color} mb-2`}>
                    {item.metric}
                  </div>
                  <p className="text-surface-400 text-sm leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── EVENTS ── */}
      <section
        id="events"
        className="py-24 lg:py-32 bg-surface-50 dark:bg-[#0a0a0a]"
        aria-label="Supported events"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-primary-500 text-sm font-semibold font-heading uppercase tracking-widest mb-3">
              All Four Events
            </p>
            <h2 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white mb-4">
              Purpose-built for throws coaches
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-lg max-w-xl mx-auto">
              Podium Throws is the only coaching platform designed specifically for the throwing events. Every feature reflects how throws coaches actually coach.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                event: "Shot Put",
                icon: (
                  <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14" aria-hidden="true">
                    <circle cx="32" cy="32" r="22" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="2" />
                    <circle cx="32" cy="32" r="14" fill="#f59e0b" fillOpacity="0.25" />
                    <circle cx="32" cy="32" r="7" fill="#f59e0b" fillOpacity="0.6" />
                  </svg>
                ),
                description:
                  "Track indoor and outdoor shot implements. Built-in implement sequencing for 16lb, 14lb, 12lb, and women's 8.8lb.",
                detail: "Rotational & Glide styles",
              },
              {
                event: "Discus",
                icon: (
                  <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14" aria-hidden="true">
                    <ellipse cx="32" cy="32" rx="26" ry="14" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="2" />
                    <ellipse cx="32" cy="32" rx="16" ry="8" fill="#f59e0b" fillOpacity="0.3" />
                    <ellipse cx="32" cy="32" rx="6" ry="3" fill="#f59e0b" fillOpacity="0.7" />
                  </svg>
                ),
                description:
                  "Log 2kg, 1.75kg, 1.5kg, and 1kg discus sessions. Video annotation tools built for rotational technique analysis.",
                detail: "Men's & women's implements",
              },
              {
                event: "Hammer",
                icon: (
                  <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14" aria-hidden="true">
                    <circle cx="32" cy="22" r="14" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="2" />
                    <circle cx="32" cy="22" r="8" fill="#f59e0b" fillOpacity="0.35" />
                    <path d="M32 36 Q30 44 26 52" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="25.5" cy="53" r="3" fill="#f59e0b" fillOpacity="0.6" />
                  </svg>
                ),
                description:
                  "Full hammer event support including wire/handle configurations. Track 7.26kg, 9kg, and 6kg training implements.",
                detail: "Wire, handle, and ball tracking",
              },
              {
                event: "Javelin",
                icon: (
                  <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14" aria-hidden="true">
                    <path d="M10 54 L52 12" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" fillOpacity="0.6" />
                    <path d="M52 12 L48 24 L40 20 Z" fill="#f59e0b" fillOpacity="0.7" />
                    <circle cx="31" cy="33" r="3.5" fill="#f59e0b" fillOpacity="0.4" />
                  </svg>
                ),
                description:
                  "Approach-run metrics, release angle tracking, and implement comparisons for 800g, 700g, and 600g javelins.",
                detail: "Approach & release metrics",
              },
            ].map((ev) => (
              <div
                key={ev.event}
                className="bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-surface-800 rounded-2xl p-7 text-center hover:border-primary-500/40 hover:shadow-glow transition-all duration-300"
              >
                <div className="flex justify-center mb-5">{ev.icon}</div>
                <h3 className="font-heading font-bold text-xl text-surface-900 dark:text-white mb-3">
                  {ev.event}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed mb-4">
                  {ev.description}
                </p>
                <span className="inline-block bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-medium px-3 py-1 rounded-full">
                  {ev.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 lg:py-32 bg-white dark:bg-surface-950" aria-label="How it works">
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-500 text-sm font-semibold font-heading uppercase tracking-widest mb-3">
              Get Started in Minutes
            </p>
            <h2 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white">
              How it works
            </h2>
          </div>

          <div className="relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-0.5 bg-gradient-to-r from-primary-500/50 via-primary-500/30 to-primary-500/50" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-6">
              <Step
                num="1"
                title="Invite Your Athletes"
                description="Add your roster, assign events, and configure implement weights for each athlete. Athletes onboard in minutes."
              />
              <Step
                num="2"
                title="Log Every Session"
                description="Build sessions with correct Bondarchuk sequencing. Log throws, track wellness, and upload video — all in one flow."
              />
              <Step
                num="3"
                title="Analyze & Improve"
                description="Compare implement performance over time, review technique video, and identify where each athlete is leaving meters on the table."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="py-24 lg:py-32 bg-surface-50 dark:bg-[#0a0a0a]" aria-label="Pricing preview">
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-primary-500 text-sm font-semibold font-heading uppercase tracking-widest mb-3">
              Simple Pricing
            </p>
            <h2 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white mb-4">
              Start free, scale as you grow
            </h2>
            <p className="text-surface-600 dark:text-surface-400 text-lg">
              No setup fees. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-5xl mx-auto">
            <PriceCard
              plan="Free"
              price="Free"
              description="For coaches just getting started"
              features={["Up to 3 athletes", "Basic throw logging", "Session tracking", "1 GB video storage"]}
              cta="Get Started Free"
            />
            <PriceCard
              plan="Pro"
              price="$100"
              description="For active collegiate programs"
              features={[
                "Up to 25 athletes",
                "Bondarchuk sequencing validation",
                "Video annotation tools",
                "Advanced analytics",
                "50 GB video storage",
                "Priority support",
              ]}
              cta="Start Pro Trial"
              highlight
            />
            <PriceCard
              plan="Elite"
              price="$199"
              description="For large programs & pro coaches"
              features={[
                "Unlimited athletes",
                "Everything in Pro",
                "Dedicated success manager",
                "500 GB video storage",
                "API access",
              ]}
              cta="Contact Us"
            />
          </div>

          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-400 font-medium text-sm transition-colors"
            >
              See full pricing and feature comparison
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 lg:py-32 bg-white dark:bg-surface-950" aria-label="Testimonials">
        <div className="max-w-7xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-primary-500 text-sm font-semibold font-heading uppercase tracking-widest mb-3">
              Trusted by Coaches
            </p>
            <h2 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white">
              What coaches are saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <Testimonial
              quote="Finally a platform that actually understands how throws training works. The implement sequencing validation alone has made me a better programmer."
              name="Marcus T."
              title="Division I Throws Coach, Mid-American Conference"
            />
            <Testimonial
              quote="I used to run four separate spreadsheets for my shot, disc, hammer, and javelin athletes. Podium replaced all of them in the first week."
              name="Jennifer R."
              title="Throws Coach, NCAA D2 Program"
            />
            <Testimonial
              quote="The video annotation tools are exactly what I needed. My athletes can see what I'm seeing on film, right inside the app. No more screen recordings."
              name="David K."
              title="Professional Hammer Coach, USA Track & Field"
            />
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 lg:py-32 bg-primary-500 relative overflow-hidden"
        aria-label="Call to action"
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="font-heading font-bold text-display-lg text-white mb-5">
            Ready to elevate your program?
          </h2>
          <p className="text-primary-100 text-lg mb-10 leading-relaxed">
            Join hundreds of throws coaches who use Podium to manage their athletes, validate their programming,
            and get more meters out of every session.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-primary-600 px-9 py-3.5 rounded-xl font-heading font-bold text-base hover:bg-primary-50 transition-colors shadow-lg flex items-center gap-2"
            >
              Start Free Trial
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="border-2 border-white/50 text-white px-9 py-3.5 rounded-xl font-heading font-semibold text-base hover:border-white hover:bg-white/10 transition-colors"
            >
              View Pricing
            </Link>
          </div>
          <p className="mt-6 text-primary-100/70 text-sm">
            Free plan available — no credit card required
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
