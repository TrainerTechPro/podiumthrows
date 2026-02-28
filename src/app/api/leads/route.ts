import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, source, event, gender, deficitResult, utmSource, utmMedium, utmCampaign } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        source: source || "deficit-finder",
        event: event || null,
        gender: gender || null,
        deficitResult: deficitResult || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      },
    });

    // ─── EMAIL PROVIDER INTEGRATION POINT ───────────────────────────
    // TODO: Add ConvertKit/Mailchimp/Resend integration here.
    //
    // Example with ConvertKit:
    //   await fetch(`https://api.convertkit.com/v3/forms/${FORM_ID}/subscribe`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       api_key: process.env.CONVERTKIT_API_KEY,
    //       email: lead.email,
    //       first_name: lead.name,
    //       tags: [source],
    //       fields: { event, gender, deficit_type: deficitResult?.primary },
    //     }),
    //   });
    // ────────────────────────────────────────────────────────────────

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 }
    );
  }
}
