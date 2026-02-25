import Link from "next/link";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { ThrowLogForm } from "./_throw-log-form";

export default async function ThrowLogPage() {
  const { athlete } = await requireAthleteSession();

  // Get athlete's gender and events for implement presets
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athlete.id },
    select: { gender: true, events: true },
  });

  const gender = (profile?.gender?.toLowerCase() ?? "male") as "male" | "female";
  const events = (profile?.events ?? []) as string[];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/athlete/throws"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Throw History
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Log a Throw
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Record a throw from practice or competition
        </p>
      </div>

      <ThrowLogForm gender={gender} athleteEvents={events} />
    </div>
  );
}
