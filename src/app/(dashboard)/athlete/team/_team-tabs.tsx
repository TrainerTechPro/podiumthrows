"use client";

import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { TeamFeed } from "./_team-feed";
import { TeamLeaderboard } from "./_team-leaderboard";
import { TeamStreaks } from "./_team-streaks";

const VALID_TABS = ["feed", "prs", "streaks"] as const;
type TeamTab = (typeof VALID_TABS)[number];

export function TeamTabs() {
  const [raw, setTab] = useUrlState("tab", "feed");
  const active: TeamTab = (VALID_TABS as readonly string[]).includes(raw)
    ? (raw as TeamTab)
    : "feed";

  return (
    <Tabs defaultTab="feed" activeTab={active} onChange={(id) => setTab(id)}>
      <TabList variant="underline" aria-label="Team views">
        <TabTrigger id="feed" variant="underline">
          Feed
        </TabTrigger>
        <TabTrigger id="prs" variant="underline">
          PRs
        </TabTrigger>
        <TabTrigger id="streaks" variant="underline">
          Streaks
        </TabTrigger>
      </TabList>

      <TabPanel id="feed" className="pt-4">
        <TeamFeed />
      </TabPanel>
      <TabPanel id="prs" className="pt-4">
        <TeamLeaderboard />
      </TabPanel>
      <TabPanel id="streaks" className="pt-4">
        <TeamStreaks />
      </TabPanel>
    </Tabs>
  );
}
