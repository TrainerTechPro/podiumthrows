"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Only log in development — production uses @vercel/speed-insights
    if (process.env.NODE_ENV !== "development") return;

    const color =
      metric.rating === "good"
        ? "\x1b[32m"     // green
        : metric.rating === "needs-improvement"
          ? "\x1b[33m"   // yellow
          : "\x1b[31m";  // red
    const reset = "\x1b[0m";

    console.log(
      `${color}[CWV] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})${reset}`,
    );
  });

  return null;
}
