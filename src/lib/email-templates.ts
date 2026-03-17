/** Escape user-provided strings before injecting into HTML emails. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps email body HTML in a consistent dark-themed layout with
 * Podium Throws branding, header, and footer.
 *
 * @param body - Inner HTML content (already escaped where needed)
 * @param baseUrl - Resolved app URL, passed from email.ts to avoid duplication
 */
export function wrapEmailHtml(body: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background:#0d0c09; font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:40px 24px;">
    <div style="text-align:center; margin-bottom:32px;">
      <h1 style="color:#f59e0b; font-size:28px; margin:0; font-weight:700; letter-spacing:-0.5px;">Podium Throws</h1>
    </div>
    <div style="background:#1a1714; border-radius:12px; padding:32px; border:1px solid #2a2520;">
      ${body}
    </div>
    <div style="text-align:center; margin-top:32px; padding-top:24px; border-top:1px solid #2a2520;">
      <p style="color:#6b6560; font-size:13px; line-height:1.5; margin:0;">
        Podium Throws — Built for elite throws coaches
      </p>
      <p style="color:#6b6560; font-size:13px; margin:8px 0 0 0;">
        <a href="${baseUrl}/coach/settings" style="color:#f59e0b; text-decoration:underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block; background:#f59e0b; color:#0d0c09; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px; margin:24px 0;">${esc(label)}</a>`;
}

/* ─── Body builders ─────────────────────────────────────────── */

export function welcomeCoachBody(name: string, baseUrl: string): string {
  return `
    <h2 style="color:#f0ede6; font-size:20px; margin:0 0 16px 0;">Welcome, Coach ${esc(name)}!</h2>
    <p style="color:#c4bfb8; font-size:15px; line-height:1.6; margin:0 0 8px 0;">
      Your Podium Throws account is ready. Start by inviting your athletes
      and building your first throws session.
    </p>
    <p style="color:#c4bfb8; font-size:15px; line-height:1.6; margin:0 0 8px 0;">
      Every feature is designed around the Bondarchuk methodology — proper
      implement sequencing, transfer exercises, and periodization built in.
    </p>
    ${ctaButton(`${baseUrl}/coach/onboarding/welcome`, "Get Started")}
  `;
}

export function welcomeAthleteBody(name: string, coachName: string, baseUrl: string): string {
  return `
    <h2 style="color:#f0ede6; font-size:20px; margin:0 0 16px 0;">Welcome, ${esc(name)}!</h2>
    <p style="color:#c4bfb8; font-size:15px; line-height:1.6; margin:0 0 8px 0;">
      Coach ${esc(coachName)} has added you to their Podium Throws roster.
      You'll receive training sessions, check-in forms, and progress
      tracking — all in one place.
    </p>
    ${ctaButton(`${baseUrl}/athlete/onboarding`, "View Your Dashboard")}
  `;
}

export function athleteJoinedBody(athleteName: string, baseUrl: string): string {
  return `
    <h2 style="color:#f0ede6; font-size:20px; margin:0 0 16px 0;">New Athlete Joined</h2>
    <p style="color:#c4bfb8; font-size:15px; line-height:1.6; margin:0 0 8px 0;">
      <strong style="color:#f0ede6;">${esc(athleteName)}</strong> accepted your invitation
      and is now on your roster.
    </p>
    ${ctaButton(`${baseUrl}/coach/athletes`, "View Roster")}
  `;
}

export interface WeeklyDigestData {
  coachName: string;
  athleteCount: number;
  sessionsCompleted: number;
  newPRs: { athleteName: string; event: string; distance: number }[];
  lowReadiness: { athleteName: string; score: number }[];
  newAthletes: string[];
}

export function weeklyDigestBody(data: WeeklyDigestData, baseUrl: string): string {
  function statCell(label: string, value: string | number): string {
    return `<td style="text-align:center; padding:12px 0;">
      <div style="color:#f59e0b; font-size:24px; font-weight:700;">${value}</div>
      <div style="color:#6b6560; font-size:13px; margin-top:4px;">${esc(label)}</div>
    </td>`;
  }

  const stats = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px 0; border-top:1px solid #2a2520; border-bottom:1px solid #2a2520;">
      <tr>
        ${statCell("Athletes", data.athleteCount)}
        ${statCell("Sessions", data.sessionsCompleted)}
        ${statCell("New PRs", data.newPRs.length)}
      </tr>
    </table>`;

  let sections = "";

  if (data.newPRs.length > 0) {
    const prRows = data.newPRs
      .slice(0, 5)
      .map(
        (pr) =>
          `<li style="color:#c4bfb8; font-size:14px; padding:4px 0;"><strong style="color:#f0ede6;">${esc(pr.athleteName)}</strong> — ${esc(pr.event)} ${pr.distance}m</li>`
      )
      .join("");
    sections += `
      <div style="margin-bottom:20px;">
        <h3 style="color:#f59e0b; font-size:15px; margin:0 0 8px 0;">New PRs</h3>
        <ul style="margin:0; padding-left:20px;">${prRows}</ul>
      </div>`;
  }

  if (data.lowReadiness.length > 0) {
    const readinessRows = data.lowReadiness
      .slice(0, 5)
      .map(
        (r) =>
          `<li style="color:#c4bfb8; font-size:14px; padding:4px 0;"><strong style="color:#f0ede6;">${esc(r.athleteName)}</strong> — readiness score ${r.score}/10</li>`
      )
      .join("");
    sections += `
      <div style="margin-bottom:20px;">
        <h3 style="color:#e05252; font-size:15px; margin:0 0 8px 0;">Low Readiness</h3>
        <ul style="margin:0; padding-left:20px;">${readinessRows}</ul>
      </div>`;
  }

  if (data.newAthletes.length > 0) {
    const names = data.newAthletes.map(esc).join(", ");
    sections += `
      <div style="margin-bottom:20px;">
        <h3 style="color:#f0ede6; font-size:15px; margin:0 0 8px 0;">New Athletes</h3>
        <p style="color:#c4bfb8; font-size:14px; margin:0;">${names}</p>
      </div>`;
  }

  return `
    <h2 style="color:#f0ede6; font-size:20px; margin:0 0 4px 0;">Weekly Summary</h2>
    <p style="color:#6b6560; font-size:14px; margin:0 0 16px 0;">Hey Coach ${esc(data.coachName)}, here's your week at a glance.</p>
    ${stats}
    ${sections}
    ${ctaButton(`${baseUrl}/coach/dashboard`, "Open Dashboard")}
  `;
}
