"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Billing toggle ───────────────────────────────────────────────────────────

export type Billing = "monthly" | "annual";

export function BillingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-1 rounded-xl">
      <button
        onClick={() => onChange("monthly")}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold font-body transition-all duration-200 min-h-[44px] ${
          billing === "monthly"
            ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm"
            : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange("annual")}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold font-body transition-all duration-200 flex items-center gap-2 min-h-[44px] ${
          billing === "annual"
            ? "bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm"
            : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
        }`}
      >
        Annual
        <span className="bg-success-500/15 text-success-600 dark:text-success-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Save 20%
        </span>
      </button>
    </div>
  );
}

// ─── Pricing cards ────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path d="M4 8h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  description: string;
  athletes: string;
  highlight: boolean;
  cta: string;
  ctaHref: string;
  features: { label: string; included: boolean }[];
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for coaches just getting started",
    athletes: "Up to 3 athletes",
    highlight: false,
    cta: "Get Started Free",
    ctaHref: "/register",
    features: [
      { label: "3 athletes", included: true },
      { label: "Basic throw logging", included: true },
      { label: "Session tracking", included: true },
      { label: "1 GB video storage", included: true },
      { label: "Wellness check-ins", included: true },
      { label: "Bondarchuk sequencing validation", included: false },
      { label: "Video annotation tools", included: false },
      { label: "Advanced analytics & charts", included: false },
      { label: "Questionnaires & surveys", included: false },
      { label: "Priority support", included: false },
      { label: "API access", included: false },
      { label: "Dedicated success manager", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 100,
    annualPrice: 80,
    description: "For active collegiate programs",
    athletes: "Up to 25 athletes",
    highlight: true,
    cta: "Start Pro Trial",
    ctaHref: "/register?plan=pro",
    features: [
      { label: "25 athletes", included: true },
      { label: "Basic throw logging", included: true },
      { label: "Session tracking", included: true },
      { label: "50 GB video storage", included: true },
      { label: "Wellness check-ins", included: true },
      { label: "Bondarchuk sequencing validation", included: true },
      { label: "Video annotation tools", included: true },
      { label: "Advanced analytics & charts", included: true },
      { label: "Questionnaires & surveys", included: true },
      { label: "Priority support", included: true },
      { label: "API access", included: false },
      { label: "Dedicated success manager", included: false },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    monthlyPrice: 199,
    annualPrice: 159,
    description: "For large programs and pro coaches",
    athletes: "Unlimited athletes",
    highlight: false,
    cta: "Start Elite Trial",
    ctaHref: "/register?plan=elite",
    features: [
      { label: "Unlimited athletes", included: true },
      { label: "Basic throw logging", included: true },
      { label: "Session tracking", included: true },
      { label: "500 GB video storage", included: true },
      { label: "Wellness check-ins", included: true },
      { label: "Bondarchuk sequencing validation", included: true },
      { label: "Video annotation tools", included: true },
      { label: "Advanced analytics & charts", included: true },
      { label: "Questionnaires & surveys", included: true },
      { label: "Priority support", included: true },
      { label: "API access", included: true },
      { label: "Dedicated success manager", included: true },
    ],
  },
];

export function PricingCards({
  billing,
  isAuthenticated = false,
  isCoach = false,
  currentPlan = null,
}: {
  billing: Billing;
  isAuthenticated?: boolean;
  isCoach?: boolean;
  currentPlan?: string | null;
}) {
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  async function handleCheckout(planId: string) {
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval: billing }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      } else {
        console.error("Checkout error:", data.error);
        setCheckoutLoading(null);
      }
    } catch {
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
      {PLANS.map((plan) => {
        const price =
          billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
        const isFree = price === 0;
        const isCurrentPlan = isCoach && currentPlan?.toUpperCase() === plan.id.toUpperCase();
        const isPaid = plan.id !== "free";

        // Determine CTA behavior:
        // - Free plan: always → /register
        // - Current plan: "Current Plan" badge (no link)
        // - Authenticated coach on FREE: direct Stripe checkout
        // - Unauthenticated: → /register?plan=X
        let ctaLabel = plan.cta;
        let ctaAction: "link" | "checkout" | "current" = "link";
        let ctaHref = plan.ctaHref;

        if (isCurrentPlan) {
          ctaLabel = "Current Plan";
          ctaAction = "current";
        } else if (isPaid && isCoach) {
          ctaLabel = `Upgrade to ${plan.name}`;
          ctaAction = "checkout";
        } else if (isPaid && !isAuthenticated) {
          ctaHref = `/register?plan=${plan.id}${billing === "annual" ? "&interval=annual" : ""}`;
        }

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl p-8 flex flex-col gap-6 ${
              plan.highlight
                ? "bg-primary-500 text-white shadow-glow-lg ring-2 ring-primary-400/30"
                : "bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800"
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-surface-900 dark:bg-surface-950 text-white text-[11px] font-heading font-bold px-4 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                Most Popular
              </div>
            )}

            {/* Header */}
            <div>
              <p
                className={`font-heading font-semibold text-xs uppercase tracking-widest mb-3 ${
                  plan.highlight ? "text-primary-100" : "text-primary-500"
                }`}
              >
                {plan.name}
              </p>
              <div className="flex items-end gap-1 mb-2">
                {isFree ? (
                  <span
                    className={`font-heading font-bold text-[42px] leading-none ${
                      plan.highlight ? "text-white" : "text-surface-900 dark:text-white"
                    }`}
                  >
                    Free
                  </span>
                ) : (
                  <>
                    <span
                      className={`font-heading font-bold text-[42px] leading-none ${
                        plan.highlight ? "text-white" : "text-surface-900 dark:text-white"
                      }`}
                    >
                      ${price}
                    </span>
                    <span
                      className={`text-sm mb-1.5 ${
                        plan.highlight ? "text-primary-100" : "text-surface-500"
                      }`}
                    >
                      /mo
                    </span>
                  </>
                )}
              </div>
              {billing === "annual" && !isFree && (
                <p
                  className={`text-xs ${plan.highlight ? "text-primary-200" : "text-surface-500"}`}
                >
                  Billed ${(price! * 12).toLocaleString()}/year
                </p>
              )}
              <p
                className={`text-sm mt-2 ${
                  plan.highlight ? "text-primary-100" : "text-surface-500 dark:text-surface-400"
                }`}
              >
                {plan.description}
              </p>
            </div>

            {/* Athletes callout */}
            <div
              className={`text-sm font-semibold py-2.5 px-4 rounded-xl text-center ${
                plan.highlight
                  ? "bg-primary-400/30 text-white"
                  : "bg-primary-500/10 text-primary-600 dark:text-primary-400"
              }`}
            >
              {plan.athletes}
            </div>

            {/* CTA */}
            {ctaAction === "current" ? (
              <div
                className={`text-center py-3 rounded-xl text-sm font-semibold font-heading flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-white/20 text-white cursor-default"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 cursor-default"
                }`}
              >
                {ctaLabel}
              </div>
            ) : ctaAction === "checkout" ? (
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={checkoutLoading === plan.id}
                className={`text-center py-3 rounded-xl text-sm font-semibold font-heading transition-colors flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-white text-primary-600 hover:bg-primary-50"
                    : "btn-primary"
                }`}
              >
                {checkoutLoading === plan.id ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Redirecting…
                  </span>
                ) : (
                  <>
                    {ctaLabel}
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            ) : (
              <Link
                href={ctaHref}
                className={`text-center py-3 rounded-xl text-sm font-semibold font-heading transition-colors flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-white text-primary-600 hover:bg-primary-50"
                    : "btn-primary"
                }`}
              >
                {ctaLabel}
                <ArrowRightIcon />
              </Link>
            )}

            {/* Features */}
            <ul className="space-y-3 flex-1">
              {plan.features.map((f) => (
                <li
                  key={f.label}
                  className={`flex items-center gap-2.5 text-sm ${
                    f.included
                      ? plan.highlight
                        ? "text-primary-50"
                        : "text-surface-700 dark:text-surface-300"
                      : plan.highlight
                      ? "text-primary-300/50"
                      : "text-surface-400 dark:text-surface-600"
                  }`}
                >
                  {f.included ? (
                    <CheckIcon />
                  ) : (
                    <DashIcon />
                  )}
                  <span className={f.included ? "" : "line-through"}>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Feature matrix ───────────────────────────────────────────────────────────

const MATRIX_ROWS = [
  { category: "Athletes", rows: [
    { feature: "Active athletes", free: "3", pro: "25", elite: "Unlimited" },
    { feature: "Event support", free: "All 4", pro: "All 4", elite: "All 4" },
  ]},
  { category: "Training", rows: [
    { feature: "Throw logging", free: true, pro: true, elite: true },
    { feature: "Session builder", free: true, pro: true, elite: true },
    { feature: "Bondarchuk sequence validation", free: false, pro: true, elite: true },
    { feature: "Implement weight rules", free: false, pro: true, elite: true },
    { feature: "Training block templates", free: false, pro: true, elite: true },
    { feature: "Questionnaires & surveys", free: false, pro: true, elite: true },
  ]},
  { category: "Athlete Monitoring", rows: [
    { feature: "Wellness check-ins", free: true, pro: true, elite: true },
    { feature: "Readiness scoring", free: "Basic", pro: "Full", elite: "Full" },
    { feature: "Advanced analytics", free: false, pro: true, elite: true },
    { feature: "Implement comparison charts", free: false, pro: true, elite: true },
  ]},
  { category: "Video", rows: [
    { feature: "Video upload & playback", free: true, pro: true, elite: true },
    { feature: "Video annotation tools", free: false, pro: true, elite: true },
    { feature: "Drill video library", free: false, pro: true, elite: true },
    { feature: "Storage", free: "1 GB", pro: "50 GB", elite: "500 GB" },
  ]},
  { category: "Support & Access", rows: [
    { feature: "Email support", free: true, pro: true, elite: true },
    { feature: "Priority support", free: false, pro: true, elite: true },
    { feature: "Dedicated success manager", free: false, pro: false, elite: true },
    { feature: "API access", free: false, pro: false, elite: true },
  ]},
];

function MatrixCell({ val }: { val: boolean | string }) {
  if (typeof val === "boolean") {
    return val ? (
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500/15 text-primary-500">
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3" aria-label="Included">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </span>
      </td>
    ) : (
      <td className="py-3 px-4 text-center">
        <span className="text-surface-400 dark:text-surface-600 text-lg leading-none">—</span>
      </td>
    );
  }
  return (
    <td className="py-3 px-4 text-center text-sm font-medium text-surface-700 dark:text-surface-300">
      {val}
    </td>
  );
}

function MobileMatrixValue({ val, plan }: { val: boolean | string; plan: string }) {
  if (typeof val === "boolean") {
    return val ? (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500/15 text-primary-500">
        <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3" aria-label="Included">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </span>
    ) : (
      <span className="text-surface-400 dark:text-surface-600 text-lg leading-none">—</span>
    );
  }
  return (
    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{val}</span>
  );
}

export function FeatureMatrix() {
  return (
    <>
      {/* Mobile: stacked card layout */}
      <div className="sm:hidden space-y-4">
        {MATRIX_ROWS.map((group) => (
          <div key={group.category} className="rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
            <div className="bg-surface-50/80 dark:bg-surface-900/40 py-2.5 px-4">
              <span className="text-xs font-heading font-bold text-surface-500 uppercase tracking-widest">
                {group.category}
              </span>
            </div>
            <div className="bg-white dark:bg-surface-950 divide-y divide-surface-100 dark:divide-surface-800">
              {group.rows.map((row) => (
                <div key={row.feature} className="px-4 py-3">
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    {row.feature}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Free", "Pro", "Elite"] as const).map((plan) => {
                      const val = plan === "Free" ? row.free : plan === "Pro" ? row.pro : row.elite;
                      return (
                        <div key={plan} className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-heading font-bold uppercase tracking-wide ${
                            plan === "Pro" ? "text-primary-500" : "text-surface-500 dark:text-surface-400"
                          }`}>
                            {plan}
                          </span>
                          <MobileMatrixValue val={val} plan={plan} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-surface-200 dark:border-surface-800">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-900/80 border-b border-surface-200 dark:border-surface-800">
              <th className="py-4 px-5 text-left text-sm font-heading font-semibold text-surface-600 dark:text-surface-400 w-1/2">
                Feature
              </th>
              {["Free", "Pro", "Elite"].map((plan) => (
                <th
                  key={plan}
                  className={`py-4 px-4 text-center text-sm font-heading font-bold w-[calc(50%/3)] ${
                    plan === "Pro" ? "text-primary-500" : "text-surface-900 dark:text-white"
                  }`}
                >
                  {plan}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-950 divide-y divide-surface-100 dark:divide-surface-800">
            {MATRIX_ROWS.flatMap((group) => [
              <tr key={`cat-${group.category}`} className="bg-surface-50/80 dark:bg-surface-900/40">
                <td
                  colSpan={4}
                  className="py-2.5 px-5 text-xs font-heading font-bold text-surface-500 uppercase tracking-widest"
                >
                  {group.category}
                </td>
              </tr>,
              ...group.rows.map((row) => (
                <tr key={`${group.category}-${row.feature}`} className="hover:bg-surface-50/50 dark:hover:bg-surface-900/20 transition-colors">
                  <td className="py-3 px-5 text-sm text-surface-700 dark:text-surface-300">
                    {row.feature}
                  </td>
                  <MatrixCell val={row.free} />
                  <MatrixCell val={row.pro} />
                  <MatrixCell val={row.elite} />
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "How does the free trial work?",
    a: "The free plan is free forever — no trial period, no credit card required. You can start managing up to 3 athletes immediately after registering. When you're ready to scale, upgrade to Pro or Elite in one click.",
  },
  {
    q: "Can I import my existing athlete data?",
    a: "Yes. Podium Throws supports CSV import for athlete profiles, throw history, and session logs. Our onboarding guide walks you through the import format. For large programs, our Elite plan includes hands-on migration support from your success manager.",
  },
  {
    q: "What happens if I exceed my athlete limit?",
    a: "You'll be notified before you hit your limit. You can archive inactive athletes to free up slots, or upgrade your plan to add more. Archived athletes retain all their historical data and can be reactivated at any time.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual plans are billed once per year at a 20% discount compared to monthly billing. Pro annual is $960/year (vs $1,200 monthly) and Elite annual is $1,908/year (vs $2,388 monthly). You can switch between monthly and annual at any time — the change takes effect at your next billing date.",
  },
  {
    q: "Is there a discount for educational institutions?",
    a: "Yes. We offer a 15% discount for verified high school programs and 10% for non-profit track clubs. Contact us with your institutional email address to apply. D1 and D2 programs can also negotiate multi-year pricing on the Elite plan.",
  },
  {
    q: "What is the Bondarchuk sequencing validation?",
    a: "Dr. Anatoliy Bondarchuk's research proved that natural athletes lose 2–4 meters when implements are sequenced light → heavy in the same session. Podium's sequencing validation checks every session you create and flags any workout where lighter implements are scheduled before heavier ones — preventing this common programming error automatically.",
  },
];

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`border rounded-xl overflow-hidden transition-colors ${
              isOpen
                ? "border-primary-500/40 bg-white dark:bg-surface-900"
                : "border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/50"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 group"
              aria-expanded={isOpen}
            >
              <span className="font-heading font-semibold text-surface-900 dark:text-white text-sm group-hover:text-primary-500 transition-colors">
                {faq.q}
              </span>
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isOpen
                    ? "bg-primary-500 text-white rotate-45"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-500"
                }`}
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor" aria-hidden="true">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="px-6 pb-5">
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stateful pricing page wrapper ───────────────────────────────────────────

export function PricingPageClient({
  isAuthenticated = false,
  isCoach = false,
  currentPlan = null,
}: {
  isAuthenticated?: boolean;
  isCoach?: boolean;
  currentPlan?: string | null;
}) {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      {/* Billing toggle */}
      <div className="flex justify-center mt-8 mb-12">
        <BillingToggle billing={billing} onChange={setBilling} />
      </div>

      {/* Pricing cards */}
      <PricingCards
        billing={billing}
        isAuthenticated={isAuthenticated}
        isCoach={isCoach}
        currentPlan={currentPlan}
      />
    </>
  );
}
