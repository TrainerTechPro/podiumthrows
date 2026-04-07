"use client";

import { useState } from "react";
import { StrengthTab } from "./StrengthCalculators";
import { BodyStatsTab } from "./BodyStatsCalculators";

/* ── Shared type exported so page wrappers can build it ───────────────────── */

export type ProfileBodyStats = {
  weightKg: number | null;
  heightCm: number | null;
  gender: string | null;
  age: number | null;
};

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  {
    id: "strength",
    label: "Strength",
    icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
  },
  {
    id: "bodystats",
    label: "Body Stats",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

export interface ToolsPageProps {
  isCoach?: boolean;
  profileBodyStats?: ProfileBodyStats;
}

export default function ToolsPage({
  isCoach = false,
  profileBodyStats,
}: ToolsPageProps) {
  const [activeTab, setActiveTab] = useState("strength");

  const profileLink = isCoach ? "/coach/settings" : "/athlete/profile";

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-display text-gray-900 dark:text-gray-50">
            Tools
          </h1>
          <p className="text-body text-gray-500 dark:text-gray-400 mt-1">
            Strength and body composition tools for throws athletes
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-caption font-medium whitespace-nowrap transition-all flex-shrink-0 min-h-[44px] ${
                activeTab === tab.id
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-white dark:bg-surface-800 text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-white/8 hover:border-primary-300 dark:hover:border-primary-600/40"
              }`}
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "strength" && <StrengthTab />}
        {activeTab === "bodystats" && (
          <BodyStatsTab
            profileBodyStats={profileBodyStats}
            profileLink={profileLink}
          />
        )}
      </div>
    </div>
  );
}
