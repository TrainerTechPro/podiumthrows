"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { id: "sessions", label: "Sessions" },
  { id: "records", label: "Records" },
  { id: "insights", label: "Insights" },
  { id: "typing", label: "My Typing" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function TabNav() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "sessions";

  return (
    <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/coach/my-training?tab=${tab.id}`}
          replace
          className={`flex-1 text-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === tab.id
              ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
