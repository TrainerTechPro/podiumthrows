import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stripe, PLANS, getOrCreateStripeCustomer } from "@/lib/stripe";
import type { PlanName } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
if (!APP_URL && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
}
const baseUrl = APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    /* ── Auth ── */
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ── Validate plan param ── */
    const body = await req.json().catch(() => ({}));
    const planKey = (body.plan as string)?.toUpperCase() as PlanName | undefined;
    if (!planKey || planKey === "FREE" || !PLANS[planKey]) {
      return NextResponse.json(
        { error: "Invalid plan. Must be PRO or ELITE." },
        { status: 400 }
      );
    }

    const priceId = PLANS[planKey].priceId;
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID for ${planKey} not configured.` },
        { status: 500 }
      );
    }

    /* ── Get coach ── */
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
        plan: true,
      },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    /* ── Get or create Stripe customer ── */
    const customerId = await getOrCreateStripeCustomer(
      coach.stripeCustomerId,
      session.email,
      `${coach.firstName} ${coach.lastName}`
    );

    /* ── Persist customer ID if newly created ── */
    if (!coach.stripeCustomerId) {
      await prisma.coachProfile.update({
        where: { id: coach.id },
        data: { stripeCustomerId: customerId },
      });
    }

    /* ── Create Checkout session ── */
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { coachId: coach.id, plan: planKey },
      subscription_data: { metadata: { coachId: coach.id, plan: planKey } },
      success_url: `${baseUrl}/coach/settings?upgraded=1`,
      cancel_url: `${baseUrl}/coach/settings`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[POST /api/stripe/checkout]", err);
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 }
    );
  }
}
