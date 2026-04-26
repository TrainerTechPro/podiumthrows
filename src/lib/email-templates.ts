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

export interface AthleteWeeklyRecapEmailData {
  firstName: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  sessionsLogged: number;
  sessionsScheduled: number;
  throwsLogged: number;
  prs: { event: string; implement: string; distance: number }[];
  streakEnd: number;
  streakDelta: number;
  readinessAvg: number | null;
  shoutout: string;
  nextWeekSessionsCount: number;
  unsubscribeUrl: string;
  preferencesUrl: string;
}

function eventLabelEmail(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateRangeEmail(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function recapHero(data: AthleteWeeklyRecapEmailData): { value: string; label: string } {
  if (data.prs.length > 0) {
    const top = data.prs[0];
    return { value: `${top.distance.toFixed(2)}m`, label: `New ${eventLabelEmail(top.event)} PR` };
  }
  if (data.throwsLogged >= 50) {
    return { value: String(data.throwsLogged), label: "throws this week" };
  }
  if (data.streakEnd > 0) {
    return {
      value: String(data.streakEnd),
      label: `day streak${data.streakDelta > 0 ? ` (+${data.streakDelta})` : ""}`,
    };
  }
  return { value: String(data.sessionsLogged), label: "sessions logged" };
}

export function athleteWeeklyRecapBody(data: AthleteWeeklyRecapEmailData, baseUrl: string): string {
  const hero = recapHero(data);
  const dateRange = formatDateRangeEmail(data.weekStart, data.weekEnd);

  const highlights: string[] = [];
  if (data.prs.length > 0) {
    const top = data.prs[0];
    highlights.push(
      `<strong style="color:#f59e0b;">${top.distance.toFixed(2)}m</strong> ${esc(eventLabelEmail(top.event))} PR (${esc(top.implement)})`
    );
  }
  highlights.push(
    `<strong style="color:#f0ede6;">${data.sessionsLogged}</strong> session${
      data.sessionsLogged === 1 ? "" : "s"
    } logged${data.sessionsScheduled > 0 ? ` of ${data.sessionsScheduled} planned` : ""}`
  );
  if (data.throwsLogged > 0) {
    highlights.push(
      `<strong style="color:#f0ede6;">${data.throwsLogged}</strong> throw${
        data.throwsLogged === 1 ? "" : "s"
      } on the field`
    );
  }
  if (data.streakEnd > 0) {
    highlights.push(
      `<strong style="color:#f0ede6;">${data.streakEnd}</strong>-day streak${
        data.streakDelta > 0 ? ` — extended ${data.streakDelta}` : ""
      }`
    );
  }
  if (data.readinessAvg !== null) {
    highlights.push(
      `Readiness averaged <strong style="color:#f0ede6;">${data.readinessAvg.toFixed(1)}</strong>/10`
    );
  }
  while (highlights.length > 5) highlights.pop();

  const highlightsHtml = highlights
    .map(
      (h, i) =>
        `<tr><td style="width:24px; vertical-align:top; padding:6px 0; color:#6b6560; font-size:13px; font-variant-numeric:tabular-nums;">${i + 1}.</td><td style="padding:6px 0; color:#e5e1d8; font-size:15px; line-height:1.6;">${h}</td></tr>`
    )
    .join("");

  const nextWeekCopy =
    data.nextWeekSessionsCount > 0
      ? `<strong style="color:#f0ede6;">${data.nextWeekSessionsCount}</strong> session${
          data.nextWeekSessionsCount === 1 ? "" : "s"
        } on the board next week.`
      : `Nothing scheduled yet next week — log one Monday to get a fresh start.`;

  return `
    <p style="color:#6b6560; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; margin:0 0 8px 0;">
      Your week in throws · ${esc(dateRange)}
    </p>
    <h2 style="color:#f0ede6; font-size:22px; margin:0 0 24px 0; line-height:1.25;">
      ${esc(data.firstName)}, here&#39;s how it went.
    </h2>

    <div style="text-align:center; padding:24px 0 28px 0; border-top:1px solid #2a2520; border-bottom:1px solid #2a2520; margin-bottom:24px;">
      <p style="color:#f59e0b; font-size:48px; font-weight:700; margin:0; letter-spacing:-1px; line-height:1;">${esc(hero.value)}</p>
      <p style="color:#a3a097; font-size:13px; margin:8px 0 0 0; letter-spacing:0.5px;">${esc(hero.label)}</p>
    </div>

    <table role="presentation" style="width:100%; border-collapse:collapse; margin:0 0 24px 0;">
      ${highlightsHtml}
    </table>

    <blockquote style="border-left:3px solid #f59e0b; margin:0 0 28px 0; padding:6px 0 6px 16px; color:#e5e1d8; font-size:15px; line-height:1.5; font-style:italic;">
      ${esc(data.shoutout)}
    </blockquote>

    <p style="color:#a3a097; font-size:14px; margin:0 0 28px 0; line-height:1.6;">
      ${nextWeekCopy}
    </p>

    ${ctaButton(`${baseUrl}/athlete/dashboard?recap=${esc(data.weekStart)}`, "Open Podium")}

    <p style="color:#6b6560; font-size:12px; margin:32px 0 0 0; line-height:1.6; text-align:center;">
      <a href="${esc(data.preferencesUrl)}" style="color:#a3a097; text-decoration:underline;">Notification settings</a>
      &nbsp;·&nbsp;
      <a href="${esc(data.unsubscribeUrl)}" style="color:#a3a097; text-decoration:underline;">Unsubscribe from weekly recaps</a>
    </p>
  `;
}

export interface CommentAddedData {
  authorName: string;
  surfaceLabel: string; // e.g. "a throw", "a training session"
  preview: string;
  commentId: string;
  /** True when the recipient is an athlete (affects deep link + header copy). */
  isAthleteRecipient: boolean;
}

export function commentAddedBody(data: CommentAddedData, baseUrl: string): string {
  const inboxUrl = data.isAthleteRecipient
    ? `${baseUrl}/athlete/feedback`
    : `${baseUrl}/coach/feedback-inbox`;
  const header = data.isAthleteRecipient
    ? `Coach ${esc(data.authorName)} left a comment`
    : `${esc(data.authorName)} left a comment`;
  return `
    <h2 style="color:#f0ede6; font-size:20px; margin:0 0 4px 0;">${header}</h2>
    <p style="color:#6b6560; font-size:14px; margin:0 0 20px 0;">on ${esc(data.surfaceLabel)}</p>
    <blockquote style="border-left:3px solid #f59e0b; margin:0 0 24px 0; padding:4px 0 4px 16px; color:#e5e1d8; font-size:15px; line-height:1.6;">
      ${esc(data.preview)}
    </blockquote>
    ${ctaButton(inboxUrl, "View & Reply")}
    <p style="color:#6b6560; font-size:13px; margin:16px 0 0 0; line-height:1.5;">
      You can adjust email preferences any time from your settings.
    </p>
  `;
}
