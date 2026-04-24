"use client";

import { useReportWebVitals } from "next/web-vitals";
import { logger } from "@/lib/logger";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Only log in development — production uses @vercel/speed-insights
    if (process.env.NODE_ENV !== "development") return;

    const color =
      metric.rating === "good"
        ? "\x1b[32m" // green
        : metric.rating === "needs-improvement"
          ? "\x1b[33m" // yellow
          : "\x1b[31m"; // red
    const reset = "\x1b[0m";

    logger.info(
      `${color}[CWV] ${metric.name}: ${metric.value.toFixed(1)}ms (${metric.rating})${reset}`,
      {
        context: "web-vitals",
        metadata: { name: metric.name, value: metric.value, rating: metric.rating },
      }
    );
  });

  return null;
}
