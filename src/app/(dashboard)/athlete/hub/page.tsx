import { redirect } from "next/navigation";

/* Dead route. Kept as a 307 redirect so any stale bookmark / push
   notification / email link keeps working. Team Hub content dispersed
   per tasks/nav-ia-v2.md §2.4 — announcements stay behind this URL for
   Phase 2 consolidation but are no longer surfaced in nav. */

export default function AthleteHubRedirect() {
  redirect("/athlete/dashboard");
}
