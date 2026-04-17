import Link from "next/link";

type Props = {
  role: "COACH" | "ATHLETE";
  athleteName?: string;
};

export function InsightEmptyState({ role, athleteName }: Props) {
  if (role === "ATHLETE") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h2 className="font-heading text-xl">No insights yet</h2>
        <p className="mt-3 text-muted">
          Your insights appear here once there&apos;s enough data to find patterns — typically after
          a few weeks of logged sessions and a couple of meets.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/athlete/log-session" className="text-primary-500 hover:underline">
            Log a practice session →
          </Link>
          <Link href="/athlete/competitions" className="text-primary-500 hover:underline">
            Log a competition →
          </Link>
        </div>
      </div>
    );
  }

  const name = athleteName ?? "this athlete";
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h2 className="font-heading text-xl">No insights yet for {name}</h2>
      <p className="mt-3 text-muted">
        Insights require minimum data: 5 weeks of practice for training patterns, 6 paired training
        windows for lift-throw correlations, 4 competitions for readiness-competition correlations.
      </p>
    </div>
  );
}
