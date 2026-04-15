import Link from "next/link";
import { CheckCircle2, AlertCircle, XCircle, type LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  getAssessmentStatus,
  type AssessmentStatus,
  type AssessmentTier,
} from "@/lib/bondarchuk/assessment-status";

interface Props {
  assessmentDate: Date | string | null;
  /** When provided, the badge renders as a link to the assessment page. */
  athleteId?: string;
  /** Override current time — mostly for SSR determinism or tests. */
  now?: Date;
  /** Compact variant trims padding + icon (for dense rows). */
  size?: "sm" | "md";
  className?: string;
}

const TIER_VARIANT: Record<AssessmentTier, BadgeVariant> = {
  fresh: "success",
  aging: "warning",
  stale: "warning",
  expired: "danger",
  never: "danger",
};

const TIER_ICON: Record<AssessmentTier, LucideIcon> = {
  fresh: CheckCircle2,
  aging: AlertCircle,
  stale: AlertCircle,
  expired: XCircle,
  never: XCircle,
};

const TIER_SHORT_LABEL: Record<AssessmentTier, (s: AssessmentStatus) => string> = {
  fresh: (s) => (s.days === 0 ? "Fresh" : `${s.days}d`),
  aging: (s) => `${s.days}d · aging`,
  stale: (s) => `${s.days}d · stale`,
  expired: (s) => `${s.days}d · expired`,
  never: () => "Never assessed",
};

export function AssessmentStatusBadge({
  assessmentDate,
  athleteId,
  now,
  size = "sm",
  className,
}: Props) {
  const status = getAssessmentStatus(assessmentDate, now);
  const Icon = TIER_ICON[status.tier];
  const label = TIER_SHORT_LABEL[status.tier](status);
  const ariaLabel = `Bondarchuk ${status.label}`;

  const badge = (
    <Badge
      variant={TIER_VARIANT[status.tier]}
      className={size === "sm" ? "text-[10px] px-2 py-0.5" : undefined}
    >
      <Icon
        className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );

  if (athleteId) {
    return (
      <Link
        href={`/coach/throws/assessment/${athleteId}`}
        aria-label={ariaLabel}
        title={status.label}
        className={`inline-flex items-center min-h-[44px] ${className ?? ""}`}
      >
        {badge}
      </Link>
    );
  }

  return (
    <span
      aria-label={ariaLabel}
      title={status.label}
      className={`inline-flex items-center ${className ?? ""}`}
    >
      {badge}
    </span>
  );
}
