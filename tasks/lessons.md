# Lessons Learned — Podium Throws

<!-- 
After ANY correction from the user, add a lesson here.
Format: what went wrong → rule to prevent it.
Review this file at the start of every session.
-->

## Rules
<!-- Example format:
- NEVER modify a shared component without grepping for all imports first
- ALWAYS run tsc --noEmit after code changes
- ALWAYS preserve warm amber/gold color palette — don't introduce new colors
-->

- **`prisma migrate dev` is interactive and will refuse to run when there's ANY pending warning, even unrelated to your change.** Because `.env.local` in this repo points at prod Supabase, you MUST override `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` to the local URL first. But even then: if the schema has any pending unique-constraint additions (e.g. the Lead.email one in this repo), `migrate dev` aborts in non-interactive environments. Workaround: write the migration SQL by hand in `prisma/migrations/<timestamp>_<name>/migration.sql` matching the format of existing migrations, then run `prisma migrate deploy` (non-interactive, applies only new migrations, no side effects on warnings). Also regenerate the client with `prisma generate` afterward. Prior incident: 2026-04-14, C-2 work, `migrate dev` for `AssessmentOverride` aborted on an unrelated Lead.email warning; fell back to manual SQL + `migrate deploy` and it worked cleanly.

- **Domain-rule validation must run at the Zod gate, not after the write.** Post-write validation that returns `warnings` in the response body is cosmetic — bad data is already persisted, client may ignore the warnings, and the domain invariant is broken. Rule-of-thumb: if a rule is labelled "FORBIDDEN" or "NON-NEGOTIABLE" in CLAUDE.md, the enforcement point MUST be `parseBody(request, Schema)` with a `.superRefine()` that returns 400. Any downstream `toast.warning` or in-response `warnings: []` is a code smell that the real gate is missing. Prior incident: `/api/athlete/log-session` ran Bondarchuk `validateImplementSequence` AFTER the DB write for months and just returned warnings — ascending 6kg→8kg sequences were saved successfully, silently violating the project's #1 domain rule. Fixed 2026-04-14 by moving enforcement into the Zod schema.

- **Native-binding deploys require explicit target declaration AND a post-deploy smoke test.** When the deploy bundle includes `.node` files (Prisma query engines, bcrypt native, sharp, canvas, etc.), `prisma generate` / `npm install` on the developer's machine only produces binaries for the local arch. The prebuilt deploy flow (`./scripts/deploy.sh`) ships those local artifacts to Vercel without re-compiling on the target runtime. If Vercel's runtime arch doesn't match the developer's, the bundle deploys successfully but every request 500s.
  - Prior incident: 2026-04-13. Vercel silently moved Fluid Compute to Linux ARM64 around April 11. Prebuilt bundles compiled on macOS ARM64 shipped `darwin-arm64` Prisma engine; runtime needed `linux-arm64-openssl-3.0.x`. Login route 500'd for all users. /coach/dashboard 500'd (PODIUM-THROWS-5, 13 events over 2 days). Structured logger suppressed stack traces in prod (since fixed), Sentry server SDK was a no-op (missing DSN + missing `onRequestError`; both since fixed), so the actual error hid for 2+ days.
  - Preventive measures now in place:
    - `prisma/schema.prisma` declares `binaryTargets` for both Linux arm64 and rhel-openssl-3.0.x (x64).
    - `./scripts/deploy.sh` runs a post-deploy smoke test against `/api/auth/login` and auto-rolls-back on non-401.
    - `./scripts/deploy.sh prod` uses Vercel's cloud builder (not prebuilt), so `prisma generate` runs on Linux matching the runtime. Preview deploys still use prebuilt for speed.
    - `src/lib/logger.ts` logs stacks in production.
    - `src/instrumentation.ts` exports `onRequestError`, and Sentry configs fall back to `NEXT_PUBLIC_SENTRY_DSN` — server-side RSC errors now reach Sentry with real stacks.

- **A refactor plan's premise must be verified by reading files, not by audit text alone.** The original H-1 plan called for consolidating four "roster surfaces" (`/coach/athletes`, `/coach/throws/roster`, `/coach/team`, `/coach/teams`) into one. Writing a feature-inventory matrix before starting revealed only two were actually rosters — `/coach/team` is a `CoachComposer` messaging surface and `/coach/teams` is a group CRUD page. Following the plan literally would have silently deleted the team broadcast feature. Rule: before any "consolidation" or "deprecation" PR, produce a written side-by-side feature matrix of each surface and present it at a checkpoint. Audits are hypotheses, not ground truth. Prior incident: H-1, 2026-04-14.

- **When adding a new value to a URL-state enum (like `?tab=`), grep every navigation site in the same page and confirm they preserve all other params.** Adding `tab=throws` to `/coach/athletes` exposed a latent bug in `_team-filter.tsx` — changing groups built a fresh `URLSearchParams` that dropped `tab`, kicking the user back to the Roster view. Invisible before because the only other tab (`invitations`) was rarely combined with a team filter. Rule: when introducing a new axis of URL state, every existing helper that writes to the URL on that page needs to switch to `new URLSearchParams(searchParams.toString())` (preserve-then-mutate) rather than constructing from scratch. Prior incident: H-1, 2026-04-14.

- **`getByRole("link", ...)` doesn't match nav parents that have children.** In `Sidebar.tsx`, a parent `NavItem` with `children: NavItem[]` renders as a `<button>` (collapsible), not a `<Link>`. Only the leaf children are `<Link>`s. So a Playwright test like `page.getByRole("link", { name: /athlete/i }).first()` will skip the Athletes parent entirely and pick the first leaf — *and if the parent is collapsed (default state on most pages), no leaf renders at all*. The first matching `<Link>` then becomes whatever else on the page happens to have "athlete" in an aria-label. Prior incident: 2026-04-25, commit 4 of the coach-IA consolidation. The new top-bar `CoachFeedbackInboxIcon` shipped with `aria-label="Athlete feedback inbox"` (also semantically wrong — the inbox is feedback FROM athletes, not the athlete's feedback). `coach-dashboard.spec.ts:14`'s regex match `/athlete|roster/i` selected the icon instead of the (collapsed) sidebar Athletes parent, navigating to `/coach/feedback-inbox` instead of `/coach/athletes`. Two-part lesson:
  - **Test side:** prefer `page.getByRole("navigation").getByRole("link", { name: "Athletes" })` or `data-testid="nav-athletes"` over a regex-on-whole-page first-match. The current pattern in `coach-dashboard.spec.ts` and `coach-roster-detail.spec.ts` is a time bomb that re-fires every time a new aria-label happens to match.
  - **Component side:** any aria-label on a top-bar/nav element must be unique enough that no plausible test selector collides. "Feedback inbox" is enough; "Athlete feedback inbox" tripped the regex.
