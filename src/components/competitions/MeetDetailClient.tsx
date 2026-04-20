"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { CompetitionThrowsTable } from "@/components/competitions/CompetitionThrowsTable";
import type {
  CompThrowRow,
  ThrowSaveInput,
} from "@/components/competitions/CompetitionThrowsTable";
import { CompetitionMeetHeader } from "@/components/competitions/CompetitionMeetHeader";
import type { MeetHeaderValue } from "@/components/competitions/CompetitionMeetHeader";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { csrfHeaders } from "@/lib/csrf-client";

type MeetRow = {
  id: string;
  athleteId: string;
  name: string;
  date: string;
  event: string;
  priority: string;
  result: number | null;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ";
  venueType: "INDOOR" | "OUTDOOR" | null;
  weather: string | null;
  windMps: number | null;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
  throws: CompThrowRow[];
};

type Props = {
  meet: MeetRow;
  backHref: string;
  backLabel: string;
};

export function MeetDetailClient({ meet, backHref, backLabel }: Props) {
  const toast = useToast();
  const [throws, setThrows] = useState<CompThrowRow[]>(meet.throws);
  const [meetState, setMeetState] = useState(meet);

  const headerValue: MeetHeaderValue = {
    id: meetState.id,
    name: meetState.name,
    date: meetState.date,
    event: meetState.event,
    placeFinish: meetState.placeFinish,
    meetStatus: meetState.meetStatus,
    venueType: meetState.venueType,
    weather: meetState.weather,
    windMps: meetState.windMps,
    format: meetState.format,
    madeFinals: meetState.madeFinals,
  };

  const saveHeader = async (patch: Partial<MeetHeaderValue>) => {
    const res = await fetch("/api/throws/competitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ id: meetState.id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to save meet");
      throw new Error(json.error ?? "save failed");
    }
    setMeetState((m) => ({ ...m, ...patch }));
    toast.success("Meet updated");
  };

  const canMakeFinals = throws.some((t) => t.round === "PRELIM");

  const saveThrow = async (input: ThrowSaveInput) => {
    const { id: throwLogId, ...payload } = input;
    const method = throwLogId ? "PATCH" : "POST";
    const qs = throwLogId ? `?throwLogId=${throwLogId}` : "";

    const body = payload.isFoul
      ? {
          round: payload.round,
          attemptInRound: payload.attemptInRound,
          resultType: "FOUL" as const,
          foulType: payload.foulType,
          notes: payload.notes,
          videoUrl: payload.videoUrl,
          wireLength: payload.wireLength,
        }
      : payload.isPass
        ? {
            round: payload.round,
            attemptInRound: payload.attemptInRound,
            resultType: "PASS" as const,
            notes: payload.notes,
            videoUrl: payload.videoUrl,
            wireLength: payload.wireLength,
          }
        : {
            round: payload.round,
            attemptInRound: payload.attemptInRound,
            resultType: "MARK" as const,
            distance: payload.distance,
            notes: payload.notes,
            videoUrl: payload.videoUrl,
            wireLength: payload.wireLength,
          };

    const res = await fetch(`/api/throws/competitions/${meetState.id}/throws${qs}`, {
      method,
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to save throw");
      throw new Error(json.error ?? "save failed");
    }
    const updated = json.data.throwLog as CompThrowRow;

    setThrows((prev) => {
      const without = prev.filter((t) => t.id !== updated.id);
      return [...without, updated].sort((a, b) =>
        a.round === b.round ? a.attemptInRound - b.attemptInRound : a.round === "PRELIM" ? -1 : 1
      );
    });

    if (json.data.prCelebration) {
      const { event, newPR } = json.data.prCelebration;
      toast.celebration("New Competition PR!", {
        highlight: `${newPR.toFixed(2)}m`,
        description: (event as string).replace(/_/g, " "),
      });
    }

    // First structured throw clears the legacy result display
    if (meetState.result != null && throws.length === 0) {
      setMeetState((m) => ({ ...m, result: null }));
    }
  };

  const deleteThrow = async (id: string) => {
    const res = await fetch(`/api/throws/competitions/${meetState.id}/throws?throwLogId=${id}`, {
      method: "DELETE",
      headers: { ...csrfHeaders() },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to delete throw");
      return;
    }
    setThrows((prev) => prev.filter((t) => t.id !== id));
    toast.success("Throw removed");
  };

  const handleVideoChange = (throwLogId: string, videoUrl: string | null) => {
    setThrows((prev) => prev.map((t) => (t.id === throwLogId ? { ...t, videoUrl } : t)));
  };

  const promoteLegacy = async () => {
    const res = await fetch(`/api/throws/competitions/${meetState.id}/promote-legacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: "{}",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Failed to promote");
      return;
    }
    toast.success(json.data.promoted ? "Promoted to unified PR" : "Already recorded");
  };

  return (
    <div className="relative">
      <ScrollProgressBar />
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        {/* Back link */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {backLabel}
        </Link>

        <CompetitionMeetHeader
          value={headerValue}
          onChange={saveHeader}
          canMakeFinals={canMakeFinals}
        />
        <CompetitionThrowsTable
          meet={{
            id: meetState.id,
            athleteId: meetState.athleteId,
            event: meetState.event,
            format: meetState.format,
            madeFinals: meetState.madeFinals,
            result: meetState.result,
            name: meetState.name,
          }}
          throws={throws}
          onSave={saveThrow}
          onDelete={deleteThrow}
          onVideoChange={handleVideoChange}
          onPromoteLegacy={promoteLegacy}
        />
      </div>
    </div>
  );
}
