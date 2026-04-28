import Link from "next/link";
import { Activity, Heart } from "lucide-react";

type Provider = "oura" | "whoop";

const PROVIDER_COPY: Record<
  Provider,
  {
    name: string;
    data: string;
    icon: typeof Activity;
  }
> = {
  oura: {
    name: "Oura Ring",
    data: "readiness, sleep, HRV, and activity",
    icon: Activity,
  },
  whoop: {
    name: "WHOOP",
    data: "recovery, strain, sleep, and HRV",
    icon: Heart,
  },
};

export function WearableNotConnected({ provider }: { provider: Provider }) {
  const { name, data, icon: Icon } = PROVIDER_COPY[provider];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">{name} Data</h1>
          <p className="text-sm text-muted mt-0.5">Daily metrics from your {name}</p>
        </div>
      </div>

      <div className="card p-8 sm:p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 mb-6">
          <Icon size={28} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        </div>

        <h2 className="font-heading text-xl font-bold text-[var(--foreground)] mb-2">
          Your {name} isn&rsquo;t connected
        </h2>
        <p className="text-sm text-muted max-w-md mx-auto mb-6">
          Connect your {name} to see {data} here. Setup takes about a minute.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/athlete/integrations#${provider}`}
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5"
          >
            Connect {name}
          </Link>
          <Link
            href="/athlete/sessions"
            className="btn-secondary inline-flex items-center justify-center gap-2 px-5 py-2.5"
          >
            Back to training
          </Link>
        </div>
      </div>
    </div>
  );
}
