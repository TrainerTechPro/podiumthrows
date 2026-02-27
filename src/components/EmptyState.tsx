"use client";

import Link from "next/link";

interface EmptyStateProps {
  icon?: string;
  headline: string;
  subtext?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}

export default function EmptyState({
  icon,
  headline,
  subtext,
  ctaLabel,
  ctaHref,
  ctaOnClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 space-y-3">
      {icon && (
        <span className="text-4xl text-gray-400 dark:text-gray-500">{icon}</span>
      )}
      <p className="text-base font-semibold text-gray-700 dark:text-gray-300">{headline}</p>
      {subtext && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtext}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary mt-1">
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && !ctaHref && ctaOnClick && (
        <button onClick={ctaOnClick} className="btn-primary mt-1">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
