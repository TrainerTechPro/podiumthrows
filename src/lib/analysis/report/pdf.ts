import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { ReportModel } from "@/lib/contracts";

/**
 * PDF renderer (F9): paints a ReportModel — nothing else. All strings and
 * numbers come from the already-traceability-checked model; this file never
 * formats a metric itself. pdf-lib (D10): pure JS, serverless-safe.
 */

const AMBER = rgb(1, 0.784, 0);
const INK = rgb(0.08, 0.08, 0.1);
const MUTED = rgb(0.45, 0.45, 0.5);
const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 56;

interface Cursor {
  page: PDFPage;
  y: number;
}

export async function renderReportPdf(
  report: ReportModel,
  thumbnails: Record<string, Uint8Array> = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const newPage = (): Cursor => {
    const page = doc.addPage(PAGE);
    if (report.watermark) {
      page.drawText("PODIUM THROWS — FREE PLAN", {
        x: 110,
        y: 380,
        size: 36,
        font: bold,
        color: rgb(0.92, 0.92, 0.92),
        rotate: degrees(35),
      });
    }
    return { page, y: PAGE[1] - MARGIN };
  };

  let cur = newPage();
  const ensure = (needed: number) => {
    if (cur.y - needed < MARGIN) cur = newPage();
  };
  const text = (
    str: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ) => {
    const size = opts.size ?? 11;
    const lines = wrap(str, opts.font ?? font, size, PAGE[0] - 2 * MARGIN);
    for (const line of lines) {
      ensure(size + 6);
      cur.page.drawText(line, {
        x: MARGIN,
        y: cur.y,
        size,
        font: opts.font ?? font,
        color: opts.color ?? INK,
      });
      cur.y -= size + 4;
    }
    cur.y -= opts.gap ?? 6;
  };

  // ── Header ────────────────────────────────────────────────────────────
  cur.page.drawRectangle({ x: 0, y: PAGE[1] - 8, width: PAGE[0], height: 8, color: AMBER });
  text("PODIUM THROWS — VIDEO ANALYSIS", { size: 9, color: MUTED });
  text(`${report.header.event.replace("_", " ")} — ${report.header.athleteName}`, {
    size: 22,
    font: bold,
    gap: 2,
  });
  text(
    `${report.header.date}   ·   ${report.header.calibrated ? "Calibrated session (metric values enabled)" : "Uncalibrated — velocity and distances require calibration"}`,
    { size: 10, color: MUTED, gap: 14 }
  );

  // ── Phase scores ──────────────────────────────────────────────────────
  text("PHASE SCORES", { size: 12, font: bold, color: INK, gap: 2 });
  text(`Published rubric ${report.rubricVersion} — each score is a weighted average of the measured sub-metrics listed.`, {
    size: 9,
    color: MUTED,
  });
  for (const phase of report.phaseScores) {
    ensure(40);
    text(
      `${phase.phase.replace(/_/g, " ")} — ${phase.score === null ? "not measurable on this clip" : `${phase.score} / 10`}`,
      { size: 12, font: bold, gap: 0 }
    );
    for (const item of phase.items) {
      const v =
        item.value.value === null
          ? report.header.calibrated
            ? "not measurable"
            : "requires calibration"
          : `${item.value.value} ${item.value.unit}`;
      text(
        `   ${item.label}: ${v}   (weight ${item.weight}, frames ${item.value.frameRefs.join(", ") || "—"})`,
        { size: 9.5, color: MUTED, gap: 0 }
      );
    }
    cur.y -= 8;
  }

  // ── Fault cards ───────────────────────────────────────────────────────
  ensure(40);
  text("FAULTS — measured, with evidence", { size: 12, font: bold, gap: 2 });
  if (report.faultCards.length === 0) {
    text("No rule thresholds were crossed on this throw's measured values.", {
      size: 10,
      color: MUTED,
    });
  }
  for (const card of report.faultCards) {
    ensure(90);
    text(`${card.displayValue} (${card.displayTarget})`, { size: 11, font: bold, gap: 0 });
    text(
      `   severity ${card.fault.severity} · evidence frame${card.fault.evidenceFrames.length === 1 ? "" : "s"} ${card.fault.evidenceFrames.join(", ")} · ${card.fault.metricKey}`,
      { size: 9, color: MUTED, gap: 2 }
    );
    const bytes = card.thumbnailPath ? thumbnails[card.thumbnailPath] : undefined;
    if (bytes) {
      const img = await doc.embedJpg(bytes);
      const w = 180;
      const h = (img.height / img.width) * w;
      ensure(h + 10);
      cur.page.drawImage(img, { x: MARGIN, y: cur.y - h, width: w, height: h });
      cur.y -= h + 10;
    }
  }

  // ── Drills ────────────────────────────────────────────────────────────
  ensure(40);
  text("DRILL PRESCRIPTIONS (from your drill library)", { size: 12, font: bold, gap: 2 });
  for (const drill of report.drills) {
    text(`• ${drill.name}${drill.rationale ? ` — ${drill.rationale}` : ""}`, {
      size: 10,
      gap: 0,
    });
  }
  if (report.drills.length === 0) {
    text("No matching drills in the library for the detected faults.", { size: 10, color: MUTED });
  }

  // ── Coach summary ─────────────────────────────────────────────────────
  ensure(60);
  text("COACH'S SUMMARY", { size: 12, font: bold, gap: 2 });
  text(report.coachSummary, { size: 10.5 });

  // ── Methodology page ──────────────────────────────────────────────────
  cur = newPage();
  text("HOW THESE NUMBERS ARE MEASURED", { size: 14, font: bold, gap: 4 });
  for (const para of report.methodology) {
    text(para, { size: 10, gap: 8 });
  }
  text(`Versions — rubric ${report.rubricVersion} · rules ${report.rulesVersion}.`, {
    size: 8.5,
    color: MUTED,
  });

  return doc.save();
}

function wrap(str: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
