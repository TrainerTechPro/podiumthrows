/**
 * Parse a distance input string into canonical meters + retained original for display.
 * Accepts:
 *   "18.42"      → meters
 *   "18.42m"     → meters
 *   "60'4\""     → ft + in
 *   "60-4"       → ft + in (dash notation)
 *   "60ft"       → whole feet
 */

const M_PER_FT = 0.3048;
const IN_PER_FT = 12;

export type ParsedDistance = {
  meters: number;
  unit: "m" | "ft";
  original: number; // value in original unit (for round-trip display)
};

export function parseDistance(raw: string | null | undefined): ParsedDistance | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s.length === 0) return null;

  // Feet + inches: 60'4" or 60-4
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|-)\s*(\d+(?:\.\d+)?)\s*"?$/);
  if (ftIn) {
    const ft = parseFloat(ftIn[1]);
    const inches = parseFloat(ftIn[2]);
    if (!Number.isFinite(ft) || !Number.isFinite(inches) || inches < 0 || inches >= IN_PER_FT)
      return null;
    const totalFt = ft + inches / IN_PER_FT;
    return { meters: totalFt * M_PER_FT, unit: "ft", original: totalFt };
  }

  // Whole feet with ft suffix
  const ftOnly = s.match(/^(\d+(?:\.\d+)?)\s*ft$/);
  if (ftOnly) {
    const ft = parseFloat(ftOnly[1]);
    if (!Number.isFinite(ft) || ft <= 0) return null;
    return { meters: ft * M_PER_FT, unit: "ft", original: ft };
  }

  // Meters (with optional m suffix)
  const meters = s.match(/^(\d+(?:\.\d+)?)\s*m?$/);
  if (meters) {
    const m = parseFloat(meters[1]);
    if (!Number.isFinite(m) || m <= 0) return null;
    return { meters: m, unit: "m", original: m };
  }

  return null;
}

export function formatDistance(meters: number | null | undefined, unit: "m" | "ft"): string {
  if (meters == null) return "—";
  if (unit === "m") {
    return `${parseFloat(meters.toFixed(2))}m`;
  }
  // feet: convert and split into ft + inches
  const totalFt = meters / M_PER_FT;
  const ft = Math.floor(totalFt);
  const inches = Math.round((totalFt - ft) * IN_PER_FT);
  // Handle inch rollover (e.g. 11.999... → 12)
  if (inches === IN_PER_FT) return `${ft + 1}'0"`;
  return `${ft}'${inches}"`;
}
