import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { requireCoachSession, PLAN_LIMITS, getAthleteRoster } from "@/lib/data/coach";
import { PLANS } from "@/lib/stripe";
import { ProfileForm, PortalButton, UpgradeButton } from "./_form";

/* ─── Plan Card ──────────────────────────────────────────────────────────── */

function PlanCard({
  planKey,
  isCurrent,
}: {
  planKey: keyof typeof PLANS;
  isCurrent: boolean;
}) {
  const plan = PLANS[planKey];
  const athleteLabel =
    plan.maxAthletes === Infinity ? "Unlimited" : `Up to ${plan.maxAthletes}`;

  const features: Record<keyof typeof PLANS, string[]> = {
    FREE: [
      `${athleteLabel} athletes`,
      "Session logging",
      "Readiness check-ins",
      "Throw tracking",
    ],
    PRO: [
      `${athleteLabel} athletes`,
      "Everything in Free",
      "Program builder",
      "ACWR analytics",
      "Athlete progress exports",
    ],
    ELITE: [
      `${athleteLabel} athletes`,
      "Everything in Pro",
      "Video annotation (coming soon)",
      "Priority support",
      "Custom branding",
    ],
  };

  return (
    <div
      className={cn(
        "card p-5 space-y-4 flex flex-col",
        isCurrent && "ring-2 ring-primary-500"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            {plan.name}
          </p>
          <p className="text-2xl font-bold font-heading text-[var(--foreground)] mt-0.5">
            {plan.monthlyPrice === 0 ? "Free" : `$${plan.monthlyPrice}`}
            {plan.monthlyPrice > 0 && (
              <span className="text-sm font-normal text-muted">/mo</span>
            )}
          </p>
        </div>
        {isCurrent && (
          <Badge variant="primary">Current Plan</Badge>
        )}
      </div>

      <ul className="space-y-1.5 flex-1">
        {features[planKey].map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0 text-emerald-500"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function CoachSettingsPage() {
  const { coach, session } = await requireCoachSession();
  const currentPlan = coach.plan as keyof typeof PLANS;
  const roster = await getAthleteRoster(coach.id);
  const athleteCount = roster.length;
  const planLimit = PLAN_LIMITS[currentPlan];

  const periodEnd = (coach as { currentPeriodEnd?: Date | null }).currentPeriodEnd;
  const periodEndFormatted = periodEnd
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(periodEnd))
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Settings
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Manage your profile and subscription.
        </p>
      </div>

      {/* ─── Profile section ─── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--card-border)] pb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Profile</h2>
          <p className="text-sm text-muted mt-0.5">
            This information is visible to your athletes.
          </p>
        </div>

        {/* Avatar + identity card */}
        <div className="card px-5 py-4 flex items-center gap-4">
          <Avatar
            name={`${coach.firstName} ${coach.lastName}`}
            src={coach.avatarUrl}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {coach.firstName} {coach.lastName}
            </p>
            <p className="text-sm text-muted truncate">{session.email}</p>
            {coach.organization && (
              <p className="text-xs text-muted mt-0.5">{coach.organization}</p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <ProfileForm
            initial={{
              firstName:    coach.firstName,
              lastName:     coach.lastName,
              bio:          coach.bio,
              organization: coach.organization,
            }}
          />
        </div>
      </section>

      {/* ─── Subscription section ─── */}
      <section className="space-y-4">
        <div className="border-b border-[var(--card-border)] pb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Subscription
          </h2>
          <p className="text-sm text-muted mt-0.5">
            You are on the{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {PLANS[currentPlan].name}
            </span>{" "}
            plan.
            {currentPlan === "FREE" && (
              <span> Upgrade to manage more athletes and unlock advanced features.</span>
            )}
          </p>
        </div>

        {/* Current plan summary */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-semibold">Current Plan</p>
              <p className="text-lg font-bold font-heading text-[var(--foreground)] mt-0.5">
                {PLANS[currentPlan].name}
                {currentPlan !== "FREE" && (
                  <span className="text-sm font-normal text-muted ml-1">
                    ${PLANS[currentPlan].monthlyPrice}/mo
                  </span>
                )}
              </p>
            </div>
            <Badge variant={currentPlan === "FREE" ? "neutral" : "primary"}>
              {currentPlan === "FREE" ? "Free" : "Active"}
            </Badge>
          </div>

          <div className="flex gap-6 flex-wrap text-sm">
            <div>
              <span className="text-muted">Athletes</span>{" "}
              <span className="font-semibold text-[var(--foreground)] tabular-nums">
                {athleteCount} / {planLimit === Infinity ? "∞" : planLimit}
              </span>
            </div>
            {periodEndFormatted && (
              <div>
                <span className="text-muted">Renews</span>{" "}
                <span className="font-semibold text-[var(--foreground)]">{periodEndFormatted}</span>
              </div>
            )}
          </div>

          {currentPlan === "FREE" && (
            <div className="pt-1">
              <UpgradeButton plan="PRO" />
            </div>
          )}
          {currentPlan === "PRO" && (
            <div className="pt-1">
              <UpgradeButton plan="ELITE" />
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {(["FREE", "PRO", "ELITE"] as const).map((key) => (
            <PlanCard key={key} planKey={key} isCurrent={key === currentPlan} />
          ))}
        </div>

        {/* Billing portal */}
        {currentPlan !== "FREE" && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Billing & Invoices
            </h3>
            <p className="text-sm text-muted">
              View invoices, update your payment method, or cancel your subscription.
            </p>
            <PortalButton hasStripe={!!coach.stripeCustomerId} />
          </div>
        )}
      </section>
    </div>
  );
}
