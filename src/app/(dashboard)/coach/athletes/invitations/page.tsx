import AthletesPage from "../page";

/**
 * Path-based route for the Invitations tab. Renders the same canonical
 * athletes page with `tab` forced to "invitations" so the URL can be
 * bookmarked and shared without relying on a ?tab= query string.
 *
 * The original ?tab=invitations query still works — see coach/athletes/page.tsx
 * — so existing links, internal redirects, and sidebar nav don't need changes.
 */
export default async function InvitationsRoutePage({
  searchParams,
}: {
  searchParams: { teamId?: string; moved?: string };
}) {
  return AthletesPage({
    searchParams: { ...searchParams, tab: "invitations" },
  });
}
