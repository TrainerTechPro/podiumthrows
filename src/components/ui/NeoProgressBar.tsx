interface NeoProgressBarProps {
  value: number;
  label?: string;
  showLabel?: boolean;
}

export function NeoProgressBar({ value, label, showLabel }: NeoProgressBarProps) {
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-nano text-[var(--muted)] uppercase tracking-widest font-semibold mb-1.5">
          <span>{label}</span>
          <span className="font-mono">{value}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-[var(--background)] shadow-neo-inset-sm overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-600 via-primary-500 to-primary-300 bg-[length:300%_auto] animate-shimmer transition-[width] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
