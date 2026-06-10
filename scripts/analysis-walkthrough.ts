/**
 * Stage-7 VERIFY: scripted end-to-end walkthrough on the LOCAL database —
 * upload fixture → job → pose webhook state → full pipeline → results →
 * PDF, asserting every step. No network, no Modal, no Claude (template
 * narrative path), local-fs artifact storage.
 *
 *   POSTGRES_PRISMA_URL=postgresql://localhost:5432/podium_throws \
 *   POSTGRES_URL_NON_POOLING=$POSTGRES_PRISMA_URL \
 *     npx tsx scripts/analysis-walkthrough.ts [--calibrated]
 *
 * Default is quick mode (no calibration session, PRO coach): asserts graded
 * confidence — clip badge, view-sensitivity caps, suppressed velocity.
 * --calibrated creates a CalibrationSession + ELITE coach: asserts calibrated
 * velocity and uncapped grades.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

/**
 * Pull the painted text back out of the PDF: inflate every content stream,
 * then decode pdf-lib's hex-encoded show-text operators (<48656C6C6F> Tj).
 */
function extractPdfText(pdf: Buffer): string {
  let streams = "";
  let idx = 0;
  for (;;) {
    const s = pdf.indexOf("stream", idx);
    if (s === -1) break;
    const start = pdf[s + 6] === 0x0d ? s + 8 : s + 7;
    const e = pdf.indexOf("endstream", start);
    if (e === -1) break;
    const raw = pdf.subarray(start, e);
    try {
      streams += inflateSync(raw).toString("latin1");
    } catch {
      streams += raw.toString("latin1");
    }
    idx = e + "endstream".length;
  }
  let text = "";
  for (const match of streams.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
    text += Buffer.from(match[1], "hex").toString("latin1") + "\n";
  }
  return text;
}

const dbUrl = process.env.POSTGRES_PRISMA_URL ?? "";
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.error("Refusing to run: POSTGRES_PRISMA_URL must point at a local database.");
  process.exit(1);
}

const mode: "quick" | "calibrated" = process.argv.includes("--calibrated")
  ? "calibrated"
  : "quick";

