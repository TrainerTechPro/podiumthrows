import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-surface-300 dark:text-surface-600 shrink-0"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center flex-wrap gap-1", className)}>
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <Fragment key={idx}>
              <li>
                {isLast || !item.href ? (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isLast
                        ? "text-[var(--foreground)]"
                        : "text-muted hover:text-[var(--foreground)] transition-colors cursor-default"
                    )}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-muted hover:text-[var(--foreground)] transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
