import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features will not work");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

export const PLANS = {
  FREE: {
    name: "Free",
    maxAthletes: 3,
    priceId: null,
    monthlyPrice: 0,
    description: "Get started with up to 3 athletes.",
  },
  PRO: {
    name: "Pro",
    maxAthletes: 25,
    priceId: process.env.STRIPE_PRICE_PRO || null,
    monthlyPrice: 49,
    description: "For growing programs up to 25 athletes.",
  },
  ELITE: {
    name: "Elite",
    maxAthletes: Infinity,
    priceId: process.env.STRIPE_PRICE_ELITE || null,
    monthlyPrice: 99,
    description: "Unlimited athletes, priority support.",
  },
} as const;

export type PlanName = keyof typeof PLANS;

/** Resolve a Stripe price ID → plan name. Returns null if unrecognized. */
export function getPlanFromPriceId(priceId: string): PlanName | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_ELITE) return "ELITE";
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
