import Link from "next/link";
import { requireCoachSession, getDrillLibrary } from "@/lib/data/coach";
import { DrillFilters } from "./_drill-filters";
import { DrillGrid } from "./_drill-grid";

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: {
    event?: string;
    category?: string;
    difficulty?: string;
    athleteType?: string;
    search?: string;
  };
}) {
  const { coach } = await requireCoachSession();

  const filters: {
    event?: string;
    category?: string;
    difficulty?: string;
    athleteType?: string;
    search?: string;
  } = {};

  if (searchParams.event) filters.event = searchParams.event;
  if (searchParams.category) filters.category = searchParams.category;
  if (searchParams.difficulty) filters.difficulty = searchParams.difficulty;
  if (searchParams.athleteType) filters.athleteType = searchParams.athleteType;
  if (searchParams.search) filters.search = searchParams.search;

  const drills = await getDrillLibrary(coach.id, filters);

  // Count own vs global
  const ownCount = drills.filter((d) => d.isOwn).length;
  const globalCount = drills.filter((d) => d.isGlobal).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/coach/throws"
              className="text-muted hover:text-[var(--foreground)] transition-colors"
              aria-label="Back to throws"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              Drill Library
            </h1>
          </div>
          <p className="text-sm text-muted">
            {drills.length} drill{drills.length !== 1 ? "s" : ""}{" "}
            <span className="text-[10px]">
              ({globalCount} built-in · {ownCount} custom)
            </span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <DrillFilters />

      {/* Drill grid — client component for add/edit/delete interactions */}
      <DrillGrid drills={drills} />
    </div>
  );
}
