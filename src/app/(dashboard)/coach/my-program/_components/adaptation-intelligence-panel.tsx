"use client";

import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import CheckpointTimeline from "./checkpoint-timeline";
import PendingSuggestions from "./pending-suggestions";

interface AdaptationIntelligencePanelProps {
  programId: string;
}

export default function AdaptationIntelligencePanel({
  programId,
}: AdaptationIntelligencePanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Adaptation Intelligence
        </h3>
        <p className="text-xs text-muted mt-0.5">
          Engine output — autoregulation decisions and pending suggestions
        </p>
      </div>

      <Tabs defaultTab="timeline">
        <TabList variant="boxed" className="mb-4">
          <TabTrigger id="timeline" variant="boxed">
            Timeline
          </TabTrigger>
          <TabTrigger id="pending" variant="boxed">
            Pending
          </TabTrigger>
          <TabTrigger id="insights" variant="boxed">
            Insights
          </TabTrigger>
        </TabList>

        <TabPanel id="timeline">
          <CheckpointTimeline programId={programId} />
        </TabPanel>

        <TabPanel id="pending">
          <PendingSuggestions programId={programId} />
        </TabPanel>

        <TabPanel id="insights">
          <div className="card p-8 text-center">
            <p className="text-sm text-muted">
              Deficit attribution and predicted vs actual charts — coming soon
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