async function main() {
  const { default: prisma } = await import("@/lib/prisma");
  const { PoseOutputSchema, normalizeStoredFaults } = await import("@/lib/contracts");
  const { syntheticThrow } = await import("@/lib/analysis/__fixtures__/synthetic-throw");
  const { transitionJob } = await import("@/lib/analysis/jobs");
  const { processPoseComplete } = await import("@/lib/analysis/process");
  const { checkAnalysisAllowance } = await import("@/lib/analysis/gating");
  const { localArtifactPath } = await import("@/lib/analysis/storage");

  // ── Fixture actors (idempotent upserts; local DB only) ────────────────
  const coachUser = await prisma.user.upsert({
    where: { email: "va2-walkthrough-coach@example.com" },
    create: {
      email: "va2-walkthrough-coach@example.com",
      passwordHash: "x",
      role: "COACH",
    },
    update: {},
  });
  // Calibrated metrics are Elite-gated in the pipeline; quick mode runs PRO.
  const plan = mode === "calibrated" ? "ELITE" : "PRO";
  const coach = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    create: { userId: coachUser.id, firstName: "Walk", lastName: "Through", plan },
    update: { plan },
  });
  const athleteUser = await prisma.user.upsert({
    where: { email: "va2-walkthrough-athlete@example.com" },
    create: {
      email: "va2-walkthrough-athlete@example.com",
      passwordHash: "x",
      role: "ATHLETE",
    },
    update: {},
  });
  const athlete = await prisma.athleteProfile.upsert({
    where: { userId: athleteUser.id },
    create: {
      userId: athleteUser.id,
      coachId: coach.id,
      firstName: "Fixture",
      lastName: "Athlete",
      gender: "MALE",
    },
    update: { coachId: coach.id },
  });

  // ── Step 1: gating allows the run ─────────────────────────────────────
  const allowance = await checkAnalysisAllowance(athlete.id);
  assert.ok(allowance, "allowance lookup");
  assert.equal(allowance.plan, plan);
  assert.ok(allowance.allowed, `${plan} plan should allow analysis`);
  console.log(`1. gating: ${plan} allows (used ${allowance.used}/${allowance.quota})`);

  // ── Step 2: "upload" the fixture clip + register the job ─────────────
  // Calibrated mode: a CalibrationSession with a synthetic (but valid)
  // homography, exactly what the wizard persists.
  const calibration =
    mode === "calibrated"
      ? await prisma.calibrationSession.create({
          data: {
            userId: coachUser.id,
            athleteId: athlete.id,
            event: "SHOT_PUT",
            ringEllipse: { cx: 960, cy: 540, rx: 200, ry: 80, rotation: 0 },
            homography: {
              matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
              pixelsPerMeter: 100,
              reprojectionError: 0.01,
              ringDiameterM: 2.135,
            },
          },
        })
      : null;

  const clipKey = `analysis/clips/${coachUser.id}/walkthrough.mp4`;
  mkdirSync(path.dirname(localArtifactPath(clipKey)), { recursive: true });
  writeFileSync(
    localArtifactPath(clipKey),
    readFileSync(path.join(process.cwd(), "services/pose/fixtures/fixture-clip.mp4"))
  );
  const job = await prisma.analysisJob.create({
    data: {
      userId: coachUser.id,
      athleteId: athlete.id,
      event: "SHOT_PUT",
      clipPath: clipKey,
      calibrationSessionId: calibration?.id ?? null,
      timings: { uploadedAt: new Date().toISOString() },
    },
  });
  assert.equal(job.status, "QUEUED");
  console.log(`2. job registered: ${job.id} (QUEUED, ${mode})`);

  // ── Step 3: simulate the pose service completing (webhook semantics) ──
  const rawPose = PoseOutputSchema.parse({
    ...(() => {
      const s = syntheticThrow();
      return {
        schemaVersion: s.schemaVersion,
        jobId: job.id,
        modelId: "rtmpose-l",
        modelVersion: "walkthrough",
        fps: s.fps,
        resolution: s.resolution,
        frames: s.frames,
      };
    })(),
  });
  const rawPath = `analysis/${job.id}/pose-raw.json`;
  mkdirSync(path.dirname(localArtifactPath(rawPath)), { recursive: true });
  writeFileSync(localArtifactPath(rawPath), JSON.stringify(rawPose));

  assert.ok(await transitionJob(job.id, "PROCESSING"), "QUEUED→PROCESSING");
  assert.ok(await transitionJob(job.id, "POSE_COMPLETE"), "PROCESSING→POSE_COMPLETE");
  await prisma.poseArtifact.create({
    data: { jobId: job.id, rawPath, modelId: "rtmpose-l", modelVersion: "walkthrough" },
  });
  console.log("3. pose artifact recorded (POSE_COMPLETE)");

  // ── Step 4: full pipeline with local-fs storage ───────────────────────
  const localStorage = {
    async getJson(key: string) {
      return JSON.parse(readFileSync(localArtifactPath(key), "utf8"));
    },
    async putJson(key: string, data: unknown) {
      const p = localArtifactPath(key);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(data));
    },
    async putBytes(key: string, bytes: Uint8Array) {
      const p = localArtifactPath(key);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, bytes);
    },
  };
  await processPoseComplete(job.id, localStorage);

  // ── Step 5: assert the results surface ────────────────────────────────
  const done = await prisma.analysisJob.findUnique({
    where: { id: job.id },
    include: { result: true, poseArtifact: true },
  });
  assert.ok(done, "job exists");
  assert.equal(done.status, "COMPLETE", `expected COMPLETE, got ${done.status} (${JSON.stringify(done.error)})`);
  assert.ok(done.poseArtifact?.smoothedPath, "smoothed artifact stored");
  assert.ok(done.result, "analysis_results row");
  const metrics = done.result.metrics as {
    calibrated: boolean;
    clipConfidence?: { grade: string };
    metrics: Record<string, { value: number | null; confidenceGrade?: string }>;
  };
  assert.ok(metrics.metrics.release_frame.value !== null, "release frame measured");
  const storedFaults = normalizeStoredFaults(done.result.faults);
  assert.ok(Array.isArray(storedFaults.fired), "fired faults array");
  assert.ok(Array.isArray(storedFaults.notAssessed), "notAssessed array");
  assert.ok(done.result.narrative, "narrative stored");
  assert.ok(done.result.phaseScores, "phase scores stored");
  console.log(
    `4. pipeline COMPLETE: release_frame=${metrics.metrics.release_frame.value}, ` +
      `faults=${storedFaults.fired.length} (+${storedFaults.notAssessed.length} not assessed), ` +
      `narrative=${(done.result.narrative as { source: string }).source}`
  );

  // ── Step 5: graded confidence (quick-analysis feature) ────────────────
  const clipGrade = metrics.clipConfidence?.grade;
  assert.ok(clipGrade, "clip confidence grade present");
  const viewSensitive = metrics.metrics.trunk_inclination_at_release;
  const timing = metrics.metrics.entry_duration;
  if (mode === "quick") {
    assert.equal(metrics.calibrated, false, "quick mode is uncalibrated");
    assert.equal(metrics.metrics.release_velocity.value, null, "velocity suppressed");
    assert.equal(metrics.metrics.com_displacement.value, null, "displacement suppressed");
    if (viewSensitive.value !== null) {
      assert.notEqual(
        viewSensitive.confidenceGrade,
        "HIGH",
        "view-sensitive angle must be capped below HIGH uncalibrated"
      );
    }
    if (timing.value !== null) {
      assert.ok(timing.confidenceGrade, "timing metric carries a grade");
    }
    console.log(
      `5. quick-mode confidence: clip=${clipGrade}, trunk@release=${viewSensitive.confidenceGrade}, entry_duration=${timing.confidenceGrade}`
    );
  } else {
    assert.equal(metrics.calibrated, true, "calibrated mode");
    assert.ok(metrics.metrics.release_velocity.value !== null, "velocity measured");
    console.log(
      `5. calibrated confidence: clip=${clipGrade}, release_velocity=${metrics.metrics.release_velocity.value} m/s (${metrics.metrics.release_velocity.confidenceGrade})`
    );
  }

  // ── Step 6: the PDF exists, is a PDF, and paints the confidence layer ─
  assert.ok(done.result.reportPdfPath, "report path recorded");
  const pdfPath = localArtifactPath(done.result.reportPdfPath);
  assert.ok(existsSync(pdfPath), "PDF file exists");
  const pdf = readFileSync(pdfPath);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", "PDF magic bytes");
  assert.ok(pdf.length > 2000, "PDF non-trivial");
  // Content streams are Flate-compressed; inflate them, then grep single
  // tokens (phrases can wrap across drawText lines — tokens can't).
  const pdfText = extractPdfText(pdf);
  assert.ok(pdfText.includes("confidence"), "PDF mentions confidence");
  assert.ok(pdfText.includes(String(clipGrade)), `PDF carries the ${clipGrade} clip badge`);
  if (mode === "quick") {
    assert.ok(pdfText.includes("calibrated"), "PDF shows the requires-calibrated-session state");
    assert.ok(pdfText.includes("MEDIUM"), "PDF shows capped per-metric grades");
  }
  console.log(`6. PDF written: ${pdfPath} (${pdf.length} bytes, confidence layer present)`);

  // ── Cleanup so reruns don't accumulate quota usage or sessions ───────
  await prisma.analysisJob.delete({ where: { id: job.id } });
  if (calibration) {
    await prisma.calibrationSession.delete({ where: { id: calibration.id } });
  }
  await prisma.$disconnect();
  console.log(`\nWALKTHROUGH PASSED (${mode}): upload → job → pose → metrics → faults → narrative → report.pdf`);
}

main().catch((err) => {
  console.error("WALKTHROUGH FAILED:", err);
  process.exit(1);
});
