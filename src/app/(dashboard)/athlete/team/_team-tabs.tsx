"use client";

import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { TeamFeed } from "./_team-feed";
import { TeamLeaderboard } from "./_team-leaderboard";
import { TeamStreaks } from "./_team-streaks";

export function TeamTabs() {
  return (
    <Tabs defaultTab="feed">
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
