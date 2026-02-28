import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
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
      <body>{children}</body>
    </html>
  );
}
