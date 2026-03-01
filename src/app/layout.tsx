import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { ServiceWorkerProvider } from "@/components/pwa/ServiceWorkerProvider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Podium Throws — Elite Throws Coaching Platform",
  description:
    "The coaching platform built for Olympic-level track & field throws coaches. Manage athletes, plan training, and track performance across shot put, discus, hammer, and javelin.",
  keywords: [
    "throws coaching",
    "track and field",
    "shot put",
    "discus",
    "hammer throw",
    "javelin",
    "Bondarchuk",
    "training management",
  ],
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "Podium Throws — Elite Throws Coaching Platform",
    description:
      "The coaching platform built for Olympic-level track & field throws coaches.",
    url: APP_URL,
    siteName: "Podium Throws",
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: "Podium Throws" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Podium Throws — Elite Throws Coaching Platform",
    description:
      "The coaching platform built for Olympic-level track & field throws coaches.",
    images: [`${APP_URL}/api/og`],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  // Dark mode is the default; only opt out with explicit "light" cookie
  const darkClass = theme !== "light" ? " dark" : "";

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable}${darkClass}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
      </body>
    </html>
  );
}
