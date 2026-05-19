"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { CalendarDays, Users, Layers, ShieldCheck, Radio } from "lucide-react";
import { CalendarView } from "./_calendar-view";
import { ByEventView } from "./_by-event-view";
import { LiveSessionsView } from "./_live-sessions-view";
import { PracticesClient } from "../practices/_practices-client";
import { AvailabilityDashboard } from "../availability/_availability-dashboard";
import type { PracticeListItem } from "@/lib/data/practices";
import type { AthleteAvailabilitySummary, BestWindow } from "@/lib/data/availability";
import type { AthletePickerItem } from "@/lib/data/coach";

type ViewId = "calendar" | "by-athlete" | "by-event" | "compliance" | "live";
const VALID_VIEWS: ReadonlyArray<ViewId> = [
  "calendar",
  "by-athlete",
  "by-event",
  "compliance",
  "live",
];

interface CalendarTabsProps {
  initialPractices: PracticeListItem[];
  initialStartDate: string;
  initialEndDate: string;
  availabilityData: {
    athletes: AthleteAvailabilitySummary[];
    bestWindows: BestWindow[];
    totalAthletes: number;
  };
  athletes: AthletePickerItem[];
  eventGroups: { id: string; name: string }[];
}

export function CalendarTabsClient(props: CalendarTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const active: ViewId = useMemo(() => {
    const requested = searchParams.get("view");
    return VALID_VIEWS.includes(requested as ViewId) ? (requested as ViewId) : "calendar";
  }, [searchParams]);

  const handleChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "calendar") params.delete("view");
      else params.set("view", id);
      const qs = params.toString();
      router.replace(`/coach/calendar${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-5">
      <ScrollProgressBar />

      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-[var(--foreground)]">
          Calendar
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Scheduling — assign sessions, run practices, see who&apos;s available. Draft new work in
          Builder; reuse saved work from Library.
        </p>
      </div>

      <Tabs activeTab={active} defaultTab="calendar" onChange={handleChange}>
        <TabList variant="underline">
          <TabTrigger
            id="calendar"
            variant="underline"
            icon={<CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Calendar
          </TabTrigger>
          <TabTrigger
            id="by-athlete"
            variant="underline"
            icon={<Users size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Roster
          </TabTrigger>
          <TabTrigger
            id="by-event"
            variant="underline"
            icon={<Layers size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            By Event
          </TabTrigger>
          <TabTrigger
            id="compliance"
            variant="underline"
            icon={<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Compliance
          </TabTrigger>
          <TabTrigger
            id="live"
            variant="underline"
            icon={<Radio size={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Live Practice
          </TabTrigger>
        </TabList>

        <div className="pt-5">
          <TabPanel id="calendar">
            <CalendarView />
          </TabPanel>

          <TabPanel id="by-athlete">
            <PracticesClient
              initialPractices={props.initialPractices}
              initialStartDate={props.initialStartDate}
              initialEndDate={props.initialEndDate}
            />
          </TabPanel>

          <TabPanel id="by-event">
            <ByEventView />
          </TabPanel>

          <TabPanel id="compliance">
            <AvailabilityDashboard
              initialData={props.availabilityData}
              athletes={props.athletes}
              eventGroups={props.eventGroups}
            />
          </TabPanel>

          <TabPanel id="live">
            <LiveSessionsView />
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
