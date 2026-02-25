import type { Metadata } from "next";
import Link from "next/link";
import MarketingNav from "@/components/marketing/Nav";
import MarketingFooter from "@/components/marketing/Footer";
import { PricingPageClient, FeatureMatrix, FAQAccordion } from "./_pricing-client";

export const metadata: Metadata = {
  title: "Pricing — Podium Throws",
  description:
    "Simple, transparent pricing for throws coaches. Free plan available. Pro at $100/month for 25 athletes. Elite at $199/month for unlimited athletes.",
  openGraph: {
    title: "Pricing — Podium Throws",
    description:
      "Simple, transparent pricing for throws coaches. Free plan available. Pro at $100/month for 25 athletes. Elite at $199/month for unlimited athletes.",
    type: "website",
    images: [
      {
        url: "/og-pricing.png",
        width: 1200,
        height: 630,
        alt: "Podium Throws Pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Podium Throws",
    description: "Free, Pro ($100/mo), and Elite ($199/mo) plans for throws coaches.",
  },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-primary-500 flex-shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" aria-hidden="true">
      <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen font-body bg-[var(--background)] text-[var(--foreground)]">
      <MarketingNav />

      {/* ── HEADER ── */}
      <section className="pt-[66px] bg-surface-50 dark:bg-[#0a0a0a]" aria-label="Pricing header">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-20 pb-6 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-500 dark:text-primary-400 text-xs font-semibold font-heading px-3.5 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            Simple, Transparent Pricing
          </div>
          <h1 className="font-heading font-bold text-display-lg text-surface-900 dark:text-white mb-4">
            Start free.{" "}
            <span className="text-primary-500">Scale as you grow.</span>
          </h1>
          <p className="text-surface-600 dark:text-surface-400 text-lg leading-relaxed max-w-xl mx-auto">
            No setup fees. No hidden costs. Cancel anytime. Every plan includes the core tools throws coaches need.
          </p>
        </div>
      </section>

      {/* ── PRICING CARDS (client — needs billing toggle) ── */}
      <section className="py-4 pb-24 bg-surface-50 dark:bg-[#0a0a0a]" aria-label="Pricing plans">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <PricingPageClient />
        </div>
      </section>

      {/* ── TRUST SIGNALS ── */}
      <div className="bg-white dark:bg-surface-950 border-y border-surface-200 dark:border-surface-800 py-8">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              "Free plan — no credit card",
              "Cancel anytime",
              "14-day money-back guarantee",
              "Data export always available",
            ].map((item) => (
              <div key={item} className="flex flex-col items-center gap-2">
                <CheckIcon />
                <span className="text-sm text-surface-600 dark:text-surface-400">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURE MATRIX ── */}
      <section className="py-24 bg-surface-50 dark:bg-[#0a0a0a]" aria-label="Feature comparison">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-display-md text-surface-900 dark:text-white mb-3">
              Full feature comparison
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              Everything you get at each plan level.
            </p>
          </div>
          <FeatureMatrix />
        </div>
      </section>

      {/* ── BONDARCHUK CALLOUT ── */}
      <section
        className="py-16 bg-primary-500/5 dark:bg-primary-500/8 border-y border-primary-500/15"
        aria-label="Methodology note"
      >
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <p className="font-heading font-semibold text-primary-600 dark:text-primary-400 text-sm uppercase tracking-widest mb-3">
            Why Coaches Choose Podium
          </p>
          <h2 className="font-heading font-bold text-display-md text-surface-900 dark:text-white mb-4">
            The only platform that enforces
            <br className="hidden sm:block" />
            <span className="text-primary-500"> correct implement sequencing</span>
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            Dr. Bondarchuk&rsquo;s research proves ascending implement sequences (light → heavy) cost athletes 2–4 meters.
            Podium validates every session you create and flags sequencing errors before they reach your athletes.
          </p>
          <Link
            href="/#methodology"
            className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-400 font-medium transition-colors"
          >
            Learn about the Bondarchuk methodology
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 bg-white dark:bg-surface-950" aria-label="Frequently asked questions">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-display-md text-surface-900 dark:text-white mb-3">
              Frequently asked questions
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              Everything you need to know about Podium Throws pricing.
            </p>
          </div>
          <FAQAccordion />

          <div className="mt-12 text-center p-8 bg-surface-50 dark:bg-surface-900/50 rounded-2xl border border-surface-200 dark:border-surface-800">
            <p className="font-heading font-semibold text-surface-900 dark:text-white mb-2">
              Still have questions?
            </p>
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-5">
              Our team typically responds within a few hours.
            </p>
            <a
              href="mailto:support@podiumthrows.com"
              className="inline-flex items-center gap-2 btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold"
            >
              Contact Support
              <ArrowRightIcon />
            </a>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 bg-primary-500 relative overflow-hidden"
        aria-label="Call to action"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="font-heading font-bold text-display-lg text-white mb-5">
            Start for free today
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed mb-9">
            Sign up in seconds. Manage your first 3 athletes completely free — no credit card, no commitment.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-primary-600 px-9 py-3.5 rounded-xl font-heading font-bold text-base hover:bg-primary-50 transition-colors shadow-lg flex items-center gap-2"
            >
              Create Free Account
              <ArrowRightIcon />
            </Link>
            <Link
              href="/login"
              className="border-2 border-white/50 text-white px-9 py-3.5 rounded-xl font-heading font-semibold text-base hover:border-white hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
