"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { BookOpen, FileText, Library } from "lucide-react";
import ThrowsBuilderClient from "../throws/builder/_builder-client";
import { PlanTab } from "./_plan-tab";
import { DrillTab } from "./_drill-tab";
import type { ExerciseItem, AthletePickerItem } from "@/lib/data/coach";

type ViewId = "session" | "plan" | "drill";
const VALID_VIEWS: ReadonlyArray<ViewId> = ["session", "plan", "drill"];

interface BuilderTabsProps {
  userId: string;
  exercises: ExerciseItem[];
  athletes: AthletePickerItem[];
}

export function BuilderTabsClient(props: BuilderTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active: ViewId = useMemo(() => {
    const requested = searchParams.get("type");
    return VALID_VIEWS.includes(requested as ViewId) ? (requested as ViewId) : "session";
  }, [searchParams]);

  const handleChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // Switching builder type clears the plan-tab "mode" sub-param to avoid
      // carrying ?mode=generate into the Drill tab where it's meaningless.
      params.delete("mode");
      if (id === "session") params.delete("type");
      else params.set("type", id);
      const qs = params.toString();
      router.replace(`/coach/builder${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-5">
      <ScrollProgressBar />

      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-[var(--foreground)]">
          Builder
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Create — draft a session, plan, or drill. Save it to Library for reuse, or drop it on the
          Calendar to assign.
        </p>
      </div>

      <Tabs activeTab={active} defaultTab="session" onChange={handleChange}>
        <TabList variant="underline">
          <TabTrigger
            id="session"
            variant="underline"
            icon={<BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Session
          </TabTrigger>
          <TabTrigger
            id="plan"
            variant="underline"
            icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Plan
          </TabTrigger>
          <TabTrigger
            id="drill"
            variant="underline"
            icon={<Library size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Drill
          </TabTrigger>
        </TabList>

        <div className="pt-5">
          <TabPanel id="session">
            <ThrowsBuilderClient userId={props.userId} />
          </TabPanel>

          <TabPanel id="plan">
            <PlanTab userId={props.userId} exercises={props.exercises} athletes={props.athletes} />
          </TabPanel>

          <TabPanel id="drill">
            <DrillTab />
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
