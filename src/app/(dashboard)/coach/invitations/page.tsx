import { redirect } from "next/navigation";

/**
 * /coach/invitations now lives at /coach/athletes/invitations. This
 * redirect preserves any old bookmarks or deep links, and points at
 * the canonical path-based route rather than the ?tab= query flavor.
 */
export default function InvitationsRedirect() {
  redirect("/coach/athletes/invitations");
}
