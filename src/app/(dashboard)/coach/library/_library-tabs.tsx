"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { LayoutGrid, BookOpen, FileText, Dumbbell, Library } from "lucide-react";
import { SessionsLibraryView } from "@/components/coach/library/SessionsLibraryView";
import { ExercisesTable } from "../exercises/_exercises-table";
import { PlansList } from "../plans/_plans-list";
import { DrillsTab } from "./_drills-tab";
import { AllTab } from "./_all-tab";
import type { ExerciseItem, WorkoutPlanItem, DrillItem } from "@/lib/data/coach";

type ViewId = "all" | "sessions" | "plans" | "exercises" | "drills";
const VALID_VIEWS: ReadonlyArray<ViewId> = ["all", "sessions", "plans", "exercises", "drills"];

interface DrillVideoSummary {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  event: string | null;
  category: string | null;
  difficulty: string | null;
  isGlobal: boolean;
  coachId: string | null;
}

interface LibraryTabsClientProps {
  plans: WorkoutPlanItem[];
  exercises: ExerciseItem[];
  drills: DrillItem[];
  drillVideos: DrillVideoSummary[];
  ownDrillCount: number;
  globalDrillCount: number;
}

export function LibraryTabsClient(props: LibraryTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active: ViewId = useMemo(() => {
    const requested = searchParams.get("view");
    return VALID_VIEWS.includes(requested as ViewId) ? (requested as ViewId) : "all";
  }, [searchParams]);

  const handleChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "all") params.delete("view");
      else params.set("view", id);
      const qs = params.toString();
      router.replace(`/coach/library${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-5">
      <ScrollProgressBar />

      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-[var(--foreground)]">
          Library
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Sessions, plans, exercises, and drills — searchable, assignable.
        </p>
      </div>

      <Tabs activeTab={active} defaultTab="all" onChange={handleChange}>
        <TabList variant="underline">
          <TabTrigger
            id="all"
            variant="underline"
            icon={<LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            All
          </TabTrigger>
          <TabTrigger
            id="sessions"
            variant="underline"
            icon={<BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Sessions
          </TabTrigger>
          <TabTrigger
            id="plans"
            variant="underline"
            icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Plans
          </TabTrigger>
          <TabTrigger
            id="exercises"
            variant="underline"
            icon={<Dumbbell size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Exercises
          </TabTrigger>
          <TabTrigger
            id="drills"
            variant="underline"
            icon={<Library size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Drills
          </TabTrigger>
        </TabList>

        <div className="pt-5">
          <TabPanel id="all">
            <AllTab
              plans={props.plans}
              exercises={props.exercises}
              drills={props.drills}
              onTabChange={handleChange}
            />
          </TabPanel>

          <TabPanel id="sessions">
            <SessionsLibraryView />
          </TabPanel>

          <TabPanel id="plans">
            <PlansList plans={props.plans} />
          </TabPanel>

          <TabPanel id="exercises">
            <ExercisesTable exercises={props.exercises} />
          </TabPanel>

          <TabPanel id="drills">
            <DrillsTab
              drills={props.drills}
              drillVideos={props.drillVideos}
              ownDrillCount={props.ownDrillCount}
              globalDrillCount={props.globalDrillCount}
            />
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
