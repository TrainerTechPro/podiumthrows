interface NeoCardProps {
  label?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function NeoCard({ label, action, children, className = "" }: NeoCardProps) {
  return (
    <div className={`card-rounded p-4 ${className}`}>
      {(label || action) && (
        <div className="flex items-center justify-between mb-3">
          {label && (
            <span className="text-nano uppercase tracking-widest font-semibold text-[var(--muted)]">
              {label}
            </span>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
