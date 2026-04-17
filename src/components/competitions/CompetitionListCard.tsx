"use client";

import Link from "next/link";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export type CompetitionListItem = {
  id: string;
  name: string;
  date: string;
  event: string;
  placeFinish: number | null;
  meetStatus: "COMPLETED" | "DNS" | "DNF" | "DQ" | null;
  venueType: "INDOOR" | "OUTDOOR" | null;
  bestMark: number | null;
  throwCount: number;
};

type Props = {
  item: CompetitionListItem;
  href: string;
};

export function CompetitionListCard({ item, href }: Props) {
  return (
    <Link href={href} className="card card-interactive block p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base truncate">{item.name}</h3>
          <div className="text-xs text-muted mt-0.5">
            {item.date} · {item.event.replace(/_/g, " ")}
            {item.venueType && ` · ${item.venueType.toLowerCase()}`}
            {item.placeFinish != null && ` · ${ordinal(item.placeFinish)}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          {item.bestMark != null ? (
            <div className="font-mono tabular-nums text-lg text-primary-500">
              <AnimatedNumber value={item.bestMark} decimals={2} unit="m" />
            </div>
          ) : (
            <div className="text-xs text-muted">{item.meetStatus ?? "—"}</div>
          )}
          <div className="text-xs text-muted mt-0.5">
            {item.throwCount} throw{item.throwCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
