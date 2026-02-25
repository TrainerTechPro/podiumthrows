import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import type { PlanName } from "@/lib/stripe";

/* ── Disable body parsing so we get the raw bytes for signature verification ── */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  /* ── Verify signature using raw body ── */
  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe/webhook] Signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  /* ── Route events ── */
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unknown event — ignore
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
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

  // Log the failure. In production you might send an email here.
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
    },
  });

  console.log(
    `[stripe/webhook] Coach ${coachId} plan set to ${isActive ? planKey : "FREE"}`
  );
}
