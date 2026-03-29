"use client";

import { useRouter } from "next/navigation";

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  athletes: Athlete[];
  currentAthleteId: string;
  currentEvent: string;
};

export function AthleteFilter({ athletes, currentAthleteId, currentEvent }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    if (e.target.value) params.set("athleteId", e.target.value);
    if (currentEvent) params.set("event", currentEvent);
    router.push(`/coach/video-analysis${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <select
      value={currentAthleteId}
      onChange={handleChange}
      className="input text-sm w-44"
      aria-label="Filter by athlete"
    >
      <option value="">All Athletes</option>
      {athletes.map((a) => (
        <option key={a.id} value={a.id}>
          {a.firstName} {a.lastName}
        </option>
      ))}
    </select>
  );
}
