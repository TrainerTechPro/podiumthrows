import type { Metadata } from "next";
import { ThrowBreakdownClient } from "./_throw-breakdown-client";

export const metadata: Metadata = {
  title: "Free Throw Breakdown — Podium Throws",
  description:
    "Send one video of your throw. A D1 throws coach sends back the three things costing you distance and the one cue to fix first. Free, within 48 hours.",
  openGraph: {
    title: "Send One Throw. Get It Broken Down by a D1 Coach.",
    description:
      "Free personal breakdown of your throw: the three things costing you distance and the one cue to fix first. Real reply within 48 hours.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function ThrowBreakdownPage() {
  return <ThrowBreakdownClient />;
}
