import Stripe from "stripe";

// Lazy singleton — avoids module-level initialization crash when
// STRIPE_SECRET_KEY is absent at build time (Vercel static analysis).
let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your Vercel environment variables."
      );
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Proxy so callers can use `stripe.X` without change — actual instance
// is created on first property access, not at module load time.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeInstance(), prop, receiver);
  },
});

/* ── Billing types ─────────────────────────────────────────────────────────── */

export type BillingInterval = "monthly" | "annual";

/* ── Plan definitions ──────────────────────────────────────────────────────── */

export const PLANS = {
  FREE: {
    name: "Free",
    maxAthletes: 3,
    monthlyPriceId: null as string | null,
    annualPriceId: null as string | null,
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started with up to 3 athletes.",
  },
  PRO: {
    name: "Pro",
    maxAthletes: 25,
    monthlyPriceId: process.env.STRIPE_PRICE_PRO || null,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || null,
    monthlyPrice: 100,
    annualPrice: 80,
    description: "For growing programs up to 25 athletes.",
  },
  ELITE: {
    name: "Elite",
    maxAthletes: Infinity,
    monthlyPriceId: process.env.STRIPE_PRICE_ELITE || null,
    annualPriceId: process.env.STRIPE_PRICE_ELITE_ANNUAL || null,
    monthlyPrice: 199,
    annualPrice: 159,
    description: "Unlimited athletes, priority support.",
  },
} as const;

export type PlanName = keyof typeof PLANS;

/* ── Price resolution helpers ──────────────────────────────────────────────── */

/** Get the Stripe price ID for a plan + billing interval. */
export function getPriceId(
  plan: PlanName,
  interval: BillingInterval = "monthly"
): string | null {
  const p = PLANS[plan];
  return interval === "annual" ? p.annualPriceId : p.monthlyPriceId;
}

/** Resolve a Stripe price ID → plan name. Returns null if unrecognized. */
export function getPlanFromPriceId(priceId: string): PlanName | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.monthlyPriceId === priceId || plan.annualPriceId === priceId) {
      return key as PlanName;
    }
  }
  return null;
}

/**
 * Ensure the coach has a Stripe customer record.
 * Creates one if stripeCustomerId is null and returns the ID.
 */
export async function getOrCreateStripeCustomer(
  stripeCustomerId: string | null,
  email: string,
  name: string
): Promise<string> {
  if (stripeCustomerId) return stripeCustomerId;
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}
