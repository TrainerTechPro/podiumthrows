import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  HomographySchema,
  PoseOutputSchema,
  type Homography,
  type NarrativeInput,
} from "@/lib/contracts";
import { transitionJob } from "./jobs";
import { runTemporalPipeline } from "./temporal/pipeline";
import { runMetricsEngine } from "./metrics/engine";
import { evaluateFaults, loadShotPutRules } from "./faults/engine";
import { resolveDrillOptions } from "./drills";
import { generateNarrative } from "./narrative/claude";
import { buildReportModel } from "./report/report-model";
import { renderReportPdf } from "./report/pdf";
import { defaultStorage, type AnalysisStorage } from "./storage";

/**
 * Pipeline continuation after the pose webhook (D4/D5): POSE_COMPLETE →
 * temporal → quality gate → metrics → faults → narrative → report →
 * COMPLETE. Each step is deterministic except the narrative (which validates
 * + falls back). Any throw → FAILED with the error recorded, never swallowed.
 */

export async function processPoseComplete(
  jobId: string,
  storage: AnalysisStorage = defaultStorage
): Promise<void> {
  const job = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    include: {
      poseArtifact: true,
      calibrationSession: true,
      athlete: { select: { firstName: true, lastName: true } },
    },
  });
  if (!job || !job.poseArtifact) {
    logger.warn("analysis/process: job missing or no pose artifact", { metadata: { jobId } });
    return;
  }
  if (job.status !== "POSE_COMPLETE") {
    logger.info("analysis/process: skipping, job not in POSE_COMPLETE", {
      metadata: { jobId, status: job.status },
    });
    return;
  }

  try {
    const rawPose = PoseOutputSchema.parse(await storage.getJson(job.poseArtifact.rawPath));
    const { smoothed } = runTemporalPipeline(rawPose);

    const smoothedPath = `analysis/${job.id}/pose-smoothed.json`;
    await storage.putJson(smoothedPath, smoothed);
    await prisma.poseArtifact.update({
      where: { jobId: job.id },
      data: { smoothedPath, meanQuality: smoothed.meanQuality },
    });

    const coachProfileEarly = await prisma.coachProfile.findUnique({
      where: { userId: job.userId },
      select: { id: true, plan: true },
    });
    const athleteCoach = coachProfileEarly
      ? coachProfileEarly
      : await prisma.athleteProfile
          .findUnique({
            where: { id: job.athleteId },
            select: { coach: { select: { id: true, plan: true } } },
          })
          .then((a) => a?.coach ?? null);

    // Calibrated velocity/distance metrics are Elite-only (PRD §8). Below
    // Elite the clip is processed uncalibrated: angles + timing only.
    let homography: Homography | null = null;
    if (job.calibrationSession?.homography && athleteCoach?.plan === "ELITE") {
      const parsed = HomographySchema.safeParse(job.calibrationSession.homography);
      homography = parsed.success ? parsed.data : null;
    }

    const metrics = runMetricsEngine({
      pose: smoothed,
      event: job.event as NarrativeInput["event"],
      homography,
    });

    if (metrics.quality.lowConfidence) {
      await transitionJob(job.id, "LOW_CONFIDENCE", {
        error: {
          code: "LOW_CONFIDENCE",
          message:
            "Keypoint quality on this clip is too low to analyze honestly. Refilm with the athlete fully in frame.",
        },
      });
      return;
    }

    const rules = loadShotPutRules();
    const faults = evaluateFaults(metrics, rules);

    const drillOptions = await resolveDrillOptions({
      event: metrics.event,
      coachId: athleteCoach?.id ?? null,
      drillTags: [...new Set(faults.flatMap((f) => f.drillTags))],
    });

    const narrativeInput: NarrativeInput = {
      event: metrics.event,
      athleteContext: { level: null, recentFaultIds: [] },
      metrics: metrics.metrics,
      faults,
      drillOptions,
    };
    const narrative = await generateNarrative(narrativeInput);

    await transitionJob(job.id, "METRICS_COMPLETE");
    const result = await prisma.analysisResult.create({
      data: {
        jobId: job.id,
        metrics: metrics as unknown as object,
        phaseBoundaries: metrics.phaseBoundaries as unknown as object,
        faults: faults as unknown as object,
        narrative: narrative as unknown as object,
        rubricVersion: "rubric-1.0.0",
        rulesVersion: rules.version,
      },
    });

    const athleteName =
      `${job.athlete.firstName} ${job.athlete.lastName}`.trim() || "Athlete";
    const report = buildReportModel({
      metrics,
      faults,
      narrative,
      athleteName,
      dateIso: new Date().toISOString().slice(0, 10),
      drills: narrative.output.drillSelections.flatMap((sel) => {
        const d = drillOptions.find((o) => o.id === sel.drillId);
        return d
          ? [{ id: d.id, name: d.name, description: d.description, rationale: sel.rationale }]
          : [];
      }),
      watermark: (athleteCoach?.plan ?? "FREE") === "FREE",
      rulesVersion: rules.version,
    });
    await prisma.analysisResult.update({
      where: { id: result.id },
      data: { phaseScores: report.phaseScores as unknown as object },
    });

    const pdfBytes = await renderReportPdf(report);
    const reportPdfPath = `analysis/${job.id}/report.pdf`;
    await storage.putBytes(reportPdfPath, pdfBytes, "application/pdf");
    await prisma.analysisResult.update({
      where: { id: result.id },
      data: { reportPdfPath },
    });

    await transitionJob(job.id, "COMPLETE");
    logger.info("analysis/process: job complete", {
      metadata: { jobId: job.id, faults: faults.length, source: narrative.source },
    });
  } catch (err) {
    logger.error("analysis/process: pipeline failed", {
      metadata: { jobId },
      error: err instanceof Error ? err : new Error(String(err)),
    });
    await transitionJob(jobId, "FAILED", {
      error: {
        code: "METRICS_PIPELINE_ERROR",
        message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      },
    });
  }
}
