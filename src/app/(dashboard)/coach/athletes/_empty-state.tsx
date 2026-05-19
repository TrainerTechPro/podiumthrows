import Link from "next/link";
import { Users, Target, Wrench, Mail, ArrowRight } from "lucide-react";

/* ─── Roster Empty State — concierge path for new coaches ──────────────────
   Replaces the table's generic "no athletes match these filters" message
   when the coach genuinely has zero athletes. Shows a four-step path:
     1. Add an athlete (proxy)
     2. Set their throws profile (events, implements, PRs)
     3. Build the first session in Builder
     4. Invite the athlete to claim the profile

   Keep the chrome quiet — this is a coach screen, not a marketing surface.
   No celebration, no gradient hero. A simple list of next actions with a
   single primary CTA. ─────────────────────────────────────────────────── */

interface Step {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  cta: string;
  variant: "primary" | "secondary";
}

const STEPS: Step[] = [
  {
    title: "Add your first athlete",
    description:
      "Coaches can create athletes manually now and invite them later — no waiting for them to sign up.",
    href: "/coach/athletes?invite=1",
    icon: Users,
    cta: "Add athlete",
    variant: "primary",
  },
  {
    title: "Set their throws profile",
    description:
      "Event, primary implement weight, current PRs — the engine needs these to schedule sessions.",
    href: "/coach/athletes",
    icon: Target,
    cta: "Open athlete",
    variant: "secondary",
  },
  {
    title: "Build their first session",
    description:
      "Use Builder to draft a session or generate one from a Bondarchuk complex template.",
    href: "/coach/builder",
    icon: Wrench,
    cta: "Open builder",
    variant: "secondary",
  },
  {
    title: "Invite them to claim",
    description:
      "Send an email or share a one-time link. They land on a phone-first onboarding flow.",
    href: "/coach/athletes/invitations",
    icon: Mail,
    cta: "Send invite",
    variant: "secondary",
  },
];

export function RosterEmptyState() {
  return (
    <section
      aria-labelledby="roster-empty-heading"
      className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8"
    >
      <div className="mb-6">
        <h2
          id="roster-empty-heading"
          className="font-heading text-section font-semibold text-[var(--foreground)]"
        >
          Set up your roster.
        </h2>
        <p className="text-sm text-muted mt-1 max-w-prose">
          Four steps to get an athlete from blank profile to first session. You can do them in any
          order; the engine becomes useful once steps one and two are done.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, idx) => (
          <li key={step.title}>
            <Link
              href={step.href}
              className="group flex items-start gap-4 rounded-xl border border-[var(--card-border)] p-4 transition-colors hover:bg-[var(--color-bg-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand-strong)] font-heading font-semibold tabular-nums">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <step.icon
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="text-muted"
                  />
                  <p className="text-sm font-semibold text-[var(--foreground)]">{step.title}</p>
                </div>
                <p className="text-sm text-muted mt-1 leading-snug">{step.description}</p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1 text-sm font-medium ${
                  step.variant === "primary"
                    ? "text-primary-600 dark:text-primary-300"
                    : "text-muted group-hover:text-[var(--foreground)]"
                }`}
              >
                {step.cta}
                <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
