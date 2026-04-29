/**
 * Mirror a BetaFeedback row to a Notion database. Soft-fails: any error
 * (missing token, schema mismatch, network) is logged and swallowed —
 * the user-facing submission is unaffected because the caller invokes
 * us via `waitUntil`.
 *
 * Reuses the existing "User Feedback" data source by default
 * (d92a0779-d139-427c-be30-24cded5707c2 — see CLAUDE.md §Notion Activity
 * Logging). Override with NOTION_FEEDBACK_DATA_SOURCE_ID if pilot
 * feedback ever needs its own database.
 *
 * Property mapping is intentionally minimal: every Notion DB has a Title
 * (the primary property), and we put everything else into the page body
 * so this works regardless of how the target DB's columns are configured.
 * If the DB has a Type/Status select, the operator can wire a database
 * automation to populate them from the page body — that's a Notion-side
 * concern, not ours.
 */

import { logger } from "@/lib/logger";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DEFAULT_DATA_SOURCE_ID = "d92a0779-d139-427c-be30-24cded5707c2";

export interface FeedbackMirrorInput {
  feedbackId: string;
  type: "BUG" | "CONFUSION" | "FEATURE" | "PRAISE";
  body: string;
  url: string;
  userAgent: string | null;
  viewport: string | null;
  consoleErrors: Array<{ message: string; timestamp?: number }> | null;
  screenshotUrl: string | null;
  /** Authed user info captured at submit time. */
  user: {
    userId: string;
    email: string;
    name: string;
    role: "COACH" | "ATHLETE" | string;
  };
  createdAt: Date;
}

export interface NotionMirrorResult {
  pageId: string;
  pageUrl: string;
}

const TYPE_EMOJI: Record<FeedbackMirrorInput["type"], string> = {
  BUG: "🐞",
  CONFUSION: "❓",
  FEATURE: "💡",
  PRAISE: "❤️",
};

const TYPE_LABEL: Record<FeedbackMirrorInput["type"], string> = {
  BUG: "Bug",
  CONFUSION: "Confusing",
  FEATURE: "Idea",
  PRAISE: "Praise",
};

function paragraph(text: string): unknown {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
    },
  };
}

function heading(text: string): unknown {
  return {
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function bullet(text: string): unknown {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }],
    },
  };
}

function imageBlock(url: string): unknown {
  return {
    object: "block",
    type: "image",
    image: { type: "external", external: { url } },
  };
}

export async function mirrorFeedbackToNotion(
  input: FeedbackMirrorInput
): Promise<NotionMirrorResult | null> {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    logger.debug("NOTION_TOKEN not set — skipping feedback mirror", {
      context: "feedback/notion-mirror",
    });
    return null;
  }

  const dataSourceId = process.env.NOTION_FEEDBACK_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;

  const titleEmoji = TYPE_EMOJI[input.type];
  const titleLabel = TYPE_LABEL[input.type];
  const bodyPreview = input.body.length > 80 ? input.body.slice(0, 77) + "…" : input.body;
  const title = `${titleEmoji} [${titleLabel}] ${bodyPreview}`;

  const children: unknown[] = [
    paragraph(input.body),
    heading("Context"),
    bullet(`User: ${input.user.name} <${input.user.email}> (${input.user.role})`),
    bullet(`Page: ${input.url}`),
    bullet(`Submitted: ${input.createdAt.toISOString()}`),
    bullet(`Feedback ID: ${input.feedbackId}`),
  ];

  if (input.viewport) children.push(bullet(`Viewport: ${input.viewport}`));
  if (input.userAgent) children.push(bullet(`User agent: ${input.userAgent}`));

  if (input.consoleErrors && input.consoleErrors.length > 0) {
    children.push(heading("Recent console errors"));
    for (const err of input.consoleErrors.slice(0, 10)) {
      children.push(bullet(err.message));
    }
  }

  if (input.screenshotUrl) {
    children.push(heading("Screenshot"));
    children.push(imageBlock(input.screenshotUrl));
  }

  // Body shape uses parent.data_source_id (newer Notion API). The public
  // `database_id` form still works for legacy databases — we send both and
  // Notion accepts whichever matches the resource type.
  const payload = {
    parent: { data_source_id: dataSourceId, database_id: dataSourceId },
    properties: {
      // "Name" is Notion's default title property name. If the target DB
      // renamed it (e.g. "Title"), Notion accepts the property by ID too,
      // but operators typically keep "Name". Document this in the pilot
      // setup notes if a custom DB ever gets used.
      Name: {
        title: [{ type: "text", text: { content: title.slice(0, 200) } }],
      },
    },
    children,
  };

  try {
    const res = await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error("Notion feedback mirror failed", {
        context: "feedback/notion-mirror",
        metadata: {
          status: res.status,
          feedbackId: input.feedbackId,
          response: text.slice(0, 500),
        },
      });
      return null;
    }
    const data = (await res.json()) as { id?: string; url?: string };
    if (!data.id || !data.url) return null;
    return { pageId: data.id, pageUrl: data.url };
  } catch (err) {
    logger.error("Notion feedback mirror threw", {
      context: "feedback/notion-mirror",
      error: err,
      metadata: { feedbackId: input.feedbackId },
    });
    return null;
  }
}
