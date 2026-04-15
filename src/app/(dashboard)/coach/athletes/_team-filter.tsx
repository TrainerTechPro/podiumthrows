"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    // Persist preference (best-effort, non-blocking)
    fetch("/api/coach/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ lastTeamId: value || null }),
    }).catch(() => {});

    // Preserve other query params (tab, etc.) when updating teamId
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("teamId", value);
    else params.delete("teamId");
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
