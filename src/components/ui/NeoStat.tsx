interface NeoStatProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  sublabel?: string;
  sublabelVariant?: "success" | "danger" | "muted";
}

export function NeoStat({
  label,
  value,
  unit,
  accent,
  sublabel,
  sublabelVariant = "muted",
}: NeoStatProps) {
  return (
    <div className="relative overflow-hidden bg-[var(--card-bg)] rounded-[2rem] p-6 shadow-neo-raised group">
      <div className="absolute top-0 left-3 right-3 h-[2px] rounded-b bg-gradient-to-r from-primary-500 to-primary-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="inline-block px-2 py-1 rounded-full text-nano uppercase tracking-widest font-semibold text-[var(--muted)] bg-[var(--background)] shadow-neo-inset-sm mb-3">
        {label}
      </div>
      <div
        className={`font-mono tabular-nums text-display font-black leading-none tracking-tight ${accent ? "text-primary-500" : "text-[var(--foreground)]"}`}
      >
        {value}
        {unit && (
          <span className="text-body font-body font-normal text-[var(--muted)] ml-1">{unit}</span>
        )}
      </div>
      {sublabel && (
        <div
          className={`text-micro mt-2 font-semibold ${
            sublabelVariant === "success"
              ? "text-status-success-fg"
              : sublabelVariant === "danger"
                ? "text-status-danger-fg"
                : "text-[var(--muted)]"
          }`}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}
