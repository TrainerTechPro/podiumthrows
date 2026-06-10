"use client";

import { useRouter } from "next/navigation";
import { CalibrationWizard } from "@/components/analysis/CalibrationWizard/CalibrationWizard";

export default function CalibratePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="font-heading text-display">Camera calibration</h1>
      <p className="text-body text-muted">
        One tripod setup at the ring standardizes your footage and unlocks
        real velocity and distance measurements.
      </p>
      <CalibrationWizard
        onDone={(calibrationSessionId) =>
          router.push(`/coach/video-analysis-2/new?calibrationSessionId=${calibrationSessionId}`)
        }
      />
    </div>
  );
}
