import { redirect } from "next/navigation";

/**
 * /coach/my-throws is now consolidated into /coach/my-training (Records tab).
 * This redirect preserves any bookmarks or links.
 */
export default function CoachMyThrowsRedirect() {
  redirect("/coach/my-training?tab=records");
}
