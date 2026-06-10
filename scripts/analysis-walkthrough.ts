/**
 * Stage-7 VERIFY: scripted end-to-end walkthrough on the LOCAL database —
 * upload fixture → job → pose webhook state → full pipeline → results →
 * PDF, asserting every step. No network, no Modal, no Claude (template
 * narrative path), local-fs artifact storage.
 *
 *   POSTGRES_PRISMA_URL=postgresql://localhost:5432/podium_throws \
 *   POSTGRES_URL_NON_POOLING=$POSTGRES_PRISMA_URL \
 *     npx tsx scripts/analysis-walkthrough.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const dbUrl = process.env.POSTGRES_PRISMA_URL ?? "";
if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
  console.error("Refusing to run: POSTGRES_PRISMA_URL must point at a local database.");
  process.exit(1);
}

async function main() {
  const { default: prisma } = await import("@/lib/prisma");
  const { PoseOutputSchema } = await import("@/lib/contracts");
  const { syntheticThrow } = await import("@/lib/analysis/__fixtures__/synthetic-throw");
  const { transitionJob } = await import("@/lib/analysis/jobs");
  const { processPoseComplete } = await import("@/lib/analysis/process");
  const { checkAnalysisAllowance } = await import("@/lib/analysis/gating");

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
  const coach = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    create: { userId: coachUser.id, firstName: "Walk", lastName: "Through", plan: "PRO" },
    update: { plan: "PRO" },
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

  // ── Step 1: gating allows the run (PRO) ───────────────────────────────
  const allowance = await checkAnalysisAllowance(athlete.id);
  assert.ok(allowance, "allowance lookup");
  assert.equal(allowance.plan, "PRO");
  assert.ok(allowance.allowed, "PRO plan should allow analysis");
  console.log(`1. gating: PRO allows (used ${allowance.used}/${allowance.quota})`);

  // ── Step 2: "upload" the fixture clip + register the job ─────────────
  const clipKey = `analysis/clips/${coachUser.id}/walkthrough.mp4`;
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  mkdirSync(path.dirname(path.join(uploadsRoot, clipKey)), { recursive: true });
  writeFileSync(
    path.join(uploadsRoot, clipKey),
    readFileSync(path.join(process.cwd(), "services/pose/fixtures/fixture-clip.mp4"))
  );
  const job = await prisma.analysisJob.create({
    data: {
      userId: coachUser.id,
      athleteId: athlete.id,
      event: "SHOT_PUT",
      clipPath: clipKey,
      timings: { uploadedAt: new Date().toISOString() },
    },
  });
  assert.equal(job.status, "QUEUED");
  console.log(`2. job registered: ${job.id} (QUEUED)`);

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
  mkdirSync(path.dirname(path.join(uploadsRoot, rawPath)), { recursive: true });
  writeFileSync(path.join(uploadsRoot, rawPath), JSON.stringify(rawPose));

  assert.ok(await transitionJob(job.id, "PROCESSING"), "QUEUED→PROCESSING");
  assert.ok(await transitionJob(job.id, "POSE_COMPLETE"), "PROCESSING→POSE_COMPLETE");
  await prisma.poseArtifact.create({
    data: { jobId: job.id, rawPath, modelId: "rtmpose-l", modelVersion: "walkthrough" },
  });
  console.log("3. pose artifact recorded (POSE_COMPLETE)");

  // ── Step 4: full pipeline with local-fs storage ───────────────────────
  const localStorage = {
    async getJson(key: string) {
      return JSON.parse(readFileSync(path.join(uploadsRoot, key), "utf8"));
    },
    async putJson(key: string, data: unknown) {
      const p = path.join(uploadsRoot, key);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(data));
    },
    async putBytes(key: string, bytes: Uint8Array) {
      const p = path.join(uploadsRoot, key);
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
  const metrics = done.result.metrics as { metrics: Record<string, { value: number | null }> };
  assert.ok(metrics.metrics.release_frame.value !== null, "release frame measured");
  assert.ok(Array.isArray(done.result.faults), "faults array");
  assert.ok(done.result.narrative, "narrative stored");
  assert.ok(done.result.phaseScores, "phase scores stored");
  console.log(
    `4. pipeline COMPLETE: release_frame=${metrics.metrics.release_frame.value}, ` +
      `faults=${(done.result.faults as unknown[]).length}, ` +
      `narrative=${(done.result.narrative as { source: string }).source}`
  );

  // ── Step 6: the PDF exists and is a PDF ───────────────────────────────
  assert.ok(done.result.reportPdfPath, "report path recorded");
  const pdfPath = path.join(uploadsRoot, done.result.reportPdfPath);
  assert.ok(existsSync(pdfPath), "PDF file exists");
  const pdf = readFileSync(pdfPath);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", "PDF magic bytes");
  assert.ok(pdf.length > 2000, "PDF non-trivial");
  console.log(`5. PDF written: ${pdfPath} (${pdf.length} bytes)`);

  // ── Cleanup the job row so reruns don't accumulate quota usage ───────
  await prisma.analysisJob.delete({ where: { id: job.id } });
  await prisma.$disconnect();
  console.log("\nWALKTHROUGH PASSED: upload → job → pose → metrics → faults → narrative → report.pdf");
}

main().catch((err) => {
  console.error("WALKTHROUGH FAILED:", err);
  process.exit(1);
});
