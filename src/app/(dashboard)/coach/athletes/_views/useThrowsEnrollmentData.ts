"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoachAthlete, RosterAthlete, ThrowsProfileRow } from "./throws-shared";

export interface ThrowsEnrollmentData {
  podiumAthletes: ThrowsProfileRow[];
  allAthletes: CoachAthlete[];
  rosterAthletes: RosterAthlete[];
  loading: boolean;
  refetch: () => void;
}

export function useThrowsEnrollmentData(teamId: string | null): ThrowsEnrollmentData {
  const [podiumAthletes, setPodiumAthletes] = useState<ThrowsProfileRow[]>([]);
  const [allAthletes, setAllAthletes] = useState<CoachAthlete[]>([]);
  const [rosterAthletes, setRosterAthletes] = useState<RosterAthlete[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    const qs = teamId ? `?teamId=${teamId}` : "";
    setLoading(true);
    Promise.all([
      fetch("/api/throws/podium-roster").then((r) => r.json()),
      fetch("/api/athletes").then((r) => r.json()),
      fetch(`/api/coach/athletes${qs}`).then((r) => r.json()),
    ])
      .then(([podiumData, athletesData, rosterData]) => {
        if (rosterData.success) setRosterAthletes(rosterData.data);
        const filteredIds = new Set((rosterData.data ?? []).map((a: { id: string }) => a.id));

        if (podiumData.success) {
          const podium = teamId
            ? podiumData.data.filter((p: { athleteId: string }) => filteredIds.has(p.athleteId))
            : podiumData.data;
          setPodiumAthletes(podium);
        }
        if (athletesData.success) {
          let list = Array.isArray(athletesData.data)
            ? athletesData.data
            : athletesData.data
              ? [athletesData.data]
              : [];
          if (teamId) list = list.filter((a: { id: string }) => filteredIds.has(a.id));
          setAllAthletes(list);
        }
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { podiumAthletes, allAthletes, rosterAthletes, loading, refetch: fetchData };
}
