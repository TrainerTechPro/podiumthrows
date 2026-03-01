import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { stripe, PLANS } from "@/lib/stripe";
import type { PlanName } from "@/lib/stripe";
import { WelcomeClient } from "./_welcome-client";

export const metadata = {
  title: "Welcome — Podium Throws",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    redirect("/login");
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: {
      firstName: true,
      plan: true,
      leadId: true,
    },
  });

  if (!coach) redirect("/login");

  // Resolve plan — prefer Stripe checkout session (webhook may not have
  // fired yet) then fall back to DB value.
  let resolvedPlan: PlanName = coach.plan as PlanName;

  if (searchParams.session_id) {
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(
        searchParams.session_id
      );
      const stripePlan = checkoutSession.metadata?.plan as PlanName | undefined;
      if (stripePlan && stripePlan in PLANS) {
        resolvedPlan = stripePlan;
      }
    } catch {
      // Invalid/expired session_id — fall through to DB plan
    }
  }

  const planInfo = PLANS[resolvedPlan] ?? PLANS.FREE;

  // If the coach came through the deficit-finder funnel, fetch their lead data
  let deficitData: {
    primary: string;
    heavyRatio: number | null;
    squatBwRatio: number | null;
    distanceBand: string | null;
    overPowered: boolean;
    event: string | null;
    gender: string | null;
  } | null = null;

  if (coach.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: coach.leadId },
      select: {
        deficitResult: true,
        event: true,
        gender: true,
      },
    });

    if (lead?.deficitResult && typeof lead.deficitResult === "object") {
      const r = lead.deficitResult as Record<string, unknown>;
      deficitData = {
        primary: (r.primary as string) || "none",
        heavyRatio: (r.heavyRatio as number) ?? null,
        squatBwRatio: (r.squatBwRatio as number) ?? null,
        distanceBand: (r.distanceBand as string) ?? null,
        overPowered: (r.overPowered as boolean) ?? false,
        event: lead.event,
        gender: lead.gender,
      };
    }
  }

  return (
    <WelcomeClient
      firstName={coach.firstName}
      planName={planInfo.name}
      deficitData={deficitData}
    />
  );
}
