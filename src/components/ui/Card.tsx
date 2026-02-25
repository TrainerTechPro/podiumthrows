import { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ─── Card Root ─────────────────────────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** When true: cursor-pointer, hover shadow lift */
  clickable?: boolean;
  /** If provided, wraps the card in a Next.js Link */
  href?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  clickable = false,
  href,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  const base = cn(
    "card",
    paddingMap[padding],
    (clickable || href) &&
      "cursor-pointer transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
    className
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }

  return (
    <div
      className={base}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if ((e.key === "Enter" || e.key === " ") && props.onClick) {
                e.preventDefault();
                props.onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Card Header ───────────────────────────────────────────────────────── */

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** Adds bottom border and padding if you're not using padding on the Card itself */
  divided?: boolean;
}

export function CardHeader({
  title,
  subtitle,
  action,
  divided = false,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        divided && "pb-4 mb-4 border-b border-[var(--card-border)]",
        className
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="text-base font-semibold text-[var(--foreground)] truncate">{title}</h3>
          )}
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
      {children}
    </div>
  );
}

/* ─── Card Body ─────────────────────────────────────────────────────────── */

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

/* ─── Card Footer ───────────────────────────────────────────────────────── */

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  divided?: boolean;
  align?: "left" | "right" | "between";
}

export function CardFooter({
  divided = false,
  align = "right",
  className,
  children,
  ...props
}: CardFooterProps) {
  const alignClass = {
    left: "justify-start",
    right: "justify-end",
    between: "justify-between",
  }[align];

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        alignClass,
        divided && "pt-4 mt-4 border-t border-[var(--card-border)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
