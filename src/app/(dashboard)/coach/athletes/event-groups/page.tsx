import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import EventGroupsClient from "../../event-groups/page";

export const metadata = { title: "Event Groups — Podium Throws" };

/**
 * Auth-gated wrapper around the legacy /coach/event-groups client component.
 * The legacy page is "use client" and is itself the default export — Next.js
 * lets us re-render it inside a server component with no extra extraction.
 *
 * Commit 5 redirects /coach/event-groups → here, after which the legacy file
 * becomes a redirect-only stub (or gets deleted in a cleanup pass).
 */
export default async function CoachAthletesEventGroupsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }
  return <EventGroupsClient />;
}
