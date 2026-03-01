import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    /* ── Auth ── */
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { stripeCustomerId: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }
    if (!coach.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please upgrade to a paid plan first." },
        { status: 400 }
      );
    }

    /* ── Create portal session ── */
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
    if (!APP_URL && process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
    }
    const returnUrl = `${APP_URL || "http://localhost:3000"}/coach/settings`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: coach.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[POST /api/stripe/portal]", err);
    return NextResponse.json({ error: "Could not create billing portal session." }, { status: 500 });
  }
}
