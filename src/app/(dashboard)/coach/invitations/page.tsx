import { redirect } from "next/navigation";

/**
 * /coach/invitations is now a tab on /coach/athletes.
 * This redirect preserves any bookmarks or links.
 */
export default function InvitationsRedirect() {
  redirect("/coach/athletes?tab=invitations");
}
