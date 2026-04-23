import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

// NOTE: Follows the mock-Prisma pattern used by
// src/app/api/insights/[id]/read/__tests__/read.test.ts rather than a live
// test DB. Keeps the revenue-path tests hermetic and runnable in CI without
// a Postgres container.

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  getPlanFromPriceId: vi.fn(),
  stripeEventFindUnique: vi.fn(),
  stripeEventCreate: vi.fn(),
  coachProfileUpdate: vi.fn(),
  coachProfileFindUnique: vi.fn(),
  leadUpdateMany: vi.fn(),
  invitationUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    stripeEvent: {
      findUnique: (...a: unknown[]) => mocks.stripeEventFindUnique(...a),
      create: (...a: unknown[]) => mocks.stripeEventCreate(...a),
    },
    coachProfile: {
      update: (...a: unknown[]) => mocks.coachProfileUpdate(...a),
      findUnique: (...a: unknown[]) => mocks.coachProfileFindUnique(...a),
    },
    lead: {
      updateMany: (...a: unknown[]) => mocks.leadUpdateMany(...a),
    },
    invitation: {
      updateMany: (...a: unknown[]) => mocks.invitationUpdateMany(...a),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: (...a: unknown[]) => mocks.constructEvent(...a) },
    subscriptions: { retrieve: (...a: unknown[]) => mocks.subscriptionsRetrieve(...a) },
  },
  getPlanFromPriceId: (...a: unknown[]) => mocks.getPlanFromPriceId(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from "../route";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeRequest(body: string, sig: string | null): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (sig !== null) headers.set("stripe-signature", sig);
  return new NextRequest("http://test/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

function checkoutCompletedEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
  return {
    id: "evt_checkout_123",
    type: "checkout.session.completed",
    api_version: "2026-01-28.clover",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        mode: "subscription",
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { coachId: "coach_abc", plan: "PRO" },
      } as unknown as Stripe.Checkout.Session,
    },
    ...overrides,
  } as Stripe.Event;
}

function subscriptionUpdatedEvent(subscription: Partial<Stripe.Subscription>): Stripe.Event {
  return {
    id: "evt_sub_updated_456",
    type: "customer.subscription.updated",
    api_version: "2026-01-28.clover",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: subscription as Stripe.Subscription },
  } as Stripe.Event;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  });

  it("(a) valid signature + checkout.session.completed → coach upgraded to PRO", async () => {
    const event = checkoutCompletedEvent();
    mocks.constructEvent.mockReturnValue(event);
    mocks.stripeEventFindUnique.mockResolvedValue(null);
    mocks.stripeEventCreate.mockResolvedValue({ id: event.id });
    mocks.subscriptionsRetrieve.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as unknown as Stripe.Subscription);
    mocks.coachProfileUpdate.mockResolvedValue({ id: "coach_abc" });

    const res = await POST(makeRequest(JSON.stringify(event), "t=1,v1=good"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    expect(mocks.coachProfileUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mocks.coachProfileUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "coach_abc" });
    expect(updateArg.data.plan).toBe("PRO");
    expect(updateArg.data.stripeCustomerId).toBe("cus_123");
    expect(updateArg.data.stripeSubscriptionId).toBe("sub_123");
    expect(updateArg.data.currentPeriodEnd).toEqual(new Date(1_800_000_000 * 1000));

    // Idempotency record was written.
    expect(mocks.stripeEventCreate).toHaveBeenCalledWith({
      data: { id: event.id, type: event.type },
    });
  });

  it("(b) invalid signature → 400 and no DB writes", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const res = await POST(makeRequest('{"fake":"body"}', "t=1,v1=BAD"));
    expect(res.status).toBe(400);

    // Critical: no idempotency record, no coach update, no handler side effects.
    expect(mocks.stripeEventFindUnique).not.toHaveBeenCalled();
    expect(mocks.stripeEventCreate).not.toHaveBeenCalled();
    expect(mocks.coachProfileUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("(c) idempotency — duplicate event via findUnique skips the handler", async () => {
    const event = checkoutCompletedEvent();
    mocks.constructEvent.mockReturnValue(event);
    // Simulate the event having been processed already.
    mocks.stripeEventFindUnique.mockResolvedValue({
      id: event.id,
      type: event.type,
      processedAt: new Date(),
    });

    const res = await POST(makeRequest(JSON.stringify(event), "t=1,v1=good"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, duplicate: true });

    // No insert, no handler side effects.
    expect(mocks.stripeEventCreate).not.toHaveBeenCalled();
    expect(mocks.coachProfileUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("(c2) idempotency race — P2002 on stripeEvent.create returns duplicate", async () => {
    const event = checkoutCompletedEvent();
    mocks.constructEvent.mockReturnValue(event);
    mocks.stripeEventFindUnique.mockResolvedValue(null);
    mocks.stripeEventCreate.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`id`)",
        { code: "P2002", clientVersion: "5.0.0" }
      );
    });

    const res = await POST(makeRequest(JSON.stringify(event), "t=1,v1=good"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, duplicate: true });

    // The handler must NOT proceed to the event-specific side effects after P2002.
    expect(mocks.coachProfileUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("(d) customer.subscription.updated with status=canceled flips plan to FREE", async () => {
    // IMPORTANT: The current handler does NOT mark athletes as over-quota on
    // downgrade — it only updates `plan`, `currentPeriodEnd`, and
    // `cancelAtPeriodEnd` on CoachProfile. Over-limit enforcement lives
    // elsewhere (invitation creation, roster admission). These assertions
    // reflect the handler as written; if over-quota marking is added later,
    // this test should be extended — don't infer behavior that isn't there.
    const event = subscriptionUpdatedEvent({
      id: "sub_pro_downgrade",
      status: "canceled",
      cancel_at_period_end: false,
      metadata: { coachId: "coach_over_limit" },
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            price: { id: "price_pro_monthly" },
          },
        ],
      },
    } as unknown as Stripe.Subscription);

    mocks.constructEvent.mockReturnValue(event);
    mocks.stripeEventFindUnique.mockResolvedValue(null);
    mocks.stripeEventCreate.mockResolvedValue({ id: event.id });
    // Price resolves to PRO, but status=canceled forces isActive=false so plan=FREE.
    mocks.getPlanFromPriceId.mockReturnValue("PRO");
    mocks.coachProfileUpdate.mockResolvedValue({ id: "coach_over_limit" });

    const res = await POST(makeRequest(JSON.stringify(event), "t=1,v1=good"));
    expect(res.status).toBe(200);

    expect(mocks.coachProfileUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mocks.coachProfileUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "coach_over_limit" });
    expect(updateArg.data.plan).toBe("FREE");
    expect(updateArg.data.stripeSubscriptionId).toBe("sub_pro_downgrade");
    expect(updateArg.data.currentPeriodEnd).toBeNull();
    expect(updateArg.data.cancelAtPeriodEnd).toBe(false);

    // No invitation revocation on `subscription.updated` — that only fires on
    // `subscription.deleted`. Proving the handler doesn't over-reach.
    expect(mocks.invitationUpdateMany).not.toHaveBeenCalled();
  });
});
