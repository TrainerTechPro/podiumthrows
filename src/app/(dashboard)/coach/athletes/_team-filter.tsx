"use client";

import { useRouter, usePathname } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

type TeamOption = {
  id: string;
  name: string;
  memberCount: number;
};

export function TeamFilter({
  teams,
  currentTeamId,
}: {
  teams: TeamOption[];
  currentTeamId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    // Persist preference (best-effort, non-blocking)
    fetch("/api/coach/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ lastTeamId: value || null }),
    }).catch(() => {});

    // Navigate with search param to trigger server re-render
    const params = new URLSearchParams();
    if (value) params.set("teamId", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={currentTeamId ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] font-medium"
      aria-label="Filter by group"
    >
      <option value="">All Athletes</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.memberCount})
        </option>
      ))}
      <option value="unassigned">Unassigned</option>
    </select>
  );
}
