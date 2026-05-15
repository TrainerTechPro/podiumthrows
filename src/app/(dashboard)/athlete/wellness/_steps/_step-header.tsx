import { ProgressBar } from "@/components/ui/ProgressBar";

interface StepHeaderProps {
  current: number;
  total: number;
}

export function StepHeader({ current, total }: StepHeaderProps) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-micro font-semibold text-muted tracking-wider uppercase">Step</span>
        <span className="text-micro font-bold text-[var(--foreground)] tabular-nums">
          {current}/{total}
        </span>
      </div>
      <ProgressBar value={pct} variant="primary" size="sm" />
    </div>
  );
}
