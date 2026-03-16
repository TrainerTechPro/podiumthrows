import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

// Once you verify your domain in Resend, change this to noreply@podiumthrows.com
const FROM_EMAIL = process.env.RESEND_FROM || "Podium Throws <onboarding@resend.dev>";

const EVENT_LABELS: Record<string, string> = {
  SP: "Shot Put", DT: "Discus", HT: "Hammer", JT: "Javelin",
};

const DEFICIT_LABELS: Record<string, string> = {
  heavy_implement: "Heavy Implement Deficit",
  light_implement: "Light Implement Deficit",
  strength: "Strength Deficit",
  balanced: "Balanced Profile",
  none: "Insufficient Data",
};

const DEFICIT_COLORS: Record<string, string> = {
  heavy_implement: "#f59e0b",
  light_implement: "#3b82f6",
  strength: "#ef4444",
  balanced: "#22c55e",
  none: "#737373",
};

const RECOMMENDATIONS: Record<string, string> = {
  heavy_implement:
    "Increase heavy implement proportion to 35-45% of total throws. Add heavy implement-specific drills (standing throws, power position) with the overweight implement 3-4x per week.",
  light_implement:
    "Increase light implement proportion to 30-40% of total throws. Focus on technical speed, rhythm, and full-throw execution with light implements.",
  strength:
    "Add 3-4 strength sessions per week with emphasis on squat and power clean. Target a minimum squat-to-bodyweight ratio improvement of 0.2 over the next training block.",
  balanced:
    "Maintain current implement and strength distribution. Focus on technical refinement, competition-specific volume, and peaking strategy for upcoming meets.",
  none: "Record at least one set of implement PRs and strength test data for a complete analysis.",
};

function buildDeficitEmail(
  leadId: string,
  name: string | null,
  event: string | null,
  gender: string | null,
  result: Record<string, unknown> | null
): string {
  const greeting = name ? `Hi ${name},` : "Hi Coach,";
  const primary = (result?.primary as string) || "none";
  const label = DEFICIT_LABELS[primary] || "Analysis";
  const color = DEFICIT_COLORS[primary] || "#f59e0b";
  const rec = RECOMMENDATIONS[primary] || "";
  const eventLabel = event ? EVENT_LABELS[event] || event : "";
  const genderLabel = gender === "M" ? "Men's" : gender === "F" ? "Women's" : "";
  const band = (result?.distanceBand as string) || "";
  const context = [eventLabel, genderLabel, band ? `${band}m band` : ""].filter(Boolean).join(" · ");

  const heavyRatio = result?.heavyRatio as number | null;
  const squatBwRatio = result?.squatBwRatio as number | null;
  const overPowered = result?.overPowered as boolean | undefined;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0; padding:0; background:#0d0c09; font-family:'Segoe UI',Tahoma,sans-serif;">
<div style="max-width:560px; margin:0 auto; padding:40px 24px;">

  <!-- Logo -->
  <div style="text-align:center; margin-bottom:32px;">
    <span style="color:#f59e0b; font-size:20px; font-weight:700;">Podium Throws</span>
  </div>

  <!-- Greeting -->
  <p style="color:#f0ede6; font-size:16px; line-height:1.6; margin-bottom:4px;">
    ${greeting}
  </p>
  <p style="color:#8a8278; font-size:15px; line-height:1.6; margin-bottom:28px;">
    Here are your Bondarchuk Deficit Analysis results.
  </p>

  <!-- Result card -->
  <div style="background:#1a1714; border:1px solid #2a2720; border-radius:12px; padding:24px; margin-bottom:24px;">
    <p style="color:rgba(245,158,11,0.8); font-size:11px; text-transform:uppercase; letter-spacing:2px; margin:0 0 4px;">
      Deficit Analysis
    </p>
    <h2 style="color:#f0ede6; font-size:22px; font-weight:700; margin:0 0 16px;">
      ${label}
    </h2>

    ${context ? `<p style="color:#6b655a; font-size:13px; margin:0 0 16px;">${context}</p>` : ""}

    <!-- Metrics -->
    <div style="border-top:1px solid #2a2720; border-bottom:1px solid #2a2720; padding:16px 0; margin-bottom:16px;">
      <table style="width:100%;"><tr>
        ${heavyRatio !== null ? `
        <td style="vertical-align:top;">
          <p style="color:#6b655a; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 4px;">Heavy Impl. Ratio</p>
          <p style="color:${color}; font-size:24px; font-weight:700; margin:0;">${(heavyRatio * 100).toFixed(1)}%</p>
        </td>` : ""}
        ${squatBwRatio !== null ? `
        <td style="vertical-align:top;">
          <p style="color:#6b655a; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 4px;">Squat-to-BW</p>
          <p style="color:${color}; font-size:24px; font-weight:700; margin:0;">${squatBwRatio.toFixed(2)}x</p>
        </td>` : ""}
      </tr></table>
    </div>

    ${overPowered ? `
    <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.15); border-radius:8px; padding:12px 16px; margin-bottom:16px;">
      <p style="color:#ef4444; font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:600; margin:0 0 4px;">Overpowered Flag</p>
      <p style="color:#a09a90; font-size:14px; line-height:1.5; margin:0;">
        Strength exceeds target while implement marks are below. Shift volume from general preparation to specific developmental exercises.
      </p>
    </div>` : ""}

    <!-- Recommendation -->
    <div style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.12); border-radius:8px; padding:12px 16px;">
      <p style="color:#f59e0b; font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:600; margin:0 0 4px;">Training Recommendation</p>
      <p style="color:#a09a90; font-size:14px; line-height:1.5; margin:0;">
        ${rec}
      </p>
    </div>
  </div>

  <!-- CTA -->
  <div style="text-align:center; margin:32px 0;">
    <p style="color:#8a8278; font-size:14px; margin-bottom:16px;">
      Want to track deficits across your entire roster automatically?
    </p>
    <a href="https://podiumthrows.com/register?leadId=${leadId}" style="display:inline-block; background:#f59e0b; color:#0d0c09; padding:14px 32px; font-weight:700; font-size:15px; text-decoration:none;">
      Start Your Free Trial
    </a>
  </div>

  <!-- Footer -->
  <p style="color:#5a554e; font-size:12px; text-align:center; margin-top:40px; border-top:1px solid #1a1714; padding-top:20px;">
    Built on the methodology behind 80+ Olympic medals in throwing events.<br/>
    &copy; ${new Date().getFullYear()} Podium Throws. All rights reserved.
  </p>

</div>
</body>
</html>`;
}

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

    // Send deficit report email via Resend
    if (process.env.RESEND_API_KEY) {
      const primary = (deficitResult?.primary as string) || "none";
      const deficitLabel = DEFICIT_LABELS[primary] || "Analysis";

      await resend.emails.send({
        from: FROM_EMAIL,
        to: lead.email,
        subject: `Your Deficit Analysis: ${deficitLabel}`,
        html: buildDeficitEmail(lead.id, lead.name, event, gender, deficitResult),
      }).catch((err) => {
        // Log but don't fail the request — the lead is already saved
        logger.error("Resend email error", { context: "api", error: err });
      });
    }

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error) {
    logger.error("Lead capture error", { context: "api", error });
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 }
    );
  }
}
