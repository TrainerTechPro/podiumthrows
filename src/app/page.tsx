import type { Metadata } from "next";
import MarketingNav from "@/components/marketing/Nav";
import CoachingLanding from "@/components/marketing/CoachingLanding";
import MarketingFooter from "@/components/marketing/Footer";

const OG_COACHING =
  "/api/og?title=Podium%20Throws%20Coaching&description=Every%20returning%20hammer%20specialist%20gained%204.4%E2%80%935.5m%20in%20one%20season";

export const metadata: Metadata = {
  title: "Podium Throws — Coaching That Moves the Tape",
  description:
    "Throws coaching built on Bondarchuk methodology. Every returning hammer specialist gained 4.4-5.5m in one season. Online coaching, San Diego in-person training, and the platform behind it.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Podium Throws — Coaching That Moves the Tape",
    description:
      "Every returning hammer specialist gained 4.4-5.5m in one season. Online throws coaching built on Bondarchuk methodology.",
    type: "website",
    images: [
      {
        url: OG_COACHING,
        width: 1200,
        height: 630,
        alt: "Podium Throws Coaching",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Podium Throws — Coaching That Moves the Tape",
    description:
      "Every returning hammer specialist gained 4.4-5.5m in one season. Online throws coaching built on Bondarchuk methodology.",
    images: [OG_COACHING],
  },
};

export default function HomePage() {
  return (
    <div
      className="dark landing-grain min-h-screen font-body selection:bg-primary-500/30 selection:text-white"
      style={{
        backgroundColor: "var(--landing-bg)",
        color: "var(--landing-text)",
        position: "relative",
      }}
    >
      <MarketingNav />
      <CoachingLanding />
      <MarketingFooter />
    </div>
  );
}
