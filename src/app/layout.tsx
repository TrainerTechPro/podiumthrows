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
  const darkClass = theme === "dark" ? " dark" : "";

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable}${darkClass}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
