"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  FileVideo,
  MessageSquare,
  User,
  Trophy,
  Dumbbell,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthletePREvent } from "@/lib/data/personal-records";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  events: string[];
  heightCm: number | null;
  weightKg: number | null;
  classStanding: string | null;
  dateOfBirth: string | null;
  strengthNumbers: Record<string, number | null> | null;
  canonicalPRs: AthletePREvent[];
}

interface ThrowItem {
  id: string;
  event: string;
  implementWeight: number;
  distance: number | null;
  date: string;
  isPersonalBest: boolean;
}

interface NoteItem {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

interface VideoItem {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  event: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  profile: Profile;
  recentThrows: ThrowItem[];
  notes: NoteItem[];
  videos: VideoItem[];
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const LIFT_LABELS: Record<string, string> = {
  backSquat: "Back Squat",
  frontSquat: "Front Squat",
  powerClean: "Power Clean",
  snatch: "Snatch",
  benchPress: "Bench Press",
};

export function ReviewProfileClient({
  profile,
  recentThrows,
  notes,
  videos,
}: Props) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [completing, setCompleting] = useState(false);

  async function complete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/athlete/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ completeOnboarding: true }),
      });
      // The PATCH endpoint returns flat profile fields on success and
      // { success: false, error } on failure. Check status first, then
      // surface the error message if present.
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || data.success === false) {
        toastError(data.error || `Failed to complete review (${res.status})`);
        setCompleting(false);
        return;
      }
      router.push("/athlete/dashboard");
    } catch {
      toastError("Network error — please try again");
      setCompleting(false);
    }
  }

  const hasStrength =
    profile.strengthNumbers &&
    Object.values(profile.strengthNumbers).some((v) => v != null);

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <section className="card p-5 space-y-3">
        <header className="flex items-center gap-2">
          <User
            size={18}
            strokeWidth={1.75}
            className="text-primary-500"
            aria-hidden="true"
          />
          <h2 className="font-heading text-base font-semibold">Basic Info</h2>
        </header>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
              Name
            </div>
            <div className="font-medium">
              {profile.firstName} {profile.lastName}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
              Gender
            </div>
            <div className="font-medium">
              {profile.gender.charAt(0) + profile.gender.slice(1).toLowerCase()}
            </div>
          </div>
          {profile.heightCm != null && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                Height
              </div>
              <div className="font-mono tabular-nums">{profile.heightCm} cm</div>
            </div>
          )}
          {profile.weightKg != null && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                Weight
              </div>
              <div className="font-mono tabular-nums">{profile.weightKg} kg</div>
            </div>
          )}
          {profile.classStanding && (
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                Class
              </div>
              <div className="font-medium">{profile.classStanding}</div>
            </div>
          )}
          <div className="col-span-2">
            <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
              Events
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.events.map((e) => (
                <span
                  key={e}
                  className="px-2 py-0.5 rounded-full text-xs bg-surface-100 dark:bg-surface-800"
                >
                  {EVENT_LABELS[e] || e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Competition PRs */}
      {profile.canonicalPRs.some((e) => e.competitionPR || e.practiceBest) && (
        <section className="card p-5 space-y-3">
          <header className="flex items-center gap-2">
            <Trophy size={18} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">Competition PRs</h2>
          </header>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.canonicalPRs.map((e) => {
              const primary = e.competitionPR ?? e.practiceBest;
              if (!primary) return null;
              return (
                <div key={e.event}>
                  <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                    {EVENT_LABELS[e.event] || e.event}
                    {e.competitionPR == null && (
                      <span className="ml-1 normal-case text-[var(--muted)]/70">(practice)</span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-lg text-primary-500">
                    {primary.distance}m
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strength Numbers */}
      {hasStrength && profile.strengthNumbers && (
        <section className="card p-5 space-y-3">
          <header className="flex items-center gap-2">
            <Dumbbell
              size={18}
              strokeWidth={1.75}
              className="text-primary-500"
              aria-hidden="true"
            />
            <h2 className="font-heading text-base font-semibold">
              Strength Numbers
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(profile.strengthNumbers).map(([key, weight]) => {
              if (weight == null) return null;
              return (
                <div key={key}>
                  <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                    {LIFT_LABELS[key] || key}
                  </div>
                  <div className="font-mono tabular-nums">{weight} kg</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Throws */}
      {recentThrows.length > 0 && (
        <section className="card p-5 space-y-3">
          <h2 className="font-heading text-base font-semibold">
            Recent Throws Logged by Coach
          </h2>
          <ul className="space-y-2">
            {recentThrows.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 text-sm py-2 border-b border-[var(--card-border)] last:border-0"
              >
                {t.isPersonalBest && (
                  <Star
                    size={14}
                    strokeWidth={1.75}
                    className="text-primary-500 fill-primary-500 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    {EVENT_LABELS[t.event] || t.event}
                  </div>
                  <div className="text-xs text-[var(--muted)] font-mono tabular-nums">
                    {t.implementWeight}kg ·{" "}
                    {new Date(t.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-mono tabular-nums text-base">
                  {t.distance != null ? `${t.distance}m` : "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <section className="card p-5 space-y-3">
          <header className="flex items-center gap-2">
            <FileVideo
              size={18}
              strokeWidth={1.75}
              className="text-primary-500"
              aria-hidden="true"
            />
            <h2 className="font-heading text-base font-semibold">
              Videos from Practice
            </h2>
          </header>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {videos.map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-video bg-surface-100 dark:bg-surface-800 rounded-lg border border-[var(--card-border)] flex items-center justify-center hover:border-primary-500/50 transition-colors overflow-hidden"
              >
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnailUrl}
                    alt={v.notes || "Practice video"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileVideo
                    size={24}
                    strokeWidth={1.75}
                    className="text-[var(--muted)]"
                    aria-hidden="true"
                  />
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Coach Notes */}
      {notes.length > 0 && (
        <section className="card p-5 space-y-3">
          <header className="flex items-center gap-2">
            <MessageSquare
              size={18}
              strokeWidth={1.75}
              className="text-primary-500"
              aria-hidden="true"
            />
            <h2 className="font-heading text-base font-semibold">
              Notes from Your Coach
            </h2>
          </header>
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-[var(--muted)] uppercase tracking-wider">
                    {n.category.toLowerCase()}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[var(--foreground)] whitespace-pre-wrap">
                  {n.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action buttons */}
      <div className="space-y-3 pt-4">
        <button
          onClick={complete}
          disabled={completing}
          className="w-full px-4 py-4 rounded-xl text-base font-semibold
            bg-primary-500 text-black hover:bg-primary-400
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            active:scale-[0.97]"
          type="button"
        >
          {completing ? "Setting up..." : "Looks Good — Let's Go"}
        </button>
        <button
          onClick={complete}
          disabled={completing}
          className="w-full px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
          type="button"
        >
          I&apos;ll Review Later
        </button>
      </div>
    </div>
  );
}
