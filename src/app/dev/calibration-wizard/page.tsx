"use client";

import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { CalibrationWizard } from "@/components/analysis/CalibrationWizard/CalibrationWizard";

/**
 * Dev-only harness for the CalibrationWizard Playwright smoke test
 * (e2e/calibration-wizard.spec.ts) — camera and gyro are mocked by the test
 * via addInitScript. 404s in production.
 */
export default function CalibrationWizardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ToastProvider>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="font-heading text-title mb-4">Calibration wizard (dev)</h1>
        <CalibrationWizard athleteId={null} />
      </main>
    </ToastProvider>
  );
}
