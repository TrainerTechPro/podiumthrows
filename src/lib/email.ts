import nodemailer from "nodemailer";
import {
  wrapEmailHtml,
  welcomeCoachBody,
  welcomeAthleteBody,
  athleteJoinedBody,
  weeklyDigestBody,
  commentAddedBody,
  athleteWeeklyRecapBody,
  type WeeklyDigestData,
  type CommentAddedData,
  type AthleteWeeklyRecapEmailData,
} from "./email-templates";

import { logger } from "@/lib/logger";
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
  logger.error(
    "[email] CRITICAL: NEXT_PUBLIC_APP_URL is not set — password reset and invite links will point to localhost",
    { context: "email" }
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
 * Athlete weekly recap — Sunday evening retention email. Includes
 * RFC 2369 list-unsubscribe headers so Gmail/Outlook show the native
 * one-click unsubscribe control alongside the inline footer link.
 */
export async function sendAthleteWeeklyRecapEmail(
  to: string,
  data: AthleteWeeklyRecapEmailData
): Promise<void> {
  const subjectStat =
    data.prs.length > 0
      ? `New ${data.prs[0].distance.toFixed(2)}m PR`
      : data.sessionsLogged === 1
        ? "1 session this week"
        : `${data.sessionsLogged} sessions this week`;
  const subject = `Your week in throws — ${subjectStat}`;
  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    html: wrapEmailHtml(athleteWeeklyRecapBody(data, baseUrl), baseUrl),
    headers: {
      "List-Unsubscribe": `<${data.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/**
 * Pilot feedback notification — sent to the maintainer (FEEDBACK_RECIPIENT_EMAIL,
 * defaults to toncamedia@gmail.com) every time a beta tester submits via the
 * in-app feedback widget. Best-effort: caller invokes via waitUntil so a
 * mailer outage never blocks the user submission.
 */
export interface FeedbackEmailInput {
  feedbackId: string;
  type: "BUG" | "CONFUSION" | "FEATURE" | "PRAISE";
  body: string;
  url: string;
  viewport: string | null;
  userAgent: string | null;
  user: {
    name: string;
    email: string;
    role: string;
  };
  notionUrl: string | null;
  screenshotUrl: string | null;
  inboxUrl: string;
}

export async function sendBetaFeedbackEmail(input: FeedbackEmailInput): Promise<void> {
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL || "toncamedia@gmail.com";
  const typeLabel = {
    BUG: "🐞 Bug",
    CONFUSION: "❓ Confusing",
    FEATURE: "💡 Idea",
    PRAISE: "❤️ Praise",
  }[input.type];

  const preview = input.body.length > 60 ? input.body.slice(0, 57) + "…" : input.body;
  const subject = `[Pilot] ${typeLabel}: ${preview}`;

  const esc = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const screenshotBlock = input.screenshotUrl
    ? `<p style="margin: 16px 0;"><a href="${esc(input.screenshotUrl)}" style="color: #f59e0b;">View screenshot</a></p>`
    : "";

  const notionBlock = input.notionUrl
    ? `<a href="${esc(input.notionUrl)}" style="display: inline-block; background: #f59e0b; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 8px;">Open in Notion</a>`
    : "";

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="color: #a3a3a3; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px;">Pilot feedback · ${typeLabel}</p>
      <h1 style="color: #171717; font-size: 22px; margin: 0 0 16px; line-height: 1.3;">${esc(preview)}</h1>
      <div style="background: #fafafa; border-left: 3px solid #f59e0b; padding: 16px 20px; border-radius: 4px; color: #404040; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${esc(input.body)}</div>
      ${screenshotBlock}
      <table style="margin: 24px 0; border-collapse: collapse; font-size: 13px; color: #525252;">
        <tr><td style="padding: 4px 12px 4px 0; color: #a3a3a3;">From</td><td style="padding: 4px 0;">${esc(input.user.name)} &lt;${esc(input.user.email)}&gt; (${esc(input.user.role)})</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #a3a3a3;">Page</td><td style="padding: 4px 0;"><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${esc(input.url)}</code></td></tr>
        ${input.viewport ? `<tr><td style="padding: 4px 12px 4px 0; color: #a3a3a3;">Viewport</td><td style="padding: 4px 0;">${esc(input.viewport)}</td></tr>` : ""}
        ${input.userAgent ? `<tr><td style="padding: 4px 12px 4px 0; color: #a3a3a3; vertical-align: top;">UA</td><td style="padding: 4px 0; color: #737373; font-size: 11px;">${esc(input.userAgent)}</td></tr>` : ""}
        <tr><td style="padding: 4px 12px 4px 0; color: #a3a3a3;">ID</td><td style="padding: 4px 0; color: #737373; font-family: monospace; font-size: 11px;">${esc(input.feedbackId)}</td></tr>
      </table>
      <div style="margin-top: 24px;">
        ${notionBlock}
        <a href="${esc(input.inboxUrl)}" style="display: inline-block; background: #ffffff; color: #171717; border: 1px solid #d4d4d4; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open inbox</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: recipient,
    subject,
    html,
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
