import { redirect } from "next/navigation";

/**
 * /coach/drill-videos is consolidated into /coach/throws/drills.
 * This redirect preserves any bookmarks or links.
 */
export default function DrillVideosRedirect() {
  redirect("/coach/throws/drills");
}
