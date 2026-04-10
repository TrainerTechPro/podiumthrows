import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import type { PlanName } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/* ── Disable body parsing so we get the raw bytes for signature verification ── */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("stripe/webhook STRIPE_WEBHOOK_SECRET not set", { context: "api" });
    return NextResponse.json({ success: false, error: "Webhook secret not configured" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ success: false, error: "Missing stripe-signature header" }, { status: 400 });
  }

  /* ── Verify signature using raw body ── */
  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    logger.error("stripe/webhook Signature error", { context: "api", error: err });
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  /* ── Idempotency: skip already-processed events ── */
  const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    // P2002 = unique constraint violation (race between two concurrent deliveries)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  /* ── Route events — each handler isolated so one failure doesn't block others ── */
  const handlers: Record<string, () => Promise<void>> = {
    "checkout.session.completed": () =>
      handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session),
    "customer.subscription.updated": () =>
      handleSubscriptionUpdated(event.data.object as Stripe.Subscription),
    "customer.subscription.deleted": () =>
      handleSubscriptionDeleted(event.data.object as Stripe.Subscription),
    "invoice.payment_failed": () =>
      handleInvoicePaymentFailed(event.data.object as Stripe.Invoice),
  };

  const handler = handlers[event.type];
  if (handler) {
    try {
      await handler();
    } catch (err) {
      logger.error(`stripe/webhook Error handling ${event.type}`, { context: "api", error: err });
      return NextResponse.json({ success: false, error: "Webhook handler error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

/* ─────────────────────────────────────────────────────────────────────────── */

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const coachId = session.metadata?.coachId;
  const planKey = session.metadata?.plan as PlanName | undefined;

  if (!coachId || !planKey) {
    console.warn("[stripe/webhook] checkout.session.completed missing metadata", {
      coachId,
      planKey,
    });
    return;
  }

  /* Retrieve the subscription to get period end */
  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  await prisma.coachProfile.update({
    where: { id: coachId },
    data: {
      plan: planKey,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd,
    },
  });

  /* ── Mark lead as converted (if deficit-finder funnel) ── */
  const leadId = session.metadata?.leadId;
  if (leadId) {
    await prisma.lead.updateMany({
      where: { id: leadId, convertedToUser: false },
      data: { convertedToUser: true },
    });
  }

  console.log(`[stripe/webhook] Coach ${coachId} upgraded to ${planKey}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const coachId = subscription.metadata?.coachId;
  if (!coachId) {
    /* Fall back to looking up by stripeSubscriptionId */
    const coach = await prisma.coachProfile.findUnique({
      where: { stripeSubscriptionId: subscription.id },
      select: { id: true },
    });
    if (!coach) return;

    await updateCoachFromSubscription(coach.id, subscription);
    return;
  }
  await updateCoachFromSubscription(coachId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  /* Find coach by subscription ID */
  const coach = await prisma.coachProfile.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  if (!coach) return;

  await prisma.coachProfile.update({
    where: { id: coach.id },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    },
  });

  // Revoke pending invitations that can no longer be honored
  await prisma.invitation.updateMany({
    where: { coachId: coach.id, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  console.log(`[stripe/webhook] Coach ${coach.id} downgraded to FREE (subscription deleted)`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;

  if (!customerId) return;

  const coach = await prisma.coachProfile.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!coach) return;

  await prisma.coachProfile.update({
    where: { id: coach.id },
    data: { paymentFailedAt: new Date() },
  });

  console.warn(
    `[stripe/webhook] Invoice payment failed for coach ${coach.id} (customer ${customerId})`
  );
}

/* ── Shared helper to update plan from subscription object ── */
async function updateCoachFromSubscription(
  coachId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const planKey = priceId ? getPlanFromPriceId(priceId) : null;
  if (!planKey) {
    console.warn(
      `[stripe/webhook] Unrecognized price ID ${priceId} for coach ${coachId}`
    );
    return;
  }

  const periodEnd = subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  /* Handle cancellation at period end gracefully */
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  await prisma.coachProfile.update({
    where: { id: coachId },
    data: {
      plan: isActive ? planKey : "FREE",
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: isActive ? currentPeriodEnd : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(isActive ? { paymentFailedAt: null } : {}),
    },
  });

  console.log(
    `[stripe/webhook] Coach ${coachId} plan set to ${isActive ? planKey : "FREE"}`
  );
}
