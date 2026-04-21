import nodemailer from "nodemailer";
import {
  wrapEmailHtml,
  welcomeCoachBody,
  welcomeAthleteBody,
  athleteJoinedBody,
  weeklyDigestBody,
  commentAddedBody,
  type WeeklyDigestData,
  type CommentAddedData,
} from "./email-templates";

// Use Resend SMTP relay if RESEND_API_KEY is set (preferred),
// otherwise fall back to custom SMTP credentials.
const hasResend = Boolean(process.env.RESEND_API_KEY);

const transporter = nodemailer.createTransport(
  hasResend
    ? {
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY!,
        },
      }
    : {
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || "",
        },
      }
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
if (!APP_URL && process.env.NODE_ENV === "production") {
  // Use logger if available, but email.ts is imported early so logger may not be ready
  console.error(
    "[email] CRITICAL: NEXT_PUBLIC_APP_URL is not set — password reset and invite links will point to localhost"
  );
}
const baseUrl = APP_URL || "http://localhost:3000";
const FROM_EMAIL =
  process.env.RESEND_FROM || process.env.SMTP_FROM || "Podium Throws <noreply@podiumthrows.com>";

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Podium Throws password",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 16px;">Podium Throws</h1>
        <p style="color: #525252; font-size: 16px; line-height: 1.6;">
          You requested a password reset. Click the button below to set a new password.
          This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Reset Password
        </a>
        <p style="color: #a3a3a3; font-size: 14px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendInvitationEmail(
  email: string,
  coachName: string,
  token: string
): Promise<void> {
  // Points at the claim preview page (not /register directly). The preview
  // shows the athlete who invited them and what profile they're about to
  // claim before any credentials are entered — higher-trust UX.
  const inviteUrl = `${baseUrl}/athletes/claim/${token}`;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `${coachName} invited you to Podium Throws`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 16px;">Podium Throws</h1>
        <p style="color: #525252; font-size: 16px; line-height: 1.6;">
          <strong>${coachName}</strong> has invited you to join Podium Throws as an athlete.
          Click below to create your account.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Accept Invitation
        </a>
        <p style="color: #a3a3a3; font-size: 14px; margin-top: 24px;">
          This invitation expires in 7 days.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  role: "COACH" | "ATHLETE",
  coachName?: string
): Promise<void> {
  const body =
    role === "COACH"
      ? welcomeCoachBody(name, baseUrl)
      : welcomeAthleteBody(name, coachName || "your coach", baseUrl);

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: "Welcome to Podium Throws!",
    html: wrapEmailHtml(body, baseUrl),
  });
}

export async function sendAthleteJoinedEmail(
  coachEmail: string,
  athleteName: string
): Promise<void> {
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: coachEmail,
    subject: `${athleteName} joined your roster`,
    html: wrapEmailHtml(athleteJoinedBody(athleteName, baseUrl), baseUrl),
  });
}

export async function sendWeeklyDigestEmail(
  coachEmail: string,
  data: WeeklyDigestData
): Promise<void> {
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: coachEmail,
    subject: `Your weekly summary — ${data.sessionsCompleted} sessions, ${data.newPRs.length} PRs`,
    html: wrapEmailHtml(weeklyDigestBody(data, baseUrl), baseUrl),
  });
}

/**
 * Transactional email for a new comment on any training surface.
 * Subject prefixes the author name and preview. Body deep-links into the
 * recipient's inbox. Includes list-unsubscribe headers per RFC 2369 so
 * Gmail/Outlook surface the native one-click unsubscribe control.
 */
export async function sendCommentAddedEmail(
  toEmail: string,
  data: CommentAddedData
): Promise<void> {
  const truncated = data.preview.length > 40 ? data.preview.slice(0, 37) + "..." : data.preview;
  const subject = `${data.authorName}: ${truncated}`;
  const unsubUrl = `${baseUrl}/${data.isAthleteRecipient ? "athlete" : "coach"}/settings/notifications`;
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: toEmail,
    subject,
    html: wrapEmailHtml(commentAddedBody(data, baseUrl), baseUrl),
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
