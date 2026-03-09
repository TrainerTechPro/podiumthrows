import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
if (!APP_URL && process.env.NODE_ENV === "production") {
  console.warn("[email] NEXT_PUBLIC_APP_URL is not set — email links will use fallback URL");
}
const baseUrl = APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.SMTP_FROM || "Podium Throws <noreply@podiumthrows.com>";

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
  const inviteUrl = `${baseUrl}/register?invite=${token}`;

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
